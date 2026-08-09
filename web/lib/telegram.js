/**
 * Telegram live leaderboard — a single message that edits itself.
 * All values come from environment variables; if the token/chat are unset,
 * everything here is a safe no-op so the quiz still works without Telegram.
 */
const { TOTAL } = require('./quiz');

function configured() {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  const c = process.env.TELEGRAM_CHAT_ID;
  return !!(t && c && t.indexOf('PASTE') !== 0 && String(c).indexOf('PASTE') !== 0);
}

async function tg(method, params) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const r = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
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
  return new Date().toISOString().substr(11, 8); // UTC HH:MM:SS
}

/**
 * Rebuild and push the leaderboard. Reads the current standings from Supabase,
 * edits the stored message if there is one, otherwise sends a new one and
 * stores its id in the app_meta table.
 */
async function updateLeaderboard(supabase) {
  if (!configured()) return;
  const chat = process.env.TELEGRAM_CHAT_ID;
  const size = Number(process.env.TELEGRAM_LEADERBOARD_SIZE) || 10;

  const { data } = await supabase
    .from('results')
    .select('name,cluster,score,time_ms')
    .order('score', { ascending: false })
    .order('time_ms', { ascending: true })
    .limit(size);

  const medals = ['🥇', '🥈', '🥉'];
  const lines = ['*🗂 The Albatross Files — Leaderboard*', ''];
  if (!data || !data.length) {
    lines.push('_No submissions yet._');
  } else {
    data.forEach(function (p, i) {
      const badge = i < 3 ? medals[i] : (i + 1) + '.';
      const t = Math.round(p.time_ms / 100) / 10;
      lines.push(badge + ' ' + escapeMd(p.name) + ' (' + escapeMd(p.cluster) + ') — ' + p.score + '/' + TOTAL + ' in ' + t + 's');
    });
  }
  lines.push('', '_Updated ' + hhmmss() + ' UTC_');
  const text = lines.join('\n');

  // Stored message id (so the same message edits itself).
  const { data: meta } = await supabase.from('app_meta').select('value').eq('key', 'tg_msg').limit(1);
  const msgId = meta && meta.length ? meta[0].value : null;

  if (msgId) {
    const edited = await tg('editMessageText', {
      chat_id: chat, message_id: Number(msgId), text: text,
      parse_mode: 'Markdown', disable_web_page_preview: true
    });
    if (edited && edited.ok) return;
    // else fall through and send a fresh message
  }
  const sent = await tg('sendMessage', {
    chat_id: chat, text: text, parse_mode: 'Markdown', disable_web_page_preview: true
  });
  if (sent && sent.ok && sent.result) {
    await supabase.from('app_meta').upsert({ key: 'tg_msg', value: String(sent.result.message_id) });
  }
}

/** Simple connectivity test used by /api/test-telegram. */
async function testMessage() {
  if (!configured()) return { ok: false, error: 'Telegram not configured (set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID).' };
  return tg('sendMessage', {
    chat_id: process.env.TELEGRAM_CHAT_ID,
    text: '✅ The Albatross Files bot is connected. ' + hhmmss() + ' UTC'
  });
}

module.exports = { updateLeaderboard, testMessage, configured };
