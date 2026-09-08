# The Albatross Files — Cloudflare setup

The quiz runs entirely on **Cloudflare**: a Worker serves the pages and scores
the answers, and **D1** (Cloudflare's own database) stores the results. One
account, and the only value you copy anywhere is a database id.

No Google sign-in, no "created by a Google user" notice, no multi-account or
incognito problems, and it opens everywhere including WhatsApp's in-app browser.

## Layout

| Path | What it is |
| --- | --- |
| `public/` | **the only folder served as files** |
| `public/index.html` | participant quiz |
| `public/board.html` | host live scoreboard |
| `src/index.js` | the Worker: routes `/api/*`, serves everything else from `public/` |
| `shared/*` | quiz content, answer key, scoring, database, Telegram — bundled into the Worker, **never served as files** |
| `schema.sql` | database tables |
| `wrangler.jsonc` | Worker configuration (assets + D1 binding) |

> **The answer key must stay out of `public/`.** Anything in that folder becomes
> a public URL. `shared/quiz.js` is compiled into the Worker instead, so players
> cannot download it.

Multi-select questions are full-credit-only. Ranking is score descending, then
time ascending, so the fastest wins a tie — which decides the top three.

---

## 1. Create the database

1. Dashboard → **Storage & Databases → D1 → Create database**, name it
   **`albatross`** → **Create**.
2. Open it → **Console** → paste all of [`schema.sql`](./schema.sql) → **Execute**.
3. On the database page, copy the **Database ID** (a long id, not a secret).

## 2. Point the Worker at that database

Edit [`wrangler.jsonc`](./wrangler.jsonc) and replace
`PASTE_YOUR_D1_DATABASE_ID_HERE` with the id from step 1, then commit.

## 3. Connect the Worker to GitHub

In your Worker → **Settings → Build** → **Connect** to the GitHub repository, and
set the branch to the one you deploy from. Cloudflare then rebuilds the Worker on
every push; `wrangler.jsonc` supplies the assets and D1 bindings automatically.

## 4. The host key

`HOST_KEY` is set in `wrangler.jsonc` under `vars`, because adding it as a
dashboard secret did not persist. Trade-off: this repository is public, so the
scoreboard key is readable by anyone who finds it. The board shows names,
clusters, scores and times only — never phone numbers. To move it back out of
the repo, add `HOST_KEY` as a Worker secret and delete it from `vars`.

Telegram values are real secrets and belong in the dashboard
(Worker → **Settings → Variables and Secrets**):

| Name | Value |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | *(optional)* bot token — omit to disable Telegram |
| `TELEGRAM_CHAT_ID` | *(optional)* group id, e.g. `-1001234567890` |
| `TELEGRAM_LEADERBOARD_SIZE` | *(optional)* default 10 |

Keep these as dashboard secrets rather than putting them in `wrangler.jsonc`, so
they stay out of the repository. Redeploy after changing them.

### Your two links
- **Participant quiz** (share this): `https://<worker>.workers.dev/`
- **Host scoreboard** (keep private): `https://<worker>.workers.dev/board.html?key=YOUR_HOST_KEY`

---

## Checks worth running after deploying
1. `/` shows the quiz start screen.
2. `/api/quiz` returns JSON starting `{"clusters":[…` — proves the Worker runs.
3. Take the quiz once, then open the scoreboard link — your entry should appear.
   If submitting errors, the D1 binding or the database id is wrong.
4. `/board.html?key=WRONG` shows the locked message, not scores.
5. `/shared/quiz.js` returns **404**, and in no case shows JavaScript containing
   `answer:`. Only `public/` is served as files; `shared/` is compiled into the
   Worker, so the answer key has no URL of its own.

## Editing the quiz
- **Questions, answers, clusters:** `shared/quiz.js`
- **Participant look & feel:** `public/index.html` · **Host board:** `public/board.html`

Push to GitHub → the Worker rebuilds automatically. There is no "publish a new
version" step (unlike Apps Script).

## Telegram (optional)
Add the token and chat id as secrets, redeploy, then visit
`/api/test-telegram?key=YOUR_HOST_KEY` — it posts a "bot is connected" message to
the group. After that, each submission updates a single self-editing leaderboard
message with medals and an "Updated" timestamp.

## Viewing, exporting and clearing results
Cloudflare → **D1 → albatross → Console**.

See the standings (this is the prize order — most correct first, fastest
breaking ties):

```sql
SELECT name, phone, cluster, score, time_ms
FROM results
ORDER BY score DESC, time_ms ASC;
```

Clear every entry, e.g. after testing and before the event:

```sql
DELETE FROM results;
```

Remove one person (case-insensitive):

```sql
DELETE FROM results WHERE lower(name) = lower('Their Name');
```

Remove a single row — list the ids first, then delete the one you want:

```sql
SELECT id, name, cluster, score FROM results ORDER BY id;
DELETE FROM results WHERE id = 3;
```

Deletes are immediate and cannot be undone. Clearing `results` also frees the
person to take the quiz again, since the one-attempt rule reads that table.

Times shown on the scoreboard are Singapore time (UTC+8).

## Troubleshooting
| Symptom | Cause |
| --- | --- |
| Error page at the Worker URL | The Worker has no code yet — connect it to GitHub (step 3) |
| "The quiz is not fully set up yet" on submit | `database_id` in `wrangler.jsonc` is still the placeholder or is wrong |
| Scoreboard says "Check the host key" | `key=` in the URL doesn't match the `HOST_KEY` secret |
| Telegram silent | Token/chat id unset (skipped by design), or the bot isn't in the group |
