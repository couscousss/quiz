# The Albatross Files — self-hosted version

Same quiz as the Google Apps Script version, but hosted off Google — so it has a
clean URL, no "created by a Google user" notice, no multi-account or incognito
problems, and it opens everywhere including WhatsApp's in-app browser.

Deploys to **Cloudflare Pages** (recommended) or **Vercel**. Data lives in
**Supabase** (Postgres).

## Layout — and why it matters

| Path | What it is |
| --- | --- |
| `public/` | **the only folder published to the web** — just the two pages |
| `public/index.html` | participant quiz |
| `public/board.html` | host live scoreboard |
| `functions/api/*` | Cloudflare Pages Functions (must live at the project root) |
| `api/*` | Vercel serverless handlers |
| `shared/*` | quiz content, answer key, scoring, DB and Telegram — **never published** |
| `schema.sql` | database tables |

> **The answer key must stay out of `public/`.** Every file inside the published
> directory becomes a public URL, so putting `shared/quiz.js` there would let
> anyone download all ten answers before taking the quiz. That is why `shared/`,
> `api/` and `functions/` sit outside `public/`.

This layout is also each platform's own convention: Cloudflare serves `public/`
and runs `functions/`; Vercel serves `public/` and runs `api/`.

**No npm dependencies** — everything uses plain `fetch`, so builds are fast and
cannot break on install. Multi-select is full-credit-only. Ranking is score
descending, then time ascending (fastest wins ties).

---

## 1. Database — Supabase (~10 min)

1. Create a free account at [supabase.com](https://supabase.com) → **New project**.
   Any name/password/region; wait ~2 min while it provisions.
2. Sidebar → **SQL Editor** → **New query** → paste all of [`schema.sql`](./schema.sql)
   → **Run**. "Success. No rows returned" is the expected result.
3. Sidebar → **Project Settings → API**. You need two values:
   - **Project URL** — e.g. `https://abcd.supabase.co`
   - **`service_role`** secret key (reveal it) — *not* the `anon` key.

> The `service_role` key is a full-access database key. Paste it only into your
> hosting provider's environment variables. Never commit it or share it.

## 2. Hosting — Cloudflare Pages (~10 min)

1. Sign in at [dash.cloudflare.com](https://dash.cloudflare.com) (free account).
2. **Compute (Workers & Pages)** → **Create** → **Pages** tab →
   **Connect to Git** → authorise GitHub → pick this repository.
3. Build settings:
   - **Framework preset:** `None`
   - **Build command:** *leave empty*
   - **Build output directory:** `public`
   - **Root directory:** leave at the default (the repository root), so
     Cloudflare finds `functions/`.
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
Cloudflare Pages → your project → **Custom domains** → **Set up a domain**.

## 2b. Hosting — Vercel (alternative)

Import the repo with the default root directory and add the same environment
variables. Vercel serves `public/` and runs `api/` with no extra configuration.

---

## Editing the quiz
- **Questions, answers, clusters:** `shared/quiz.js`
- **Participant look & feel:** `public/index.html` · **Host board:** `public/board.html`

Push to GitHub → the site rebuilds automatically in about a minute. There is no
"publish a new version" step (unlike Apps Script).

## Telegram (optional)
Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` as environment variables (never in
code), then visit `/api/test-telegram?key=YOUR_HOST_KEY` — it posts a "bot is
connected" message to the group. After that, each submission updates a single
self-editing leaderboard message with medals and an "Updated" timestamp.

## Viewing and exporting results
Supabase → **Table Editor → results** lists every submission and exports to CSV.
Or use the live host scoreboard link above.

## Checks worth running after deploying
1. `/` shows the quiz start screen.
2. `/api/quiz` returns JSON starting `{"clusters":[…` — proves the functions run.
3. `/shared/quiz.js` returns **404** — proves the answer key is not published.
4. `/board.html?key=WRONG` shows the locked message, not scores.

## Troubleshooting
| Symptom | Cause |
| --- | --- |
| `404` on the site root | Build output directory isn't `public` |
| Site loads but `/api/quiz` is `404` | **Root directory** was changed — it must stay at the repo root so `functions/` is found |
| Quiz loads but submitting errors | `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` missing or wrong — set them, then redeploy |
| Scoreboard says "Check the host key" | `key=` in the URL doesn't match `HOST_KEY` |
| Telegram silent | Token/chat id unset (skipped by design), or the bot isn't in the group |
