/** GET /api/quiz — Cloudflare Pages Function. */
import { handleQuiz } from '../../shared/core.js';

export const onRequestGet = async () => {
  const { status, body } = handleQuiz();
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
};
