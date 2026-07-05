/**
 * drive.js — Google Drive integration (STUB).
 *
 * ============================================================================
 *  STATUS: Fully wired, deliberately dormant.
 *
 *  Every document a user uploads passes through uploadToDrive() below. While
 *  GOOGLE_DRIVE_ENABLED is not "true", the function is a no-op that reports
 *  `driveStatus: 'stubbed'` — files are still stored locally and listed in
 *  the UI, so the product works end-to-end today.
 *
 *  TO ACTIVATE (no code changes required beyond credentials):
 *    1. Google Cloud Console → create a project → enable the "Google Drive API"
 *    2. Create an OAuth 2.0 Client ID (type: Web application) and add
 *       GOOGLE_REDIRECT_URI to its authorised redirect URIs
 *    3. Run an OAuth consent flow ONCE to obtain a refresh token authorised
 *       for the drive.file scope (see getAuthUrl() below, or use the
 *       OAuth 2.0 Playground with your own credentials)
 *    4. Set in .env:
 *         GOOGLE_DRIVE_ENABLED=true
 *         GOOGLE_CLIENT_ID=...          // TODO: add credentials
 *         GOOGLE_CLIENT_SECRET=...      // TODO: add credentials
 *         GOOGLE_REDIRECT_URI=...
 *         GOOGLE_REFRESH_TOKEN=...      // TODO: add credentials
 *         GOOGLE_DRIVE_FOLDER_ID=...    // optional target folder
 *    5. Ensure `googleapis` is installed (it is an optionalDependency):
 *         npm install googleapis
 * ============================================================================
 */

// Scope: drive.file = access ONLY to files this app creates. This is the
// least-privilege scope and the correct one for storing user case documents.
const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.file'];

function isEnabled() {
  return process.env.GOOGLE_DRIVE_ENABLED === 'true';
}

/**
 * Lazily build an authenticated Drive client. `googleapis` is only required
 * here so the app runs fine when the package (an optionalDependency) is not
 * installed and the integration is disabled.
 */
function getDriveClient() {
  // eslint-disable-next-line global-require
  const { google } = require('googleapis'); // npm install googleapis

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,     // TODO: add credentials (.env)
    process.env.GOOGLE_CLIENT_SECRET, // TODO: add credentials (.env)
    process.env.GOOGLE_REDIRECT_URI
  );

  // A refresh token obtained once via the consent flow keeps the server
  // authorised indefinitely; googleapis refreshes access tokens automatically.
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN, // TODO: add credentials (.env)
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

/**
 * Helper for the one-off consent flow: prints the URL to visit to authorise
 * the app for the drive.file scope. Exchange the resulting code with
 * oauth2Client.getToken(code) to obtain the refresh token for .env.
 * (Not routed anywhere by default — call from a node REPL when onboarding.)
 */
function getAuthUrl() {
  // eslint-disable-next-line global-require
  const { google } = require('googleapis');
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // required to receive a refresh_token
    prompt: 'consent',
    scope: DRIVE_SCOPES,
  });
}

/**
 * Upload one user document to Google Drive.
 *
 * Called from the upload route for EVERY document. The metadata mirrors what
 * the UI shows: the file is named with its document type and session id so
 * case files group naturally inside Drive.
 *
 * @param {object} p
 * @param {string} p.sessionId session the document belongs to
 * @param {string} p.docType   e.g. "refusal-letter", "appeal-decision"
 * @param {string} p.filename  original filename
 * @param {string} p.mimeType  original MIME type
 * @param {Buffer} p.buffer    file contents
 * @returns {Promise<{driveStatus: string, driveFileId: string|null}>}
 */
async function uploadToDrive({ sessionId, docType, filename, mimeType, buffer }) {
  if (!isEnabled()) {
    // ------------------------------------------------------------------
    // STUB PATH (current behaviour): integration disabled, report as such.
    // The file remains stored locally by server/store.js.
    // ------------------------------------------------------------------
    return { driveStatus: 'stubbed', driveFileId: null };
  }

  // ---------------------------------------------------------------------
  // LIVE PATH — exercised as soon as GOOGLE_DRIVE_ENABLED=true and the
  // credentials above are supplied. This is the complete, real call pattern
  // for the Drive v3 API; nothing further needs writing.
  // ---------------------------------------------------------------------
  const { Readable } = require('stream');
  const drive = getDriveClient();

  const fileMetadata = {
    // Label the Drive file with document type + session for traceability
    name: `[${docType}] ${filename}`,
    description: `Immigration Advice Service upload — session ${sessionId}, document type: ${docType}`,
    appProperties: { sessionId, docType }, // queryable via Drive search
  };
  if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
    fileMetadata.parents = [process.env.GOOGLE_DRIVE_FOLDER_ID];
  }

  const res = await drive.files.create({
    requestBody: fileMetadata,
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: 'id, name, webViewLink',
  });

  return { driveStatus: 'uploaded', driveFileId: res.data.id };
}

module.exports = { uploadToDrive, getAuthUrl, DRIVE_SCOPES, isEnabled };
