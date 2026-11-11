
'use strict';

// Little Jamaica survey reminder endpoint.
// Safe initial version: no emails can be sent.

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // Do not expose reminder controls through public requests.
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  return res.status(200).json({
    service: 'Little Jamaica Survey Reminders',
    configured: true,
    sendingEnabled: false,
    message: 'Reminder endpoint created. Email sending is not yet connected.'
  });
};
