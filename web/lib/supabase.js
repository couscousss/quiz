/**
 * Supabase client (server-side only). Uses the SERVICE ROLE key, which must
 * never be exposed to the browser — it lives only in Vercel environment vars.
 */
const { createClient } = require('@supabase/supabase-js');

let client = null;

function db() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Supabase not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    }
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

module.exports = { db };
