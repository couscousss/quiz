/**
 * GET /api/leaderboard?key=HOST_KEY — ranked standings for the host board.
 * Guarded by HOST_KEY so participants can't read scores.
 * Ranking: score DESC, then time ASC (fastest wins ties).
 */
const { db } = require('../lib/supabase');
const { TOTAL } = require('../lib/quiz');

module.exports = async (req, res) => {
  const key = (req.query && req.query.key) || '';
  if (String(key) !== String(process.env.HOST_KEY || '')) {
    res.status(403).json({ ok: false, error: 'Invalid host key.' });
    return;
  }
  try {
    const supabase = db();
    const { data, error } = await supabase
      .from('results').select('name,cluster,score,time_ms')
      .order('score', { ascending: false })
      .order('time_ms', { ascending: true });
    if (error) throw error;

    const players = (data || []).map(function (p, i) {
      return { rank: i + 1, name: p.name, cluster: p.cluster, score: p.score, timeSec: Math.round(p.time_ms / 100) / 10 };
    });
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      ok: true,
      total: TOTAL,
      updated: new Date().toISOString().substr(11, 8) + ' UTC',
      count: players.length,
      players: players
    });
  } catch (e) {
    console.error('leaderboard failed:', e);
    res.status(500).json({ ok: false, error: 'Could not load the scoreboard.' });
  }
};
