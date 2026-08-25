/** GET /api/leaderboard?key=HOST_KEY — Cloudflare Pages Function. */
import { handleLeaderboard, readConfig } from '../../shared/core.js';

export const onRequestGet = async ({ request, env }) => {
  const key = new URL(request.url).searchParams.get('key') || '';
  const { status, body } = await handleLeaderboard(key, readConfig(env));
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
};
