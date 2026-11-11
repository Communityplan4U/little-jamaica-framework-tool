'use strict';

const crypto = require('node:crypto');
const gateway = require('../server/gateway.cjs');

const MODE = 'public';
const MAX_SENDS_PER_RUN = 10;
const SUBJECT = 'A reminder about your Little Jamaica and Oakwood Vaughan survey';

const SURVEY_LINK = 'https://communityinpublic.ca/ljovpf';

function composeMessage() {
  return [
    'Hello,',
    '',
    'You recently started the Little Jamaica and Oakwood Vaughan Planning Framework survey, but it looks like your response has not been completed.',
    '',
    "Don't forget to complete the survey > " + SURVEY_LINK,
    '',
    'Thank you,',
    '',
    'Community in Public',
    'Connect@CPplanning.ca'
  ].join('\n');
}

function composeHtmlMessage() {
  return [
    '<p>Hello,</p>',
    '<p>You recently started the Little Jamaica and Oakwood Vaughan Planning Framework survey, but it looks like your response has not been completed.</p>',
    '<p>Don&#39;t forget to complete the survey &gt; <a href="' + SURVEY_LINK + '">' + SURVEY_LINK + '</a></p>',
    '<p>Thank you,</p>',
    '<p>Community in Public<br><a href="mailto:Connect@CPplanning.ca">Connect@CPplanning.ca</a></p>'
  ].join('\n');
}

function authorised(req) {
  const secret = process.env.CRON_SECRET;
  const supplied = req.headers.authorization || '';
  const expected = secret ? 'Bearer ' + secret : '';
  return Boolean(secret) &&
    typeof supplied === 'string' &&
    supplied.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

function readyToSend() {
  const required = ['RESEND_API_KEY', 'REMINDER_FROM', 'REMINDER_REPLY_TO'];
  if (required.some((name) => !process.env[name])) return false;
  return /^re_[A-Za-z0-9_-]+$/.test(process.env.RESEND_API_KEY);
}

async function mark(responseId, status, providerId, reason) {
  return gateway.rpc('ljov_reminder_finish', {
    p_response_id: responseId,
    p_status: status,
    p_provider_id: providerId || null,
    p_error_reason: reason || null,
    p_mode: MODE
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!authorised(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const setting = String(process.env.REMINDER_SENDING_ENABLED || '').trim().toUpperCase();
  if (setting !== 'NO' && setting !== 'YES') {
    return res.status(503).json({ error: 'Reminder sending switch is not configured.' });
  }
  const enabled = setting === 'YES';
  if (enabled && !readyToSend()) {
    return res.status(503).json({ error: 'Reminder delivery is not fully configured.' });
  }

  try {
    if (enabled) {
      const state = await gateway.rpc('ljov_collection_status', {
        p_source: gateway.M.id,
        p_mode: MODE
      });
      if (!state || state.open !== true) {
        console.info('Little Jamaica reminder sending skipped: survey is closed');
        return res.status(200).json({
          service: 'Little Jamaica Survey Reminders',
          sendingEnabled: true,
          sent: 0,
          reason: 'Survey not accepting responses'
        });
      }
    }

    const candidates = await gateway.rpc('ljov_reminder_candidates', { p_mode: MODE });
    if (!Array.isArray(candidates)) throw new Error('Invalid eligibility response');

    if (!enabled) {
      console.info('Little Jamaica reminder dry-run: eligible count =', candidates.length);
      return res.status(200).json({
        service: 'Little Jamaica Survey Reminders',
        mode: 'dry_run',
        sendingEnabled: false,
        eligibleReminders: candidates.length,
        message: 'Eligibility checked. No emails sent.'
      });
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const candidate of candidates.slice(0, MAX_SENDS_PER_RUN)) {
      // The database checks eligibility again and reserves the email
      // atomically. A unique index permits at most one reservation per address.
      const claims = await gateway.rpc('ljov_reminder_reserve', {
        p_response_id: candidate.response_id,
        p_mode: MODE
      });
      if (!Array.isArray(claims) || claims.length === 0) {
        skipped++;
        continue;
      }
      if (claims.length !== 1) throw new Error('Unexpected reminder reservation result');

      const claim = claims[0];
      if (typeof claim.email !== 'string' || claim.email.length > 254 ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claim.email)) {
        await mark(claim.response_id, 'skipped', null, 'Invalid recipient email');
        skipped++;
        continue;
      }

      try {
        const idempotencyKey = 'ljov-reminder/' +
          crypto.createHash('sha256').update(claim.email_normalized).digest('hex');
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey
          },
          body: JSON.stringify({
            from: process.env.REMINDER_FROM,
            to: [claim.email],
            reply_to: [process.env.REMINDER_REPLY_TO],
            subject: SUBJECT,
            text: composeMessage(),
            html: composeHtmlMessage()
          }),
          signal: AbortSignal.timeout(12000)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || typeof result.id !== 'string') {
          await mark(claim.response_id, 'failed', null,
            'Resend request did not return a confirmed email ID (HTTP ' + response.status + ')');
          failed++;
          continue;
        }
        await mark(claim.response_id, 'sent', result.id, null);
        sent++;
      } catch {
        // A timeout may occur after delivery. Do not automatically retry:
        // the reservation remains recorded, preventing duplicate messages.
        try {
          await mark(claim.response_id, 'failed', null, 'Delivery outcome unconfirmed');
        } catch {
          // Leave the reserved record in place if logging is unavailable.
        }
        failed++;
      }
    }

    console.info('Little Jamaica reminder sending summary:', { sent, failed, skipped });
    return res.status(200).json({
      service: 'Little Jamaica Survey Reminders',
      sendingEnabled: true,
      sent,
      failed,
      skipped,
      remainingCandidates: Math.max(0, candidates.length - MAX_SENDS_PER_RUN)
    });
  } catch {
    console.error('Little Jamaica reminder eligibility or reservation check failed');
    return res.status(503).json({
      error: 'The reminder check is temporarily unavailable. No retries are scheduled.'
    });
  }
};
