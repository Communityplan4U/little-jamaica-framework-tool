
'use strict';

const crypto = require('node:crypto');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  const secret = process.env.CRON_SECRET;
  const supplied = req.headers.authorization || '';
  const expected = secret ? `Bearer ${secret}` : '';

  if (!secret || supplied.length !== expected.length ||
      !crypto.timingSafeEqual(
        Buffer.from(supplied),
        Buffer.from(expected)
      )) {
    return res.status(401).json({
      error: 'Unauthorized'
    });
  }

  return res.status(200).json({
    service: 'Little Jamaica Survey Reminders',
    authenticated: true,
    sendingEnabled: false,
    message: 'Security verified. Email sending is not yet connected.'
  });
};
