/** GET /api/quiz — Vercel handler. */
import { handleQuiz } from '../shared/core.js';

export default function handler(req, res) {
  const { status, body } = handleQuiz();
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}
