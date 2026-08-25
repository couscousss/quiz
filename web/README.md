# The Albatross Files — self-hosted version

Same quiz as the Google Apps Script version, but hosted off Google — so it has a
clean URL, no "created by a Google user" notice, no multi-account or incognito
problems, and it opens everywhere including WhatsApp's in-app browser.

Deploys to **Cloudflare Pages** (recommended) or **Vercel**. Data lives in
**Supabase** (Postgres).

| | |
| --- | --- |
| `web/index.html` | participant quiz |
| `web/board.html` | host live scoreboard |
| `functions/api/*` | Cloudflare Pages Functions — **at the repo root**, because Cloudflare requires the `functions` directory at the project root and *not* inside the static output directory |
| `web/api/*` | Vercel serverless handlers |
| `web/shared/*` | the shared core both platforms call (quiz + scoring + DB + Telegram) |
| `web/schema.sql` | database tables |

**No npm dependencies** — everything uses plain `fetch`, so builds are fast and
can't break on install. The answer key lives only in `shared/quiz.js` on the
server and is never sent to the browser. Multi-select is full-credit-only.
Ranking is score descending, then time ascending (fastest wins ties).

---

## 1. Database — Supabase (~10 min)

1. Create a free account at [supabase.com](https://supabase.com) → **New project**.
   Any name/password/region; wait ~2 min while it provisions.
2. Sidebar → **SQL Editor** → **New query** → paste all of [`schema.sql`](./schema.sql)
   → **Run**. "Success. No rows returned" is the expected result.
3. Sidebar → **Project Settings → API**. You need two values:
   - **Project URL** → e.g. `https://abcd.supabase.co`
   - **`service_role`** secret key (reveal it) — *not* the `anon` key.

> The `service_role` key is a full-access database key. Paste it only into your
> hosting provider's environment variables. Never commit it or share it.

## 2. Hosting — Cloudflare Pages (~10 min)

1. Sign in at [dash.cloudflare.com](https://dash.cloudflare.com) (free account).
2. **Compute (Workers & Pages)** → **Create** → **Pages** tab →
   **Connect to Git** → authorise GitHub → pick this repository.
3. On the build-settings screen:
   - **Framework preset:** `None`
   - **Build command:** *leave empty*
   - **Build output directory:** `web`
   - **Root directory:** leave as the default (the repository root). The
     `functions/` folder must sit at the project root for the `/api/*` routes to
     exist, which is why it is not inside `web/`.
4. Expand **Environment variables (advanced)** and add:

   | Name | Value |
   | --- | --- |
   | `SUPABASE_URL` | your Project URL from step 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | your `service_role` key |
   | `HOST_KEY` | a secret word for your scoreboard link |
   | `TELEGRAM_BOT_TOKEN` | *(optional)* bot token — omit to disable Telegram |
   | `TELEGRAM_CHAT_ID` | *(optional)* group id, e.g. `-1001234567890` |
   | `TELEGRAM_LEADERBOARD_SIZE` | *(optional)* default 10 |

5. **Save and Deploy.** You get a URL like `https://your-project.pages.dev`.

> Changing an environment variable later does **not** affect the running site
> until you redeploy: **Deployments → ⋯ → Retry deployment**.

### Your two links
- **Participant quiz** (share this): `https://your-project.pages.dev/`
- **Host scoreboard** (keep private): `https://your-project.pages.dev/board.html?key=YOUR_HOST_KEY`

### Custom domain (optional)
Cloudflare Pages → your project → **Custom domains** → **Set up a domain**. If the
domain is already on Cloudflare, DNS is configured automatically.

## 2b. Hosting — Vercel (alternative)

Import the repo, set **Root Directory** to `web`, add the same environment
variables, deploy. The handlers in `api/` mirror the Cloudflare ones.

---

## Editing the quiz
- **Questions, answers, clusters:** `shared/quiz.js`
- **Participant look & feel:** `index.html` · **Host board:** `board.html`

Push to GitHub → the site rebuilds automatically in about a minute. There is no
"publish a new version" step (unlike Apps Script).

## Telegram (optional)
Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` as environment variables (never in
code), then visit `/api/test-telegram?key=YOUR_HOST_KEY` — it posts a "bot is
connected" message to the group. After that, each submission updates a single
self-editing leaderboard message with 🥇🥈🥉 and an "Updated" timestamp.

## Viewing and exporting results
Supabase → **Table Editor → results** lists every submission and exports to CSV.
Or use the live host scoreboard link above.

## Troubleshooting
| Symptom | Cause |
| --- | --- |
| `404` on the site root | Build output directory isn't `web` |
| Site loads but `/api/quiz` is `404` | The `functions/` directory isn't at the project root — check that **Root directory** is the repo root, not `web` |
| Quiz loads but submitting errors | `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` missing or wrong — set them, then redeploy |
| Scoreboard says "Check the host key" | `key=` in the URL doesn't match the `HOST_KEY` variable |
| Telegram silent | Token/chat id unset (by design it's skipped), or the bot isn't in the group |
