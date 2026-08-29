/**
 * Request logic, kept separate from the Cloudflare plumbing so it can be tested
 * directly. Each handler returns { status, body }.
 *
 * `cfg` is the Worker environment, normalised by readConfig(): the D1 binding
 * plus the host key and optional Telegram settings.
 */
import { getPublicQuiz, scoreSubmission, TOTAL } from './quiz.js';
import { makeDb } from './db.js';
import { updateLeaderboard, testMessage } from './telegram.js';

/** Normalise env vars from either platform into one shape. */
export function readConfig(env) {
  env = env || {};
  return {
    d1: env.DB,                       // Cloudflare D1 binding named "DB"
    hostKey: env.HOST_KEY,
    botToken: env.TELEGRAM_BOT_TOKEN,
    chatId: env.TELEGRAM_CHAT_ID,
    leaderboardSize: env.TELEGRAM_LEADERBOARD_SIZE
  };
}

/** GET /api/quiz — questions + options only. Never includes the answer key. */
export function handleQuiz() {
  return { status: 200, body: getPublicQuiz() };
}

/** POST /api/submit — score server-side, enforce one attempt, store, notify. */
export async function handleSubmit(payload, cfg) {
  payload = payload || {};
  // Normalise before the duplicate check, otherwise the same person re-typing
  // "9123 4567" as "91234567" counts as a new entry and gets a second score.
  // The stored value is normalised too, so the unique index sees one key.
  const name = String(payload.name || '').trim().replace(/\s+/g, ' ');
  const rawPhone = String(payload.number || '').trim();
  const digits = rawPhone.replace(/\D/g, '');
  const phone = digits || rawPhone.replace(/\s+/g, '');
  const cluster = String(payload.cluster || '').trim();
  const answers = Array.isArray(payload.answers) ? payload.answers : [];
  const timeMs = Number(payload.timeMs) || 0;

  if (!name || !phone || !cluster) {
    return { status: 400, body: { ok: false, error: 'Missing name, phone or cluster.' } };
  }

  let db;
  try {
    db = makeDb(cfg.d1);
  } catch (e) {
    console.error('config error:', e);
    return { status: 500, body: { ok: false, error: 'The quiz is not fully set up yet. Please tell the organiser.' } };
  }

  try {
    if (await db.personExists(name, phone)) {
      return { status: 200, body: { ok: false, alreadySubmitted: true } };
    }

    const score = scoreSubmission(answers);
    const outcome = await db.insertResult({
      name: name, phone: phone, cluster: cluster,
      score: score, total: TOTAL, time_ms: timeMs, answers: answers
    });
    if (outcome === 'duplicate') {
      return { status: 200, body: { ok: false, alreadySubmitted: true } };
    }

    // Telegram must never break a submission that already succeeded.
    try {
      await updateLeaderboard(db, cfg);
    } catch (e) {
      console.error('Telegram update failed:', e);
    }

    return { status: 200, body: { ok: true } };
  } catch (e) {
    console.error('submit failed:', e);
    return { status: 500, body: { ok: false, error: 'Something went wrong while saving your result. Please try again.' } };
  }
}

/** GET /api/leaderboard?key=… — host-only ranked standings. */
export async function handleLeaderboard(key, cfg) {
  // Distinguish "not configured" from "wrong key" so the host can tell which
  // one they are looking at. Neither message reveals the key itself.
  if (!cfg.hostKey) {
    return {
      status: 503,
      body: { ok: false, error: 'HOST_KEY is not set on the server. Add it in the Worker settings, then reload.' }
    };
  }
  if (String(key || '') !== String(cfg.hostKey)) {
    return {
      status: 403,
      body: { ok: false, error: 'That host key does not match the one set on the server.' }
    };
  }
  try {
    const db = makeDb(cfg.d1);
    const rows = await db.listRanked(null);
    const players = (rows || []).map(function (p, i) {
      return {
        rank: i + 1, name: p.name, cluster: p.cluster,
        score: p.score, timeSec: Math.round(p.time_ms / 100) / 10
      };
    });
    return {
      status: 200,
      body: {
        ok: true,
        total: TOTAL,
        updated: new Date().toISOString().substr(11, 8) + ' UTC',
        count: players.length,
        players: players
      }
    };
  } catch (e) {
    console.error('leaderboard failed:', e);
    return { status: 500, body: { ok: false, error: 'Could not load the scoreboard.' } };
  }
}

/** GET /api/test-telegram?key=… — host-only connectivity check. */
export async function handleTestTelegram(key, cfg) {
  if (!cfg.hostKey || String(key || '') !== String(cfg.hostKey)) {
    return { status: 403, body: { ok: false, error: 'Invalid host key.' } };
  }
  try {
    return { status: 200, body: await testMessage(cfg) };
  } catch (e) {
    return { status: 500, body: { ok: false, error: String(e) } };
  }
}
