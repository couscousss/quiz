/** GET /api/leaderboard?key=HOST_KEY — Vercel handler. */
import { handleLeaderboard, readConfig } from '../shared/core.js';

export default async function handler(req, res) {
  const key = (req.query && req.query.key) || '';
  const { status, body } = await handleLeaderboard(key, readConfig(process.env));
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}
