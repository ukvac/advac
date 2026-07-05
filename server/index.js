/**
 * server/index.js — Express app for the Immigration Advice Service.
 *
 * Serves the static frontend from /public and a small JSON API:
 *
 *   GET    /api/health                          liveness + feature flags
 *   POST   /api/session                         create an anonymous session
 *   GET    /api/session/:id                     fetch session state + uploads
 *   PUT    /api/session/:id                     save session state (autosave)
 *   POST   /api/magic-link                      email a sign-in link
 *   GET    /api/restore/:token                  resolve a magic-link token
 *   POST   /api/session/:id/uploads             upload a document (base64 JSON)
 *   GET    /api/session/:id/uploads             list documents
 *   DELETE /api/session/:id/uploads/:uploadId   remove a document
 *
 * Auth model: the session id is an unguessable 128-bit bearer secret known
 * only to the client that created it (or that restored it via magic link).
 */

const path = require('path');
const express = require('express');
const store = require('./store');
const email = require('./email');
const drive = require('./drive');

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB per document

store.init();

app.use(express.json({ limit: '15mb' })); // headroom for base64-encoded 10MB files
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------------------------------------------------------------------------
// Health / feature discovery — the frontend calls this to decide between
// full (server) mode and static/offline mode (e.g. when hosted on GitHub Pages).
// ---------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    email: Boolean(process.env.RESEND_API_KEY) ? 'resend' : 'console',
    googleDrive: drive.isEnabled() ? 'enabled' : 'stubbed',
  });
});

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------
app.post('/api/session', (req, res) => {
  const session = store.createSession();
  res.status(201).json({ sessionId: session.id });
});

app.get('/api/session/:id', (req, res) => {
  const s = store.getSession(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });
  res.json(publicSession(s));
});

app.put('/api/session/:id', (req, res) => {
  const { state } = req.body || {};
  if (state === undefined) return res.status(400).json({ error: 'Missing state' });
  const s = store.saveSessionState(req.params.id, state);
  if (!s) return res.status(404).json({ error: 'Session not found' });
  res.json({ ok: true, updatedAt: s.updatedAt });
});

// ---------------------------------------------------------------------------
// Magic links — passwordless save & restore across devices
// ---------------------------------------------------------------------------
app.post('/api/magic-link', async (req, res) => {
  try {
    const { sessionId, email: to } = req.body || {};
    if (!sessionId || !store.getSession(sessionId)) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }

    store.setSessionEmail(sessionId, to);
    const ttlHours = Number(process.env.MAGIC_LINK_TTL_HOURS || 168);
    const token = store.createToken(sessionId, ttlHours);

    const base =
      process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const link = `${base.replace(/\/$/, '')}/?token=${token}`;

    const result = await email.sendMagicLink(to, link);
    res.json({
      ok: true,
      delivered: result.delivered,
      mode: result.mode, // 'console' in dev — the frontend explains this
    });
  } catch (err) {
    console.error('[magic-link]', err);
    res.status(502).json({ error: 'Could not send the email. Try again shortly.' });
  }
});

app.get('/api/restore/:token', (req, res) => {
  const sessionId = store.resolveToken(req.params.token);
  if (!sessionId) return res.status(404).json({ error: 'Link is invalid or has expired' });
  const s = store.getSession(sessionId);
  if (!s) return res.status(404).json({ error: 'Session no longer exists' });
  res.json(publicSession(s));
});

// ---------------------------------------------------------------------------
// Document uploads
//
// Files arrive as base64 JSON (simple, dependency-free, ample for ≤10MB case
// documents). They are stored locally by store.js AND handed to the Google
// Drive stub (server/drive.js) — which becomes a real upload the moment
// credentials are configured.
// ---------------------------------------------------------------------------
app.post('/api/session/:id/uploads', async (req, res) => {
  const s = store.getSession(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });

  const { docType, filename, mimeType, dataBase64 } = req.body || {};
  if (!docType || !filename || !dataBase64) {
    return res.status(400).json({ error: 'docType, filename and dataBase64 are required' });
  }
  let buffer;
  try {
    buffer = Buffer.from(dataBase64, 'base64');
  } catch {
    return res.status(400).json({ error: 'dataBase64 is not valid base64' });
  }
  if (buffer.length === 0) return res.status(400).json({ error: 'File is empty' });
  if (buffer.length > MAX_UPLOAD_BYTES) {
    return res.status(413).json({ error: 'File exceeds the 10MB limit' });
  }

  const record = store.addUpload(s.id, {
    docType,
    filename,
    mimeType: mimeType || 'application/octet-stream',
    size: buffer.length,
    buffer,
  });

  // Hand off to the Google Drive integration (no-op while stubbed).
  try {
    const driveResult = await drive.uploadToDrive({
      sessionId: s.id,
      docType,
      filename,
      mimeType: mimeType || 'application/octet-stream',
      buffer,
    });
    store.setUploadDriveResult(s.id, record.id, driveResult);
    record.driveStatus = driveResult.driveStatus;
    record.driveFileId = driveResult.driveFileId;
  } catch (err) {
    console.error('[drive] upload failed:', err.message);
    store.setUploadDriveResult(s.id, record.id, { driveStatus: 'error' });
    record.driveStatus = 'error';
  }

  res.status(201).json({ ok: true, upload: publicUpload(record) });
});

app.get('/api/session/:id/uploads', (req, res) => {
  const s = store.getSession(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found' });
  res.json({ uploads: s.uploads.map(publicUpload) });
});

app.delete('/api/session/:id/uploads/:uploadId', (req, res) => {
  const ok = store.removeUpload(req.params.id, req.params.uploadId);
  if (!ok) return res.status(404).json({ error: 'Upload not found' });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function publicUpload(u) {
  // Never expose server file paths to the client.
  const { storedPath, ...rest } = u;
  return rest;
}

function publicSession(s) {
  return {
    sessionId: s.id,
    email: s.email,
    state: s.state,
    uploads: s.uploads.map(publicUpload),
    updatedAt: s.updatedAt,
  };
}

app.listen(PORT, () => {
  console.log(`Immigration Advice Service running at http://localhost:${PORT}`);
  console.log(`  email delivery : ${process.env.RESEND_API_KEY ? 'Resend API' : 'console (dev mode)'}`);
  console.log(`  Google Drive   : ${drive.isEnabled() ? 'ENABLED' : 'stubbed (see server/drive.js)'}`);
});
