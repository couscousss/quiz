# The Albatross Files — self-hosted version (Vercel + Supabase)

Same quiz as the Google Apps Script version, but hosted off Google — so it has a
clean URL, no "created by a Google user" notice, no multi-account/incognito
issues, and it opens in every browser including WhatsApp's in-app browser.

- **Frontend:** `index.html` (participant quiz) + `board.html` (host scoreboard).
- **Backend:** serverless functions in `/api` (Vercel).
- **Database:** Supabase (Postgres) — replaces the Google Sheet.

Correct answers live only in `lib/quiz.js` on the server and are never sent to
the browser. Scoring is full-credit-only for multi-select. Ranking is score
descending, then time ascending (fastest wins ties).

---

## Setup (one time)

### 1. Supabase (the database)
1. Create a free account at [supabase.com](https://supabase.com) → **New project**.
   Pick any name/password/region; wait ~2 min for it to provision.
2. Left sidebar → **SQL Editor** → **New query** → paste the contents of
   [`schema.sql`](./schema.sql) → **Run**. This creates the `results` and
   `app_meta` tables.
3. Left sidebar → **Project Settings → API**. Copy two values (you'll paste them
   into Vercel next):
   - **Project URL** → `SUPABASE_URL`
   - **service_role** secret key → `SUPABASE_SERVICE_ROLE_KEY`
     *(the `service_role` key, not `anon`. Keep it secret — it's server-only.)*

### 2. Vercel (the hosting)
1. Create a free account at [vercel.com](https://vercel.com), signing in with GitHub.
2. **Add New → Project** → import this GitHub repo.
3. **Set the Root Directory to `web`** (there's a "Root Directory" field on the
   import screen — click **Edit** and choose the `web` folder). This is important:
   the app lives in `web/`, not the repo root.
4. Expand **Environment Variables** and add these:

   | Name | Value |
   | --- | --- |
   | `SUPABASE_URL` | your Project URL from step 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | your service_role key from step 1 |
   | `HOST_KEY` | a secret word for your scoreboard (e.g. `trainingteam2026`) |
   | `TELEGRAM_BOT_TOKEN` | *(optional)* your bot token — omit to disable Telegram |
   | `TELEGRAM_CHAT_ID` | *(optional)* your group id, e.g. `-1001234567890` |
   | `TELEGRAM_LEADERBOARD_SIZE` | *(optional)* default 10 |

5. **Deploy.** After ~1 minute you'll get a URL like
   `https://your-project.vercel.app`.

### 3. Your links
- **Participant quiz** (share this): `https://your-project.vercel.app/`
- **Host scoreboard** (keep private): `https://your-project.vercel.app/board.html?key=YOUR_HOST_KEY`

That participant link works for everyone — no Google sign-in, no account issues,
no warning screen — in any browser or messaging app.

---

## Editing the quiz
- **Questions / answers / clusters:** edit `web/lib/quiz.js`.
- **Look & feel:** edit `web/index.html` (participant) or `web/board.html` (host).
- Push to GitHub → Vercel **auto-deploys** in ~1 minute. No manual "publish a new
  version" step (unlike Apps Script). The live URL updates itself.

## Telegram (optional)
Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in Vercel's environment variables
(never in the code). To test the connection, open in your browser:
`https://your-project.vercel.app/api/test-telegram?key=YOUR_HOST_KEY` — it posts a
"bot is connected" message to your group. On each submission, a single leaderboard
message updates itself with 🥇🥈🥉 and an "Updated" timestamp.

## Viewing / exporting results
Supabase → **Table Editor → results** shows every submission and lets you sort or
export to CSV. Or use the live host scoreboard link above.
