/* The Albatross Files — database schema for Cloudflare D1 (SQLite).
   Run once: dashboard → Storage & Databases → D1 → your database → Console.

   Block comments are used deliberately: pasting into the D1 console can strip
   line breaks, and with `--` comments that would swallow every statement on the
   line and fail with "Requests without any query are not supported". */

/* One row per submission. */
CREATE TABLE IF NOT EXISTS results (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL DEFAULT (datetime('now')), name TEXT NOT NULL, phone TEXT NOT NULL, cluster TEXT NOT NULL, score INTEGER NOT NULL, total INTEGER NOT NULL, time_ms INTEGER NOT NULL, answers TEXT);

/* One attempt per person (Name + Phone, case-insensitive). The race-proof
   backstop when several people submit at the same moment. */
CREATE UNIQUE INDEX IF NOT EXISTS results_person_unique ON results (lower(name), lower(phone));

/* Ranking is score descending, then time ascending (fastest wins ties). */
CREATE INDEX IF NOT EXISTS results_ranking ON results (score DESC, time_ms ASC);

/* Small key/value table (remembers the Telegram leaderboard message id). */
CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT);
