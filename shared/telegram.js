/**
 * Telegram live leaderboard — a single message that edits itself.
 * Dependency-free (plain fetch) so it runs on Cloudflare and Node alike.
 * Every function is a safe no-op when the token/chat id are not configured.
 */
import { TOTAL } from './quiz.js';

export function telegramConfigured(cfg) {
  const t = cfg && cfg.botToken;
  const c = cfg && cfg.chatId;
  return !!(t && c && String(t).indexOf('PASTE') !== 0 && String(c).indexOf('PASTE') !== 0);
}

async function tg(botToken, method, params) {
  const r = await fetch('https://api.telegram.org/bot' + botToken + '/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  return r.json();
}

function escapeMd(s) {
  return String(s).replace(/([_*\[\]`])/g, '\\$1');
}

function hhmmss() {
  return new Date().toISOString().substr(11, 8);
}

function renderText(rows) {
  const medals = ['🥇', '🥈', '🥉'];
  const lines = ['*🗂 The Albatross Files — Leaderboard*', ''];
  if (!rows || !rows.length) {
    lines.push('_No submissions yet._');
  } else {
    rows.forEach(function (p, i) {
      const badge = i < 3 ? medals[i] : (i + 1) + '.';
      const t = Math.round(p.time_ms / 100) / 10;
      lines.push(badge + ' ' + escapeMd(p.name) + ' (' + escapeMd(p.cluster) + ') — ' +
        p.score + '/' + TOTAL + ' in ' + t + 's');
    });
  }
  // The "Updated" line guarantees the text always changes, which avoids
  // Telegram's "message is not modified" error on edit.
  lines.push('', '_Updated ' + hhmmss() + ' UTC_');
  return lines.join('\n');
}

/**
 * Rebuild and push the leaderboard: edit the stored message if there is one,
 * otherwise send a fresh one and remember its id.
 */
export async function updateLeaderboard(db, cfg) {
  if (!telegramConfigured(cfg)) return;
  const size = Number(cfg.leaderboardSize) || 10;
  const rows = await db.listRanked(size);
  const text = renderText(rows);

  const msgId = await db.getMeta('tg_msg');
  if (msgId) {
    const edited = await tg(cfg.botToken, 'editMessageText', {
      chat_id: cfg.chatId, message_id: Number(msgId), text: text,
      parse_mode: 'Markdown', disable_web_page_preview: true
    });
    if (edited && edited.ok) return;
    // Only start a fresh message when the old one is genuinely gone. Any other
    // failure (rate limiting during a burst of submissions, a transient error)
    // must NOT fall through, or the group gets spammed with a new leaderboard
    // per submission at exactly the busiest moment.
    const why = (edited && edited.description ? String(edited.description) : '').toLowerCase();
    const messageIsGone = why.indexOf('not found') !== -1 ||
                          why.indexOf("can't be edited") !== -1 ||
                          why.indexOf('message to edit') !== -1;
    // "message is not modified" means the board is already correct — nothing to do.
    if (!messageIsGone) return;
  }
  const sent = await tg(cfg.botToken, 'sendMessage', {
    chat_id: cfg.chatId, text: text, parse_mode: 'Markdown', disable_web_page_preview: true
  });
  if (sent && sent.ok && sent.result) {
    await db.setMeta('tg_msg', sent.result.message_id);
  }
}

/** One-off connectivity check used by /api/test-telegram. */
export async function testMessage(cfg) {
  if (!telegramConfigured(cfg)) {
    return { ok: false, error: 'Telegram not configured (set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID).' };
  }
  return tg(cfg.botToken, 'sendMessage', {
    chat_id: cfg.chatId,
    text: '✅ The Albatross Files bot is connected. ' + hhmmss() + ' UTC'
  });
}
