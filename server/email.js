/**
 * email.js — magic-link email delivery.
 *
 * Default (no configuration): the magic link is printed to the server
 * console so local development needs no email account at all.
 *
 * Production: set RESEND_API_KEY (and EMAIL_FROM) and links are sent through
 * the Resend REST API (https://resend.com/docs/api-reference/emails/send-email).
 * Resend was chosen because it needs no SDK — a single HTTPS call with the
 * built-in fetch() — but the function below is the single integration point
 * if you prefer another provider:
 *
 *   // --- SendGrid alternative -------------------------------------------
 *   // await fetch('https://api.sendgrid.com/v3/mail/send', {
 *   //   method: 'POST',
 *   //   headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
 *   //              'Content-Type': 'application/json' },
 *   //   body: JSON.stringify({
 *   //     personalizations: [{ to: [{ email: to }] }],
 *   //     from: { email: fromAddress },
 *   //     subject,
 *   //     content: [{ type: 'text/html', value: html }],
 *   //   }),
 *   // });
 *
 *   // --- Nodemailer (SMTP) alternative ----------------------------------
 *   // const nodemailer = require('nodemailer');           // npm i nodemailer
 *   // const transporter = nodemailer.createTransport({
 *   //   host: process.env.SMTP_HOST, port: 587,
 *   //   auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
 *   // });
 *   // await transporter.sendMail({ from: fromAddress, to, subject, html });
 */

const FROM_DEFAULT = 'Immigration Advice Service <onboarding@resend.dev>';

/**
 * Send (or log) a magic link.
 * @param {string} to    recipient email address
 * @param {string} link  fully-qualified magic-link URL
 * @returns {Promise<{delivered: boolean, mode: string}>}
 */
async function sendMagicLink(to, link) {
  const subject = 'Your saved immigration assessment — sign-in link';
  const html = buildHtml(link);

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Development fallback — no email provider configured.
    console.log('\n============================================================');
    console.log('[email] No RESEND_API_KEY configured — printing magic link.');
    console.log(`[email] To:   ${to}`);
    console.log(`[email] Link: ${link}`);
    console.log('============================================================\n');
    return { delivered: false, mode: 'console' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || FROM_DEFAULT,
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
  return { delivered: true, mode: 'resend' };
}

function buildHtml(link) {
  // Plain, GOV.UK-toned transactional email. Kept inline-styled for clients.
  return `
  <div style="font-family: Arial, Helvetica, sans-serif; color: #0b0c0c; max-width: 560px;">
    <div style="background:#0b0c0c; color:#ffffff; padding:12px 16px; font-weight:bold; font-size:18px;">
      Immigration Advice Service
    </div>
    <div style="padding: 20px 16px; border: 1px solid #b1b4b6; border-top: 0;">
      <h1 style="font-size:22px; margin:0 0 16px;">Continue your saved assessment</h1>
      <p style="font-size:16px; line-height:1.5;">
        Use the button below to return to your immigration assessment. Your answers,
        guidance and uploaded document list will be restored exactly as you left them —
        on any device.
      </p>
      <p style="margin: 24px 0;">
        <a href="${link}"
           style="background:#00703c; color:#ffffff; text-decoration:none;
                  padding: 12px 24px; font-size:17px; display:inline-block;">
          Restore my session
        </a>
      </p>
      <p style="font-size:14px; color:#505a5f;">
        Or copy this link into your browser:<br>
        <a href="${link}" style="color:#1d70b8; word-break:break-all;">${link}</a>
      </p>
      <p style="font-size:14px; color:#505a5f;">
        This link expires after ${process.env.MAGIC_LINK_TTL_HOURS || 168} hours.
        If you did not request it you can safely ignore this email.
      </p>
      <p style="font-size:13px; color:#505a5f; border-top:1px solid #b1b4b6; padding-top:12px;">
        This service provides general information only and is not legal advice.
      </p>
    </div>
  </div>`;
}

module.exports = { sendMagicLink };
