/**
 * store.js — simple persistent JSON store for sessions, uploads and
 * magic-link tokens.
 *
 * Deliberately dependency-free: state is held in memory and flushed to
 * `data/store.json` with an atomic write (temp file + rename). This is
 * perfectly adequate for a single-instance deployment of this service.
 *
 * FUTURE INTEGRATION POINT: to scale beyond one instance, swap this module
 * for Postgres/Redis — the exported API (getSession, saveSession, etc.) is
 * intentionally narrow so nothing else needs to change.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

let db = { sessions: {}, tokens: {} };
let writeTimer = null;

function init() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (fs.existsSync(STORE_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
      db.sessions = db.sessions || {};
      db.tokens = db.tokens || {};
    } catch (err) {
      console.error('[store] could not parse store.json, starting fresh:', err.message);
      db = { sessions: {}, tokens: {} };
    }
  }
}

/** Debounced atomic flush to disk. */
function persist() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    const tmp = STORE_FILE + '.tmp';
    fs.writeFile(tmp, JSON.stringify(db, null, 2), (err) => {
      if (err) return console.error('[store] write failed:', err.message);
      fs.rename(tmp, STORE_FILE, (renameErr) => {
        if (renameErr) console.error('[store] rename failed:', renameErr.message);
      });
    });
  }, 250);
}

function newId(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex');
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

function createSession() {
  const id = newId();
  const now = new Date().toISOString();
  db.sessions[id] = { id, createdAt: now, updatedAt: now, email: null, state: null, uploads: [] };
  persist();
  return db.sessions[id];
}

function getSession(id) {
  return db.sessions[id] || null;
}

function saveSessionState(id, state) {
  const s = db.sessions[id];
  if (!s) return null;
  s.state = state;
  s.updatedAt = new Date().toISOString();
  persist();
  return s;
}

function setSessionEmail(id, email) {
  const s = db.sessions[id];
  if (!s) return null;
  s.email = email;
  s.updatedAt = new Date().toISOString();
  persist();
  return s;
}

// ---------------------------------------------------------------------------
// Uploads — metadata lives in the session record, file bytes on disk.
// ---------------------------------------------------------------------------

function addUpload(sessionId, { docType, filename, mimeType, size, buffer }) {
  const s = db.sessions[sessionId];
  if (!s) return null;
  const uploadId = newId(8);
  const sessionDir = path.join(UPLOAD_DIR, sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });
  // Sanitise the stored filename; the original is kept in metadata only.
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  const storedPath = path.join(sessionDir, `${uploadId}__${safeName}`);
  fs.writeFileSync(storedPath, buffer);
  const record = {
    id: uploadId,
    docType,
    filename,
    mimeType,
    size,
    uploadedAt: new Date().toISOString(),
    storedPath,
    // Populated by the Google Drive integration once activated (drive.js)
    driveFileId: null,
    driveStatus: 'pending-integration',
  };
  s.uploads.push(record);
  s.updatedAt = new Date().toISOString();
  persist();
  return record;
}

function removeUpload(sessionId, uploadId) {
  const s = db.sessions[sessionId];
  if (!s) return false;
  const idx = s.uploads.findIndex((u) => u.id === uploadId);
  if (idx === -1) return false;
  const [removed] = s.uploads.splice(idx, 1);
  if (removed.storedPath) {
    fs.unlink(removed.storedPath, () => {});
  }
  s.updatedAt = new Date().toISOString();
  persist();
  return true;
}

function setUploadDriveResult(sessionId, uploadId, { driveFileId, driveStatus }) {
  const s = db.sessions[sessionId];
  if (!s) return;
  const u = s.uploads.find((x) => x.id === uploadId);
  if (!u) return;
  if (driveFileId !== undefined) u.driveFileId = driveFileId;
  if (driveStatus !== undefined) u.driveStatus = driveStatus;
  persist();
}

// ---------------------------------------------------------------------------
// Magic-link tokens
// ---------------------------------------------------------------------------

function createToken(sessionId, ttlHours) {
  const token = newId(24); // 192-bit URL-safe token
  const now = Date.now();
  db.tokens[token] = {
    sessionId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlHours * 3600 * 1000).toISOString(),
  };
  persist();
  return token;
}

/** Returns the sessionId for a valid token, or null. Tokens are reusable
 *  until expiry so the same emailed link works across devices. */
function resolveToken(token) {
  const t = db.tokens[token];
  if (!t) return null;
  if (new Date(t.expiresAt).getTime() < Date.now()) {
    delete db.tokens[token];
    persist();
    return null;
  }
  return t.sessionId;
}

module.exports = {
  init,
  createSession,
  getSession,
  saveSessionState,
  setSessionEmail,
  addUpload,
  removeUpload,
  setUploadDriveResult,
  createToken,
  resolveToken,
};
