'use strict';

const crypto = require('node:crypto');
const approved = require('./reminders.js');
const TEST_RECIPIENT = 'Connect@CPplanning.ca';

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.CRON_SECRET;
  const supplied = req.headers.authorization || '';
  const expected = secret ? 'Bearer ' + secret : '';
  const authorised = Boolean(secret) &&
    typeof supplied === 'string' &&
    supplied.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));

  if (!authorised) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Only send a controlled test while all real reminders are disabled.
  if (String(process.env.REMINDER_SENDING_ENABLED || '').trim().toUpperCase() !== 'NO') {
    return res.status(403).json({ error: 'Test is only available when automated sending is disabled.' });
  }

  if (!/^re_[A-Za-z0-9_-]+$/.test(process.env.RESEND_API_KEY || '') ||
      !process.env.REMINDER_FROM || !process.env.REMINDER_REPLY_TO) {
    return res.status(503).json({ error: 'Email delivery is not configured.' });
  }

  try {
    // A fixed idempotency key reduces duplicate sends if Run is clicked twice.
    const key = 'ljovpf-reminder-preview-2026-11-11';
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json',
        'Idempotency-Key': key
      },
      body: JSON.stringify({
        from: process.env.REMINDER_FROM,
        to: [TEST_RECIPIENT],
        reply_to: [process.env.REMINDER_REPLY_TO],
        subject: approved.EMAIL_SUBJECT,
        text: approved.composeMessage(),
        html: approved.composeHtmlMessage()
      }),
      signal: AbortSignal.timeout(12000)
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || typeof result.id !== 'string') {
      console.error('Little Jamaica test email was not accepted by Resend (HTTP ' + response.status + ')');
      return res.status(502).json({ error: 'Test email was not accepted by Resend.', providerStatus: response.status });
    }

    console.info('Little Jamaica reminder test email accepted by Resend.');
    return res.status(200).json({ testEmailAccepted: true, surveySendingEnabled: false });
  } catch {
    console.error('Little Jamaica reminder test email request failed.');
    return res.status(503).json({ error: 'Test email request could not be completed.' });
  }
};
