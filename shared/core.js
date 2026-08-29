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
import { sgTimeHHMMSS } from './time.js';

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
        updated: sgTimeHHMMSS() + ' SGT',
        count: players.length,
        players: players
      }
    };
  } catch (e) {
    console.error('leaderboard failed:', e);
    return { status: 500, body: { ok: false, error: 'Could not load the scoreboard.' } };
  }
}

/** Shared host-key gate for the host-only endpoints. */
function hostGate(key, cfg) {
  if (!cfg.hostKey) {
    return { status: 503, body: { ok: false, error: 'HOST_KEY is not set on the server.' } };
  }
  if (String(key || '') !== String(cfg.hostKey)) {
    return { status: 403, body: { ok: false, error: 'That host key does not match the one set on the server.' } };
  }
  return null;
}

/** GET /api/results?key=… — full entries for the host's manage view. */
export async function handleResults(key, cfg) {
  const blocked = hostGate(key, cfg);
  if (blocked) return blocked;
  try {
    const db = makeDb(cfg.d1);
    const rows = await db.listAll();
    return {
      status: 200,
      body: {
        ok: true,
        total: TOTAL,
        updated: sgTimeHHMMSS() + ' SGT',
        count: rows.length,
        entries: rows.map(function (r, i) {
          return {
            rank: i + 1, id: r.id, name: r.name, phone: r.phone,
            cluster: r.cluster, score: r.score,
            timeSec: Math.round(r.time_ms / 100) / 10
          };
        })
      }
    };
  } catch (e) {
    console.error('results failed:', e);
    return { status: 500, body: { ok: false, error: 'Could not load the entries.' } };
  }
}

/**
 * POST /api/delete?key=… — remove one entry, or all of them.
 * POST rather than GET so a link preview or prefetch can never delete anything.
 * Clearing everything additionally requires confirm === 'DELETE'.
 */
export async function handleDelete(key, payload, cfg) {
  const blocked = hostGate(key, cfg);
  if (blocked) return blocked;
  payload = payload || {};
  try {
    const db = makeDb(cfg.d1);

    if (payload.all === true) {
      if (String(payload.confirm || '') !== 'DELETE') {
        return { status: 400, body: { ok: false, error: 'Clearing everything needs confirm: "DELETE".' } };
      }
      const removed = await db.deleteAll();
      return { status: 200, body: { ok: true, removed: removed } };
    }

    const id = Number(payload.id);
    if (!id || !isFinite(id)) {
      return { status: 400, body: { ok: false, error: 'Provide an entry id, or all: true.' } };
    }
    const removed = await db.deleteById(id);
    return { status: 200, body: { ok: true, removed: removed } };
  } catch (e) {
    console.error('delete failed:', e);
    return { status: 500, body: { ok: false, error: 'Could not delete. Please try again.' } };
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
