# The Albatross Files — Cloudflare setup

The quiz runs entirely on **Cloudflare**: Pages hosts the site, Pages Functions
score the answers, and **D1** (Cloudflare's own database) stores the results.
One account, no API keys to copy anywhere.

It has none of the Google Apps Script problems: a clean URL, no sign-in, no
"created by a Google user" notice, no multi-account or incognito issues, and it
opens everywhere including WhatsApp's in-app browser.

## Layout — and why it matters

| Path | What it is |
| --- | --- |
| `public/` | **the only folder published to the web** |
| `public/index.html` | participant quiz |
| `public/board.html` | host live scoreboard |
| `functions/api/*` | Pages Functions — must sit at the project root, *not* inside `public/` |
| `shared/*` | quiz content, answer key, scoring, database, Telegram — **never published** |
| `schema.sql` | database tables |

> **The answer key must stay out of `public/`.** Every file in the published
> folder becomes a public URL, so putting `shared/quiz.js` there would let anyone
> download all ten answers before taking the quiz.

Multi-select questions are full-credit-only. Ranking is score descending, then
time ascending, so the fastest wins a tie — which is what decides the top three.

---

## 1. Create the database (~5 min)

1. Sign in at [dash.cloudflare.com](https://dash.cloudflare.com).
2. **Storage & Databases → D1 → Create database.** Name it `albatross` → **Create**.
3. Open the database → **Console** tab → paste all of [`schema.sql`](./schema.sql)
   → **Execute**. It creates the `results` and `app_meta` tables.

## 2. Create the site (~5 min)

1. **Compute (Workers & Pages) → Create → Pages tab → Connect to Git.**
2. Authorise GitHub and pick this repository.
3. Build settings:
   - **Framework preset:** `None`
   - **Build command:** *leave empty*
   - **Build output directory:** `public`
   - **Root directory:** leave at the default (the repository root), so
     Cloudflare finds `functions/`.
4. **Environment variables** — add:

   | Name | Value |
   | --- | --- |
   | `HOST_KEY` | a secret word for your scoreboard link |
   | `TELEGRAM_BOT_TOKEN` | *(optional)* bot token — omit to disable Telegram |
   | `TELEGRAM_CHAT_ID` | *(optional)* group id, e.g. `-1001234567890` |
   | `TELEGRAM_LEADERBOARD_SIZE` | *(optional)* default 10 |

5. **Save and Deploy.**

## 3. Connect the database to the site (required)

The site cannot save anything until the database is bound to it.

1. Your Pages project → **Settings → Bindings** (older dashboards:
   *Functions → D1 database bindings*) → **Add → D1 database**.
2. **Variable name:** `DB` (exactly this — the code looks for `env.DB`).
   **D1 database:** `albatross`. **Save.**
3. **Deployments → ⋯ → Retry deployment**, so the running site picks it up.

> Any change to bindings or environment variables needs a redeploy before the
> live site sees it.

### Your two links
- **Participant quiz** (share this): `https://your-project.pages.dev/`
- **Host scoreboard** (keep private): `https://your-project.pages.dev/board.html?key=YOUR_HOST_KEY`

### Custom domain (optional)
Pages project → **Custom domains → Set up a domain**.

---

## Checks worth running after deploying
1. `/` shows the quiz start screen.
2. `/api/quiz` returns JSON starting `{"clusters":[…` — proves the Functions run.
3. Take the quiz once, then open the scoreboard link — your entry should appear.
   If submitting errors, the `DB` binding is missing or the site needs a redeploy.
4. `/board.html?key=WRONG` shows the locked message, not scores.
5. `/shared/quiz.js` does **not** show JavaScript containing `answer:`. Pages
   serves the quiz page for unmatched paths, so a `200` here is expected and
   fine — what matters is that no answer key is visible.

## Editing the quiz
- **Questions, answers, clusters:** `shared/quiz.js`
- **Participant look & feel:** `public/index.html` · **Host board:** `public/board.html`

Push to GitHub → the site rebuilds automatically in about a minute. There is no
"publish a new version" step (unlike Apps Script).

## Telegram (optional)
Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` as environment variables (never in
code), redeploy, then visit `/api/test-telegram?key=YOUR_HOST_KEY` — it posts a
"bot is connected" message to the group. After that, each submission updates a
single self-editing leaderboard message with medals and an "Updated" timestamp.

## Viewing and exporting results
Cloudflare → **D1 → albatross → Console**, and run:

```sql
SELECT name, phone, cluster, score, time_ms
FROM results
ORDER BY score DESC, time_ms ASC;
```

That is the official prize order: most correct first, fastest breaking ties.

## Troubleshooting
| Symptom | Cause |
| --- | --- |
| `404` on the site root | Build output directory isn't `public` |
| Site loads but `/api/quiz` is `404` | **Root directory** was changed — it must stay at the repo root so `functions/` is found |
| "The quiz is not fully set up yet" on submit | The `DB` binding is missing, misnamed, or the site hasn't been redeployed since it was added |
| Scoreboard says "Check the host key" | `key=` in the URL doesn't match `HOST_KEY` |
| Telegram silent | Token/chat id unset (skipped by design), or the bot isn't in the group |
