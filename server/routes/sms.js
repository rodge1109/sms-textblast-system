import express from 'express';

const router = express.Router();

const SEMAPHORE_URL = 'https://api.semaphore.co/api/v4/messages';

/**
 * POST /api/sms/send-bulk
 * Body: { messages: [{ phone, message }] }
 *
 * Groups messages by content, then sends each group as one API call
 * with comma-separated numbers (up to 1000 per call).
 * Processes groups 5 at a time concurrently.
 */
router.post('/send-bulk', async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ success: false, error: 'No messages provided.' });
  }

  const apiKey     = process.env.SEMAPHORE_API_KEY;
  const senderName = process.env.SEMAPHORE_SENDER_NAME || 'SEMAPHORE';

  if (!apiKey || apiKey === 'YOUR_SEMAPHORE_API_KEY') {
    return res.status(500).json({ success: false, error: 'Semaphore API key is not configured.' });
  }

  // Group by message content so identical messages share one API call
  const groups = new Map();
  for (const { phone, message } of messages) {
    if (!groups.has(message)) groups.set(message, []);
    groups.get(message).push(phone);
  }

  // Flatten into API calls (one per unique message, batched at 1000 numbers)
  const apiCalls = [];
  for (const [message, phones] of groups.entries()) {
    for (let i = 0; i < phones.length; i += 1000) {
      apiCalls.push({ message, numbers: phones.slice(i, i + 1000) });
    }
  }

  const sendOne = async ({ message, numbers }) => {
    const form = new URLSearchParams();
    form.append('apikey',     apiKey);
    form.append('number',     numbers.join(','));
    form.append('message',    message);
    form.append('sendername', senderName);

    try {
      const response = await fetch(SEMAPHORE_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    form.toString(),
      });
      const text = await response.text();
      const data = JSON.parse(text);
      if (Array.isArray(data)) {
        const ok = data.filter(r => r.message_id).length;
        return { sent: ok, failed: numbers.length - ok };
      }
      return { sent: 0, failed: numbers.length };
    } catch (err) {
      console.error('SMS batch error:', err.message);
      return { sent: 0, failed: numbers.length };
    }
  };

  try {
    let sent = 0, failed = 0;
    const CONCURRENCY = 5;

    for (let i = 0; i < apiCalls.length; i += CONCURRENCY) {
      const batch   = apiCalls.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map(sendOne));
      for (const r of results) { sent += r.sent; failed += r.failed; }
    }

    console.log(`[SMS] Sent ${sent}, Failed ${failed}`);
    res.json({ success: true, sent, failed });

  } catch (err) {
    console.error('Semaphore send error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to reach Semaphore API.' });
  }
});

/**
 * POST /api/sms/send-single
 * Body: { phone, message }
 */
router.post('/send-single', async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ success: false, error: 'phone and message are required.' });
  }

  const apiKey     = process.env.SEMAPHORE_API_KEY;
  const senderName = process.env.SEMAPHORE_SENDER_NAME || 'SEMAPHORE';

  if (!apiKey || apiKey === 'YOUR_SEMAPHORE_API_KEY') {
    return res.status(500).json({ success: false, error: 'Semaphore API key is not configured.' });
  }

  try {
    const form = new URLSearchParams();
    form.append('apikey',     apiKey);
    form.append('number',     phone);
    form.append('message',    message);
    form.append('sendername', senderName);

    const response = await fetch(SEMAPHORE_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    form.toString(),
    });

    const text = await response.text();
    const data = JSON.parse(text);
    res.json({ success: true, data });
  } catch (err) {
    console.error('Semaphore single send error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to reach Semaphore API.' });
  }
});

export default router;
