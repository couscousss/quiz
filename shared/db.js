/**
 * Supabase access over its REST (PostgREST) API using plain `fetch`.
 *
 * Deliberately dependency-free so the exact same code runs on Cloudflare
 * Workers/Pages and on Node (Vercel) with no bundling or npm install.
 *
 * The service-role key is server-only — it is read from platform environment
 * variables and never reaches the browser.
 */

/** Build a small data-access object bound to one Supabase project. */
export function makeDb(supabaseUrl, serviceKey) {
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  const base = String(supabaseUrl).replace(/\/+$/, '') + '/rest/v1';
  const headers = {
    apikey: serviceKey,
    Authorization: 'Bearer ' + serviceKey,
    'Content-Type': 'application/json'
  };

  async function req(path, init) {
    const res = await fetch(base + path, Object.assign({ headers }, init || {}));
    return res;
  }

  return {
    /**
     * Has this Name + Phone already submitted? Case-insensitive.
     * A friendly pre-check only — the unique index in schema.sql is the
     * authoritative guard against races (see insertResult).
     */
    async personExists(name, phone) {
      // `%`, `_` and `*` are all treated as wildcards by PostgREST's ilike
      // (it rewrites `*` to `%`), and encodeURIComponent leaves `*` alone. If a
      // value contains one, skip the pre-check — matching loosely could tell a
      // different person they had already submitted — and let the unique index
      // do the work instead.
      if (/[%_*]/.test(name) || /[%_*]/.test(phone)) return false;
      const q = '/results?select=id'
        + '&name=ilike.' + encodeURIComponent(name)
        + '&phone=ilike.' + encodeURIComponent(phone)
        + '&limit=1';
      const res = await req(q, { method: 'GET' });
      if (!res.ok) throw new Error('Supabase read failed (' + res.status + '): ' + (await res.text()));
      const rows = await res.json();
      return Array.isArray(rows) && rows.length > 0;
    },

    /**
     * Insert one submission.
     * @return {'ok'|'duplicate'} 'duplicate' when the unique index rejects it.
     */
    async insertResult(row) {
      const res = await req('/results', {
        method: 'POST',
        headers: Object.assign({}, headers, { Prefer: 'return=minimal' }),
        body: JSON.stringify(row)
      });
      if (res.status === 409) return 'duplicate';      // unique-index violation
      if (!res.ok) {
        const body = await res.text();
        if (body.indexOf('23505') !== -1) return 'duplicate';
        throw new Error('Supabase insert failed (' + res.status + '): ' + body);
      }
      return 'ok';
    },

    /** Standings: score DESC, then time ASC (fastest wins ties). */
    async listRanked(limit) {
      let q = '/results?select=name,cluster,score,time_ms'
        + '&order=score.desc,time_ms.asc';
      if (limit) q += '&limit=' + Number(limit);
      const res = await req(q, { method: 'GET' });
      if (!res.ok) throw new Error('Supabase read failed (' + res.status + '): ' + (await res.text()));
      return res.json();
    },

    /** Small key/value store (used for the Telegram message id). */
    async getMeta(key) {
      const res = await req('/app_meta?select=value&key=eq.' + encodeURIComponent(key) + '&limit=1', { method: 'GET' });
      if (!res.ok) return null;
      const rows = await res.json();
      return rows && rows.length ? rows[0].value : null;
    },

    async setMeta(key, value) {
      // app_meta.key is the primary key, so PostgREST defaults the upsert
      // conflict target to it and no on_conflict param is needed.
      const res = await req('/app_meta', {
        method: 'POST',
        headers: Object.assign({}, headers, {
          Prefer: 'resolution=merge-duplicates,return=minimal'
        }),
        body: JSON.stringify({ key: key, value: String(value) })
      });
      // Surface failures: silently losing the stored message id would make
      // every later submission post a new Telegram leaderboard.
      if (!res.ok) {
        console.error('Supabase setMeta failed (' + res.status + '): ' + (await res.text()));
      }
    }
  };
}
