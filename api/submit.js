/** POST /api/submit — Vercel handler. */
import { handleSubmit, readConfig } from '../shared/core.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }
  const payload = typeof req.body === 'string'
    ? (() => { try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; } })()
    : (req.body || {});
  const { status, body } = await handleSubmit(payload, readConfig(process.env));
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}
