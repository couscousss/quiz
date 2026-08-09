/**
 * POST /api/submit — score a submission server-side, enforce one-attempt,
 * store it, and refresh the Telegram leaderboard. Answers never reach here
 * with a key; scoring happens against the server-only answer key.
 */
const { scoreSubmission, TOTAL } = require('../lib/quiz');
const { db } = require('../lib/supabase');
const { updateLeaderboard } = require('../lib/telegram');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const name = String(body.name || '').trim();
    const phone = String(body.number || '').trim();
    const cluster = String(body.cluster || '').trim();
    const answers = Array.isArray(body.answers) ? body.answers : [];
    const timeMs = Number(body.timeMs) || 0;

    if (!name || !phone || !cluster) {
      res.status(400).json({ ok: false, error: 'Missing name, phone or cluster.' });
      return;
    }

    const supabase = db();

    // One attempt per Name + Phone (case-insensitive).
    const { data: existing } = await supabase
      .from('results').select('id')
      .ilike('name', name).ilike('phone', phone).limit(1);
    if (existing && existing.length) {
      res.status(200).json({ ok: false, alreadySubmitted: true });
      return;
    }

    const score = scoreSubmission(answers);

    const { error: insErr } = await supabase.from('results').insert({
      name: name, phone: phone, cluster: cluster,
      score: score, total: TOTAL, time_ms: timeMs, answers: answers
    });
    if (insErr) {
      // 23505 = unique-index violation → a concurrent duplicate submission.
      if (insErr.code === '23505') {
        res.status(200).json({ ok: false, alreadySubmitted: true });
        return;
      }
      throw insErr;
    }

    // Refresh Telegram (no-op if not configured). Never fail the user for this.
    try { await updateLeaderboard(supabase); } catch (e) { console.error('Telegram update failed:', e); }

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('submit failed:', e);
    res.status(500).json({ ok: false, error: 'Something went wrong while saving your result. Please try again.' });
  }
};
