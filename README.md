# Check your UK immigration options (advac)

A GOV.UK Design System–styled web application that gives tailored, up-to-date UK
immigration guidance. It grew out of the original static assessment tool at
`https://ukvac.github.io/advac/` and extends it into a full web app:

- **Personal circumstances intake** — a six-section questionnaire (status,
  nationality, residence history, Home Office decisions, appeals, dependants,
  goals) with follow-up questions that adapt to the answers given.
- **Accurate, cited guidance** — every assessment card and Q&A answer was
  audited against GOV.UK in **July 2026** and carries an inline source link.
  See "Content audit" below for what was corrected.
- **Document upload** — users upload refusal letters, appeal decisions,
  expired BRP cards, vignettes and supporting evidence, labelled by document
  type and tied to their session. Storage is local; a fully wired **Google
  Drive stub** is in place (see below).
- **Session persistence via magic link** — users enter an email address and
  receive a passwordless sign-in link that restores their exact session
  (answers, guidance, document list) on any device. State is stored
  server-side, keyed to the link token.
- **Graceful static fallback** — if the frontend is served without the Node
  backend (e.g. GitHub Pages), it detects this and runs with browser-local
  persistence only, with server features clearly signposted as unavailable.

## Project layout

```
├── index.html            # redirect stub (keeps the old GitHub Pages URL alive)
├── public/               # frontend (served statically by Express)
│   ├── index.html        # GOV.UK-styled app shell + intake questionnaire
│   ├── css/app.css       # GOV.UK Design System-inspired styles
│   └── js/
│       ├── guidance.js   # audited guidance content + assessment engine + Q&A library
│       └── app.js        # wizard, persistence, uploads, magic-link client
├── server/
│   ├── index.js          # Express app + JSON API
│   ├── store.js          # persistent JSON store (sessions, tokens, uploads)
│   ├── email.js          # magic-link email (Resend / console; SendGrid & Nodemailer noted)
│   └── drive.js          # Google Drive integration STUB (googleapis, OAuth2, drive.file)
├── .env.example          # all configuration, documented
└── package.json
```

## Running locally

Requires **Node.js 18+** (uses the built-in `fetch`).

```bash
npm install          # installs express (googleapis is optional — see below)
npm start            # or: npm run dev  (auto-restart on change)
```

Open <http://localhost:3000>. That's it — no database and no email account
needed for development:

- Session data is stored in `data/store.json` (created automatically,
  gitignored). Uploaded files land in `data/uploads/<sessionId>/`.
- With no email provider configured, **magic links are printed to the server
  console** — copy the link from the terminal to test cross-device restore
  (e.g. open it in a private window).

## Configuring the magic-link email service

Copy `.env.example` to `.env` and set:

```bash
RESEND_API_KEY=re_xxxxxxxx
EMAIL_FROM="Immigration Advice Service <no-reply@yourdomain.example>"
APP_BASE_URL=https://your-deployment.example   # used inside the emailed link
```

The integration lives in `server/email.js` and uses Resend's REST API via
`fetch` (no SDK). Commented, drop-in alternatives for **SendGrid** and
**Nodemailer (SMTP)** are included in the same file — swap the body of
`sendMagicLink()` if you prefer either.

Token lifetime is controlled by `MAGIC_LINK_TTL_HOURS` (default 168 = 7 days).
Tokens are 192-bit random values stored server-side and remain valid until
expiry so the same emailed link works across devices.

## Activating the Google Drive integration

Uploads currently store files locally and pass through
`server/drive.js#uploadToDrive()`, which is a **clearly commented stub**: the
OAuth2 client construction, the `drive.file` scope, the `files.create` call
pattern, and per-file metadata (document type + session id via
`appProperties`) are all already written. To go live:

1. In Google Cloud Console, create a project and **enable the Drive API**.
2. Create an **OAuth 2.0 Client ID** (Web application) and register your
   `GOOGLE_REDIRECT_URI`.
