# The Albatross Files — department quiz

A polished, mobile-first web quiz about Singapore's 1963–1965 road to Separation
from Malaysia (Goh Keng Swee's secret *"Albatross"* file). Built on **Google Apps
Script**: free, serverless, and it keeps your Telegram bot token secret on the
server. Correct answers **never** leave the server — the browser only receives
question text and options, and all scoring happens in `Code.gs`.

- **`Code.gs`** — server: serves the page, returns quiz data (no answers), scores
  submissions, logs to a Google Sheet, and maintains a live Telegram leaderboard.
- **`Index.html`** — the front end (single file: inline CSS + JS, Google Fonts).

---

## What it does

- Start screen collects **Name**, **Number** (kept as text, so leading zeros
  survive), and **Cluster** (a dropdown filled from the server).
- 10 questions, **one at a time**, with a progress bar and a live timer. The timer
  starts the moment question 1 appears and stops at submit.
- Questions 8–10 are **multi-select, full-credit-only** (you must pick every
  correct option and no wrong ones).
- Server-side scoring out of 10. Ranking is **score (high→low), then time
  (fast→slow)** so the fastest wins any tie.
- **One attempt per person** (same Name + Number, case-insensitive).
- Every submission appends a row to a **`Results`** sheet.
- A single **Telegram leaderboard message edits itself** on each submission, with
  🥇🥈🥉 for the top three and an *"Updated HH:MM:SS"* line.

---

## Setup (non-technical, ~15 minutes)

### 1. Create the Sheet-bound script
1. Create a new **Google Sheet** (this is where results are logged).
2. In the Sheet, go to **Extensions → Apps Script**. This opens a script that is
   *bound* to your Sheet.
3. In the editor, you'll see a file called `Code.gs`. Replace its entire contents
   with this project's **`Code.gs`**.
4. Click the **+** next to *Files* → **HTML**, name it exactly **`Index`** (no
   `.html`), and paste in this project's **`Index.html`**.

> The HTML file **must** be named `Index` — `Code.gs` serves it by that name.

### 2. Fill in the settings block (top of `Code.gs`)
Edit the clearly-commented settings at the top:

| Setting | What to put |
| --- | --- |
| `BOT_TOKEN` | Your Telegram bot token from **@BotFather** (leave the placeholder to disable Telegram). |
| `CHAT_ID` | The target chat/group id (leave the placeholder to disable Telegram). |
| `SHEET_NAME` | Tab name for logging. Default `Results` is fine. |
| `LEADERBOARD_SIZE` | How many people to show on Telegram. Default 10. |
| `ONE_ATTEMPT_PER_PERSON` | `true` to block repeat submissions. |
| `CLUSTERS` | **Replace the placeholder** `['Cluster A', …]` with your real cluster names. |

The quiz works fine **without Telegram** — the bot calls are guarded and simply
skipped while `BOT_TOKEN`/`CHAT_ID` are still placeholders.

### 3. Deploy as a Web app
1. **Deploy → New deployment**.
2. Click the gear → choose **Web app**.
3. Set **Execute as: Me**, and **Who has access: Anyone** (or *"Anyone within
   &lt;your org&gt;"* if it's internal).
4. **Deploy**, approve the permissions when prompted, and copy the **`/exec` URL**.
   That URL is the link you share with the department.

---

## ⚠️ The #1 gotcha — publish a *New version* after every edit

Apps Script keeps serving the **old** deployed version until you publish a new one.
So after **any** change to `Code.gs` or `Index.html`:

> **Deploy → Manage deployments → (edit, the pencil icon) → Version: "New version"
> → Deploy.**

If you skip this, your `/exec` link keeps showing the previous version and you'll
think your change "didn't work."

---

## Telegram leaderboard (optional but nice)

1. In Telegram, message **@BotFather**, create a bot, and copy the **token** into
   `BOT_TOKEN`.
2. Add your bot to the target **group**, then get the group's **chat id** (e.g. use
   **@RawDataBot** or **@getidsbot** in the group). Group ids are usually negative,
   like `-1001234567890`. Put it in `CHAT_ID`.
3. In the Apps Script editor, select the **`testTelegram`** function from the
   dropdown and click **Run**. On the first run you'll be asked to approve
   permissions — approve them. You should see a "✅ …bot is connected" message land
   in the group. This confirms the bot can post before you go live.

Helper functions you can run from the editor:

- **`testTelegram()`** — posts a one-off test message.
- **`resetLeaderboardMessage()`** — forgets the stored message id so the next
  submission posts a brand-new leaderboard message (use this if you deleted the old
  message or moved the bot to a different chat).
- **`refreshLeaderboardNow()`** — rebuilds and re-posts the leaderboard from the
  current sheet without waiting for a new submission.

The leaderboard is a **single message that edits itself**: the first submission
sends it and stores its `message_id` in Script Properties; later submissions edit
that same message. If the message was deleted, the next update sends a fresh one and
stores the new id. Every update includes an *"Updated HH:MM:SS"* line so the text
always changes (Telegram rejects an edit that would leave the text identical).

---

## Local design preview (optional, for developers)

`google.script.run` only exists inside Apps Script, so `Index.html` can't reach the
real backend on your machine. The front end detects this and falls back to a small
**`MOCK`** object that returns the quiz data and fakes a submission — purely for
iterating on the visuals. Just open `Index.html` in a browser (or serve the folder
with any static server) and the mock kicks in automatically.

- To preview the **"already submitted"** state locally, enter the name `dupe` on the
  start screen.
- In production (inside Apps Script) the real backend is always used; the mock is
  never on the live path.

### Optional: `clasp` workflow

Prefer editing locally in your own editor?

```bash
npm i -g @google/clasp
clasp login
# Enable the Apps Script API once at https://script.google.com/home/usersettings
clasp clone <scriptId>   # the id from the bound project's URL
# …edit Code.gs / Index.html locally…
clasp push
```

Then still do the **Deploy → New version** step above to publish. (`clasp` is only
for your local workflow; the runtime needs no npm packages.)

---

## Answer-key note for the quiz owner

**Please confirm Q5** ("How many people died in the first race riot of 21 July
1964?"). The code uses **23**, which is the figure most commonly cited, but it is
flagged with a `CONFIRM WITH OWNER` comment in `Code.gs`. If your source says
otherwise, update the `answer` index for question 5.

The results tab logs: `Timestamp | Name | Number | Cluster | Score | Total |
TimeSec | AnswersJSON`, with a frozen header row created automatically on first use.
