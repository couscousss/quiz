/** GET /api/test-telegram?key=HOST_KEY — Vercel handler. */
import { handleTestTelegram, readConfig } from '../shared/core.js';

export default async function handler(req, res) {
  const key = (req.query && req.query.key) || '';
  const { status, body } = await handleTestTelegram(key, readConfig(process.env));
  res.status(status).json(body);
}