3. Complete the consent flow once to obtain a **refresh token** authorised for
   the `https://www.googleapis.com/auth/drive.file` scope — the helper
   `getAuthUrl()` in `server/drive.js` prints the consent URL, or use the
   OAuth 2.0 Playground with your own credentials.
4. Fill in `.env` (the `TODO: add credentials` markers in `server/drive.js`
   show exactly which values are read):

   ```bash
   GOOGLE_DRIVE_ENABLED=true
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=...
   GOOGLE_REFRESH_TOKEN=...
   GOOGLE_DRIVE_FOLDER_ID=...   # optional target folder
   ```

5. Ensure the `googleapis` package is installed: `npm install googleapis`
   (it is declared as an *optional* dependency so the app installs and runs
   without it while the integration is stubbed).

No further code changes are required — the next upload after enabling will be
mirrored to Drive and its file id recorded against the upload metadata.

## API overview

| Method | Path                                   | Purpose                                  |
| ------ | -------------------------------------- | ---------------------------------------- |
| GET    | `/api/health`                          | liveness + feature flags (email, Drive)  |
| POST   | `/api/session`                         | create an anonymous session              |
| GET    | `/api/session/:id`                     | fetch state + uploads                    |
| PUT    | `/api/session/:id`                     | save state (frontend autosaves)          |
| POST   | `/api/magic-link`                      | email a sign-in link for a session       |
| GET    | `/api/restore/:token`                  | resolve a magic link to a session        |
| POST   | `/api/session/:id/uploads`             | upload a document (base64 JSON, ≤10MB)   |
| GET    | `/api/session/:id/uploads`             | list documents                           |
| DELETE | `/api/session/:id/uploads/:uploadId`   | remove a document                        |

The session id is an unguessable 128-bit secret and acts as the bearer
credential; magic-link tokens are separate 192-bit secrets with expiry.

## Content audit (July 2026)

All guidance was checked against GOV.UK; corrections made to the original
tool's content include:

| Topic | Was | Now |
| --- | --- | --- |
| Skilled Worker salary threshold | £26,200 / £38,700 | **£41,700** (22 July 2025), RQF6; Immigration Salary List replaced the Shortage Occupation List |
| ILR fee | £2,885 | **£3,226** (8 April 2026) |
| Naturalisation fee | £1,500 | **£1,839** total (£1,709 + £130 ceremony, 8 April 2026) |
| 10-year long residence | "even with gaps or overstaying" | requires continuous **lawful** residence (Appendix Long Residence, 11 Apr 2024); overstayers signposted to Appendix Private Life (20-year route) |
| Long-residence absences | 18 months total | **180 days in any rolling 12 months** |
| Marriage as a visitor | "you can marry on a standard visitor visa" | **incorrect** — a Marriage Visitor visa is required |
| BRP cards | listed as evidence | BRPs expired 31 Dec 2024 → **eVisa / UKVI account** |
| Graduate visa | 2 years, "60-day grace period" | 2 yrs (3 PhD) until 31 Dec 2026, **18 months from 1 Jan 2027**; no grace period — apply before the Student visa expires |
| Refugee leave | 5 years | **30 months** for claims lodged on/after 2 March 2026 |
| DVILR | old name | **Appendix Victim of Domestic Abuse** (31 Jan 2024), fee waiver noted |
| Partner visa income | £29,000 (already right) | confirmed current; MAC 2025 review context added |
| Child registration fee | — | reduced to **£1,000** (8 April 2026) |
| New coverage | — | eVisas, ETA (£16), earned-settlement proposals (10-year ILR, *not yet law*), care-worker route closure, citizenship good-character tightening (Feb 2025), appeal/admin-review deadlines |

Each figure is cited inline in the UI next to the guidance it supports.

## Disclaimers

This tool provides **general information, not legal advice**, and is not
affiliated with GOV.UK. Immigration rules change frequently — always verify
against [GOV.UK](https://www.gov.uk/browse/visas-immigration) and consult an
[IAA-regulated immigration adviser](https://www.gov.uk/find-an-immigration-adviser)
or solicitor.
