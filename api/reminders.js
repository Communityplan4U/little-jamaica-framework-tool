'use strict';

const crypto = require('node:crypto');
const gateway = require('../server/gateway.cjs');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.CRON_SECRET;
  const supplied = req.headers.authorization || '';
  const expected = secret ? `Bearer ${secret}` : '';

  if (!secret || supplied.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // This endpoint is deliberately read-only. It never sends emails.
  // Refuse to run if someone changes the sending switch prematurely.
  if (process.env.REMINDER_SENDING_ENABLED !== 'NO') {
    return res.status(503).json({
      error: 'Reminder sending is not implemented. Keep REMINDER_SENDING_ENABLED=NO.'
    });
  }

  try {
    const candidates = await gateway.rpc('ljov_reminder_candidates', { p_mode: 'public' });
    if (!Array.isArray(candidates)) throw new Error('Invalid eligibility response');

    console.info('Little Jamaica reminder dry-run: eligible count =', candidates.length);

    // Do not return contact information, response IDs, or survey answers.
    return res.status(200).json({
      service: 'Little Jamaica Survey Reminders',
      mode: 'dry_run',
      sendingEnabled: false,
      eligibleReminders: candidates.length,
      message: 'Eligibility checked. No emails sent.'
    });
  } catch (err) {
    console.error('Reminder eligibility check failed:', err?.name || 'Error');
    return res.status(503).json({
      error: 'The reminder eligibility check is temporarily unavailable.'
    });
  }
};
