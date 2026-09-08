# The Albatross Files — event runbook

Everything needed to run the quiz on the day. This file is the record: no other
notes are required.

A department quiz on Singapore's road to Separation, 1963–1965 (Goh Keng Swee's
secret "Albatross" file). Runs entirely on Cloudflare.

---

## ⚠️ Make this repository private

This repo contains **the answer key** (below and in `shared/quiz.js`) and **the
scoreboard password** (`wrangler.jsonc`). While it is public, anyone who finds it
can read the answers and open the scoreboard.

GitHub → **Settings → Danger Zone → Change repository visibility → Make private**.
Cloudflare keeps deploying normally afterwards.

---

## The links

| | |
| --- | --- |
| **Quiz** — share this | https://quiz.secc.workers.dev/ |
| **Host scoreboard** — keep private | https://quiz.secc.workers.dev/board.html?key=trainingteam2026 |

The quiz link needs no sign-in and works in WhatsApp, on any phone, with no
Google account. The scoreboard is protected only by that key in the URL, so do
not paste it into the participant group.

## How scoring and ranking work

- 10 questions. Every question must be answered before moving on.
- Q8–Q10 are multi-select and **full credit only** — every correct option and no
  others. The quiz will not let anyone continue until they have picked exactly
  the required number.
- **Ranking: score first, then fastest time.** That is the prize order, so three
  people on 10/10 still produce a clean 1st, 2nd and 3rd.
- **One attempt per person**, matched on name + phone. Phone numbers are
  normalised, so "9123 4567" and "91234567" are the same person.
- Participants never see their score or a timer — only a thank-you message. The
  clock runs invisibly for the tie-break.

## On the day

1. **Before starting:** open the scoreboard → **Manage entries** → **Clear all
   entries**, to remove test runs.
2. **Share the quiz link** (see the WhatsApp message below).
3. **Watch the scoreboard** — it refreshes itself every few seconds. Times shown
   are Singapore time.
4. **Read the winners off the top of the board:** 🥇 🥈 🥉.

### Managing entries
On the scoreboard, **Manage entries** shows every submission with phone numbers,
a **Delete** button per row, and **Clear all entries**.

Deleting someone's entry **lets them take the quiz again** — useful if a person
hits a genuine problem partway through.

### WhatsApp message

> 🕊️ **THE ALBATROSS FILES** — 10 questions on Singapore's road to Separation.
>
> Accuracy *and* speed count — ties go to the fastest. Prizes for the top 3.
> One attempt each.
>
> 👉 https://quiz.secc.workers.dev/
>
> Gather back at **Level 1 Plaza by 11.30am**.

---

## Answer key

Kept in step with `shared/quiz.js`, which is what the server actually scores
against. Correct options are marked ✅.

### Q1
*On what date did Singapore merge with Malaya, North Borneo (Sabah), and Sarawak to form the Federation of Malaysia?*

- A) 31 August 1963
- **✅ B) 16 September 1963**
- C) 9 August 1965
- D) 21 September 1963

### Q2
*Why did Goh Keng Swee name the secret file "Albatross"?*

- A) A childhood nickname
- **✅ B) It referenced Coleridge’s poem — Malaysia had become "an albatross round our necks"**
- C) A random British-intelligence codename
- D) A bird species found in Singapore

### Q3
*In the Singapore General Election of 21 September 1963, how many of the 51 seats did the PAP win?*

- A) 13
- B) 0
- **✅ C) 37**
- D) 51

### Q4
*Which PAP candidate won the only seat the party secured in the 1964 Malaysian Federal Election, and remained in KL’s Parliament even after Separation?*

- A) Lim Kim San
- **✅ B) Devan Nair**
- C) Ong Pang Boon
- D) Toh Chin Chye

### Q5
*How many people died in the first race riot of 21 July 1964?*

- A) 8
- B) 13
- **✅ C) 23**
- D) 60

