/** POST /api/submit — Cloudflare Pages Function. */
import { handleSubmit, readConfig } from '../../web/shared/core.js';

export const onRequestPost = async ({ request, env }) => {
  let payload = {};
  try { payload = await request.json(); } catch (e) { payload = {}; }
  const { status, body } = await handleSubmit(payload, readConfig(env));
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
};
