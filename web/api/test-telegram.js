/**
 * GET /api/test-telegram?key=HOST_KEY — post a one-off test message to the
 * configured Telegram chat, to confirm the bot works. Guarded by HOST_KEY.
 */
const { testMessage } = require('../lib/telegram');

module.exports = async (req, res) => {
  const key = (req.query && req.query.key) || '';
  if (String(key) !== String(process.env.HOST_KEY || '')) {
    res.status(403).json({ ok: false, error: 'Invalid host key.' });
    return;
  }
  try {
    const result = await testMessage();
    res.status(200).json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
};