### Q6
*What alliance did Lee Kuan Yew, Toh Chin Chye, and S. Rajaratnam form on 9 May 1965, championing "Malaysian Malaysia"?*

- A) The Singapore Alliance
- **✅ B) The Malaysian Solidarity Convention (MSC)**
- C) The Democratic Action Party
- D) Barisan Sosialis

### Q7
*What health condition struck Tunku Abdul Rahman while in London in June 1965, during which he decided to cut Singapore loose?*

- A) Heart attack
- **✅ B) Shingles**
- C) Pneumonia
- D) Stroke

### Q8  — select 3
*Which Singapore ministers were reluctant to sign the Separation Agreement? Select all that apply.*

- **✅ Toh Chin Chye**
- **✅ S. Rajaratnam**
- **✅ Ong Pang Boon**
- Lim Kim San
- E.W. Barker
- Goh Keng Swee

### Q9  — select 2
*When Lee Kuan Yew instructed Goh Keng Swee to explore separation while avoiding calamity, he gave two specific instructions. Select both.*

> Two conditions from Lee Kuan Yew’s briefing to Goh — select both for full credit.

- **✅ Find a way to avoid a racial clash**
- Complete the review within one month
- **✅ Restrict talks to the ‘minimum few’ and be absolutely leak-proof**
- Report only to the British High Commissioner
- Draft a new constitution before informing Lee Kuan Yew
- Hold a referendum in Singapore first

### Q10  — select 2
*According to E.W. Barker, Lee Kuan Yew’s 27 May 1965 speech in the Federal Parliament — partly in fluent Malay — was the moment Tunku Abdul Rahman and his colleagues realized two things. Select both.*

- Time to bring in the British as mediator
- **✅ Better to have Singapore out of the Federation**
- **✅ Better to have Mr Lee out of Malaysian politics**
- Time to hold fresh elections across Malaysia
- Better to delay Separation until after 1969
- Time to reshuffle the Malaysian cabinet


---

## Clusters in the dropdown

Air Ops C3 · Embedded Teams / C3 CentEx · HQ · Maritime Ops ·
Smart Camps & Bases · WOG Ops C3 · NSI

## If something goes wrong

| Symptom | What to do |
| --- | --- |
| Quiz page won't load | Check the Worker is deployed: Cloudflare → Workers & Pages → `quiz` → Deployments |
| "The quiz is not fully set up yet" on submit | The D1 binding or `database_id` in `wrangler.jsonc` is wrong |
| Scoreboard says the host key doesn't match | The `?key=` in the URL differs from `HOST_KEY` in `wrangler.jsonc` |
| Someone can't submit — "already filed" | They already have an entry; delete it from Manage entries and they can retake |
| A change isn't showing | Push to GitHub and wait ~1 minute; the Worker rebuilds itself |

## Saved versions

| Branch | What it is |
| --- | --- |
| `v1` | First fully working version on Cloudflare |
| `v2` | Adds Singapore time, the real cluster names, and the manage-entries panel |
| `v3` | This version — final wording of Q4 and Q10, plus this runbook |

To roll back, deploy from the branch you want, or use Cloudflare → Workers &
Pages → `quiz` → **Deployments** and revert to an earlier one.

## How it is built

See [`HOSTING.md`](./HOSTING.md) for the full technical setup: Worker, D1
database, bindings, environment variables and optional Telegram leaderboard.

| Path | What it is |
| --- | --- |
| `public/` | the only folder served as files — the quiz and the scoreboard |
| `src/index.js` | the Worker: routes `/api/*`, serves everything else |
| `shared/quiz.js` | questions **and the answer key** — bundled into the Worker, never served |
| `shared/core.js` | scoring, one-attempt rule, host-key gate |
| `wrangler.jsonc` | Worker config: static assets, D1 binding, `HOST_KEY` |
| `schema.sql` | database tables |
| `Code.gs`, `Index.html` | the older Google Apps Script version, kept for reference only — not in use |
