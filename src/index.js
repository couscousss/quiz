/**
 * The Albatross Files — Cloudflare Worker entry point.
 *
 * Routes /api/* to the shared request logic and serves everything else from
 * the static assets in public/ (bound as ASSETS in wrangler.jsonc).
 *
 * The answer key lives in shared/quiz.js, which is bundled into the Worker and
 * never served as a file, so it cannot be downloaded by players.
 */
import {
  handleQuiz,
  handleSubmit,
  handleLeaderboard,
  handleTestTelegram,
  readConfig
} from '../shared/core.js';

function json(result) {
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const cfg = readConfig(env);

    if (path === '/api/quiz' && request.method === 'GET') {
      return json(handleQuiz());
    }

    if (path === '/api/submit' && request.method === 'POST') {
      let payload = {};
      try { payload = await request.json(); } catch (e) { payload = {}; }
      return json(await handleSubmit(payload, cfg));
    }

    if (path === '/api/leaderboard' && request.method === 'GET') {
      return json(await handleLeaderboard(url.searchParams.get('key') || '', cfg));
    }

    if (path === '/api/test-telegram' && request.method === 'GET') {
      return json(await handleTestTelegram(url.searchParams.get('key') || '', cfg));
    }

    if (path.indexOf('/api/') === 0) {
      return json({ status: 404, body: { ok: false, error: 'Not found.' } });
    }

    // Everything else is a static page from public/.
    return env.ASSETS.fetch(request);
  }
};
