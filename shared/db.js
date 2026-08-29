/**
 * Data access for Cloudflare D1 (SQLite).
 *
 * D1 is Cloudflare's own database, bound to the Pages project as `env.DB` —
 * there is no second account, no URL and no API key to copy anywhere.
 */

/** Wrap a D1 binding in the small interface the rest of the app uses. */
export function makeDb(D1) {
  if (!D1) {
    throw new Error('D1 is not bound. Check the d1_databases entry named DB in wrangler.jsonc.');
  }

  return {
    /**
     * Has this Name + Phone already submitted? Case-insensitive.
     * A friendly pre-check; the unique index is the authoritative guard
     * against two people submitting at the same instant (see insertResult).
     */
    async personExists(name, phone) {
      const r = await D1
        .prepare('SELECT id FROM results WHERE lower(name) = lower(?1) AND lower(phone) = lower(?2) LIMIT 1')
        .bind(name, phone)
        .all();
      return !!(r && r.results && r.results.length);
    },

    /**
     * Insert one submission.
     * @return {'ok'|'duplicate'} 'duplicate' when the unique index rejects it.
     */
    async insertResult(row) {
      try {
        await D1
          .prepare('INSERT INTO results (name, phone, cluster, score, total, time_ms, answers) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
          .bind(row.name, row.phone, row.cluster, row.score, row.total, row.time_ms, JSON.stringify(row.answers || []))
          .run();
        return 'ok';
      } catch (e) {
        const msg = String((e && e.message) || e).toUpperCase();
        if (msg.indexOf('UNIQUE') !== -1 || msg.indexOf('CONSTRAINT') !== -1) return 'duplicate';
        throw e;
      }
    },

    /** Standings: score DESC, then time ASC (fastest wins ties). */
    async listRanked(limit) {
      const sql = 'SELECT name, cluster, score, time_ms FROM results ORDER BY score DESC, time_ms ASC'
        + (limit ? ' LIMIT ?1' : '');
      const stmt = limit
        ? D1.prepare(sql).bind(Number(limit))
        : D1.prepare(sql);
      const r = await stmt.all();
      return (r && r.results) || [];
    },

    /** Small key/value store (used for the Telegram message id). */
    async getMeta(key) {
      const r = await D1.prepare('SELECT value FROM app_meta WHERE key = ?1 LIMIT 1').bind(key).all();
      const rows = (r && r.results) || [];
      return rows.length ? rows[0].value : null;
    },

    async setMeta(key, value) {
      try {
        await D1
          .prepare('INSERT INTO app_meta (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
          .bind(key, String(value))
          .run();
      } catch (e) {
        // Losing the stored message id would make every later submission post a
        // brand-new Telegram leaderboard instead of editing the existing one.
        console.error('setMeta failed:', e);
      }
    }
  };
}
