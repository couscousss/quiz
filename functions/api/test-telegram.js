/** GET /api/test-telegram?key=HOST_KEY — Cloudflare Pages Function. */
import { handleTestTelegram, readConfig } from '../../web/shared/core.js';

export const onRequestGet = async ({ request, env }) => {
  const key = new URL(request.url).searchParams.get('key') || '';
  const { status, body } = await handleTestTelegram(key, readConfig(env));
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
};
