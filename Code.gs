/**
 * The Albatross Files — a department quiz about Singapore's 1963–1965
 * road to Separation from Malaysia (Goh Keng Swee's secret "Albatross" file).
 *
 * Google Apps Script backend. Serves Index.html via HtmlService, returns quiz
 * data WITHOUT answers, scores submissions server-side, logs to a Google Sheet,
 * and maintains a single self-editing Telegram leaderboard message.
 *
 * ---------------------------------------------------------------------------
 *  SETTINGS  —  edit the values in this block, then publish a NEW version
 *              (Deploy → Manage deployments → edit → Version: "New version").
 * ---------------------------------------------------------------------------
 */

// Telegram bot token from @BotFather, e.g. "123456:ABC-DEF...". Leave as-is
// until you have one — Telegram calls are guarded and skipped while it's a
// placeholder, so the quiz still works without Telegram.
var BOT_TOKEN = 'PASTE_YOUR_TELEGRAM_BOT_TOKEN_HERE';

// Target chat id. For a group, add the bot to the group and use the negative
// group id (e.g. "-1001234567890"). Leave as-is to disable Telegram.
var CHAT_ID = 'PASTE_YOUR_TELEGRAM_CHAT_ID_HERE';

// Name of the tab in the bound spreadsheet where submissions are logged.
var SHEET_NAME = 'Results';

// How many people to show on the Telegram leaderboard.
var LEADERBOARD_SIZE = 10;

// Block a second submission from the same Name + Phone (case-insensitive)?
var ONE_ATTEMPT_PER_PERSON = true;

// Secret key for the HOST's live scoreboard. As host, open the scoreboard at:
//   <your /exec URL>?view=board&key=THIS_VALUE
// Change it to something only you know so participants can't peek at scores.
var HOST_KEY = 'trainingteam2026';

// Clusters shown in the start-screen dropdown.
var CLUSTERS = ['SCB', 'WOG', 'HQ', 'Air Ops C3', 'Maritime', 'C3 Centex', 'Embedded Teams'];

/* ------------------------------------------------------------------------- */

/**
 * Quiz content + answer key. Answers are 0-based option indices.
 * This lives ONLY on the server — answers are never sent to the browser.
 *
 * `multi: true` marks a multi-select question (full credit only: the user must
 * pick every correct option and no incorrect ones).
 */
var QUIZ = [
  {
    q: 'On what date did Singapore merge with Malaya, North Borneo (Sabah), and Sarawak to form the Federation of Malaysia?',
    options: ['31 August 1963', '16 September 1963', '9 August 1965', '21 September 1963'],
    answer: [1] // B
  },
  {
    q: 'Why did Goh Keng Swee name the secret file "Albatross"?',
    options: [
      'A childhood nickname',
      'It referenced Coleridge’s poem — Malaysia had become "an albatross round our necks"',
      'A random British-intelligence codename',
      'A bird species found in Singapore'
    ],
    answer: [1] // B
  },
  {
    q: 'In the Singapore General Election of 21 September 1963, how many of the 51 seats did the PAP win?',
    options: ['13', '0', '37', '51'],
    answer: [2] // C (37)
  },
  {
    q: 'Which PAP candidate won the only seat the party secured in the 1964 Malaysian federal election, and remained in KL’s Parliament even after Separation?',
    options: ['Lim Kim San', 'Devan Nair', 'Ong Pang Boon', 'Toh Chin Chye'],
    answer: [1] // B (Devan Nair)
  },
  {
    q: 'How many people died in the first race riot of 21 July 1964?',
    options: ['8', '13', '23', '60'],
    answer: [2] // C (23) — TODO: CONFIRM WITH QUIZ OWNER. Sources commonly cite 23 dead.
  },
  {
    q: 'What alliance did Lee Kuan Yew, Toh Chin Chye, and S. Rajaratnam form on 9 May 1965, championing "Malaysian Malaysia"?',
    options: [
      'The Singapore Alliance',
      'The Malaysian Solidarity Convention (MSC)',
      'The Democratic Action Party',
      'Barisan Sosialis'
    ],
    answer: [1] // B
  },
  {
    q: 'What health condition struck Tunku Abdul Rahman while in London in June 1965, during which he decided to cut Singapore loose?',
    options: ['Heart attack', 'Shingles', 'Pneumonia', 'Stroke'],
    answer: [1] // B (Shingles)
  },
  {
    q: 'Which Singapore ministers were reluctant to sign the Separation Agreement? Select all that apply.',
    options: ['Toh Chin Chye', 'S. Rajaratnam', 'Ong Pang Boon', 'Lim Kim San', 'E.W. Barker', 'Goh Keng Swee'],
    multi: true,
    answer: [0, 1, 2] // Toh Chin Chye + S. Rajaratnam + Ong Pang Boon (added at owner's request)
  },
  {
    q: 'When Lee Kuan Yew instructed Goh Keng Swee to explore separation while avoiding calamity, he gave two specific instructions. Select both.',
    helper: 'Two conditions from Lee Kuan Yew’s briefing to Goh — select both for full credit.',
    options: [
      'Find a way to avoid a racial clash',
      'Complete the review within one month',
      'Restrict talks to the ‘minimum few’ and be absolutely leak-proof',
      'Report only to the British High Commissioner',
      'Draft a new constitution before informing Lee Kuan Yew',
      'Hold a referendum in Singapore first'
    ],
    multi: true,
    // Per the Albatross File exhibition panel ("Evading Calamity"): Lee
    // instructed Goh to (1) avoid a racial clash and (2) restrict talks to the
    // "minimum few" and be leak-proof.
    answer: [0, 2]
  },
  {
    q: 'According to E.W. Barker, Lee Kuan Yew’s 27 May 1965 speech in the Federal Parliament — partly in fluent Malay — was the moment the Tunku and colleagues realized two things. Select both.',
    options: [
      'Time to bring in the British as mediator',
      'Better to have Singapore out of the Federation',
      'Better to have Mr Lee out of Malaysian politics',
      'Time to hold fresh elections across Malaysia',
      'Better to delay Separation until after 1969',
      'Time to reshuffle the Malaysian cabinet'
    ],
    multi: true,
    answer: [1, 2] // 2 + 3
  }
];

var TOTAL_QUESTIONS = QUIZ.length;

/* ===========================================================================
 *  WEB APP ENTRY
 * ======================================================================== */

/**
 * Serve the front end.
 *  - Default: the participant quiz (Index.html).
 *  - ?view=board&key=HOST_KEY : the host's live scoreboard.
 */
function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};

  if (params.view === 'board') {
    if (String(params.key || '') !== String(HOST_KEY)) {
      return HtmlService.createHtmlOutput(
        '<div style="font-family:system-ui,sans-serif;padding:48px 24px;text-align:center;color:#b3121f;">' +
        '<h2 style="margin:0 0 8px;">🔒 Scoreboard locked</h2>' +
        '<p style="color:#5b5443;">Add <code>&amp;key=YOUR_HOST_KEY</code> to the end of the scoreboard link.</p>' +
        '</div>'
      ).setTitle('Scoreboard — locked');
    }
    return HtmlService.createHtmlOutput(renderHostBoardHtml_())
      .setTitle('The Albatross Files — Live Scoreboard')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('The Albatross Files')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Return quiz data for the browser — question text + options + flags ONLY.
 * The answer key is intentionally stripped.
 */
function getQuizData() {
  return {
    clusters: CLUSTERS,
    total: TOTAL_QUESTIONS,
    questions: QUIZ.map(function (item, i) {
      return {
        index: i,
        q: item.q,
        options: item.options,
        multi: !!item.multi,
        // Number of options to pick (safe to reveal — it's the count, not which
        // options are correct). Lets the UI say "Select 2 options".
        pick: item.multi ? item.answer.length : 1,
        helper: item.helper || ''
      };
    })
  };
}

/* ===========================================================================
 *  SUBMISSION + SCORING
 * ======================================================================== */

/**
 * Score a submission, enforce one-attempt, log to the Sheet, and refresh the
 * Telegram leaderboard.
 *
 * @param {Object} payload { name, number, cluster, answers: number[][], timeMs }
 *        `answers[i]` is the array of selected 0-based option indices for Qi.
 * @return {Object} result for the front end.
 */
function submitQuiz(payload) {
  payload = payload || {};
  var name = String(payload.name || '').trim();
  var number = String(payload.number || '').trim();
  var cluster = String(payload.cluster || '').trim();
  var answers = Array.isArray(payload.answers) ? payload.answers : [];
  var timeMs = Number(payload.timeMs) || 0;

  if (!name || !number || !cluster) {
    return { ok: false, error: 'Missing name, number or cluster.' };
  }

  var lock = LockService.getScriptLock();
  try {
    // Wait up to 30s so concurrent submissions don't clobber each other's
    // duplicate check or sheet append.
    lock.waitLock(30000);
  } catch (e) {
    return { ok: false, error: 'The server is busy. Please try again in a moment.' };
  }

  try {
    var sheet = getResultsSheet_();

    // One attempt per Name + Number (case-insensitive).
    if (ONE_ATTEMPT_PER_PERSON && hasAlreadySubmitted_(sheet, name, number)) {
      return { ok: false, alreadySubmitted: true };
    }

    // Score server-side.
    var score = 0;
    for (var i = 0; i < QUIZ.length; i++) {
      if (isCorrect_(QUIZ[i], answers[i])) score++;
    }

    var timeSec = Math.round(timeMs / 100) / 10; // one decimal place

    // Log the row.
    sheet.appendRow([
      new Date(),
      name,
      "'" + number, // leading apostrophe keeps leading zeros as text in Sheets
      cluster,
      score,
      TOTAL_QUESTIONS,
      timeSec,
      JSON.stringify(answers)
    ]);
    SpreadsheetApp.flush();

    // Refresh Telegram (guarded — no-op until BOT_TOKEN/CHAT_ID are set).
    var rank = null;
    try {
      var board = buildLeaderboard_(sheet);
      rank = findRank_(board, name, number);
      updateTelegramLeaderboard_(board);
    } catch (tErr) {
      // Never fail the user's submission because of a Telegram/leaderboard hiccup.
      console.error('Leaderboard/Telegram update failed: ' + tErr);
    }

    return {
      ok: true,
      score: score,
      total: TOTAL_QUESTIONS,
      timeSec: timeSec,
      rank: rank,
      totalPlayers: rank ? countPlayers_(sheet) : null
    };
  } catch (err) {
    console.error('submitQuiz failed: ' + err);
    return { ok: false, error: 'Something went wrong while saving your result. Please try again.' };
  } finally {
    lock.releaseLock();
  }
}

/** Full-credit scoring for both single- and multi-select questions. */
function isCorrect_(question, selected) {
  var correct = question.answer || [];
  selected = Array.isArray(selected) ? selected : (selected == null ? [] : [selected]);

  if (selected.length !== correct.length) return false;

  // Compare as sets of numbers (order-independent, no duplicates matter).
  var want = {};
  for (var i = 0; i < correct.length; i++) want[Number(correct[i])] = true;
  for (var j = 0; j < selected.length; j++) {
    if (!want[Number(selected[j])]) return false;
  }
  return true;
}

/* ===========================================================================
 *  GOOGLE SHEET
 * ======================================================================== */

var HEADERS = ['Timestamp', 'Name', 'Phone', 'Cluster', 'Score', 'Total', 'TimeSec', 'AnswersJSON'];

/** Get (or create) the Results tab with a frozen header row. */
function getResultsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('No bound spreadsheet. Create this script from Extensions → Apps Script inside a Google Sheet.');
  }
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  // Ensure a header row exists and is frozen.
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** Has this Name + Number already submitted? Case-insensitive. */
function hasAlreadySubmitted_(sheet, name, number) {
  var last = sheet.getLastRow();
  if (last < 2) return false;
  // Columns: 2 = Name, 3 = Number.
  var values = sheet.getRange(2, 2, last - 1, 2).getValues();
  var wantName = name.toLowerCase();
  var wantNum = normalizeNumber_(number);
  for (var i = 0; i < values.length; i++) {
    var rowName = String(values[i][0]).trim().toLowerCase();
    var rowNum = normalizeNumber_(values[i][1]);
    if (rowName === wantName && rowNum === wantNum) return true;
  }
  return false;
}

/** Strip a leading text apostrophe and surrounding whitespace for comparison. */
function normalizeNumber_(v) {
  return String(v).replace(/^'/, '').trim().toLowerCase();
}

/** Count distinct submissions (rows). */
function countPlayers_(sheet) {
  var last = sheet.getLastRow();
  return last < 2 ? 0 : last - 1;
}

/* ===========================================================================
 *  LEADERBOARD
 * ======================================================================== */

/**
 * Read all rows and rank them: score DESC, then TimeSec ASC (fastest wins ties).
 * @return {Array} sorted array of { name, cluster, score, timeSec, number }
 */
function buildLeaderboard_(sheet) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var rows = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
  var players = rows.map(function (r) {
    return {
      name: String(r[1]),
      number: normalizeNumber_(r[2]),
      cluster: String(r[3]),
      score: Number(r[4]) || 0,
      timeSec: Number(r[6]) || 0
    };
  });
  players.sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score; // score desc
    return a.timeSec - b.timeSec;                       // time asc
  });
  return players;
}

/** 1-based rank of a Name + Phone within the sorted board, or null. */
function findRank_(board, name, number) {
  var wantName = name.trim().toLowerCase();
  var wantNum = normalizeNumber_(number);
  for (var i = 0; i < board.length; i++) {
    if (board[i].name.trim().toLowerCase() === wantName && board[i].number === wantNum) {
      return i + 1;
    }
  }
  return null;
}

/* ===========================================================================
 *  HOST LIVE SCOREBOARD
 *  Ranked by score (accuracy) DESC, then time ASC (fastest) — so tied top
 *  scores are broken by who was quickest. Called by the host board page.
 * ======================================================================== */

/**
 * Return the ranked leaderboard for the host page. Guarded by HOST_KEY so
 * participants can't call it to peek at scores.
 */
function getLeaderboard(key) {
  if (String(key || '') !== String(HOST_KEY)) {
    return { ok: false, error: 'Invalid host key.' };
  }
  var board = buildLeaderboard_(getResultsSheet_());
  return {
    ok: true,
    updated: nowHHMMSS_(),
    count: board.length,
    players: board.map(function (p, i) {
      return { rank: i + 1, name: p.name, cluster: p.cluster, score: p.score, timeSec: p.timeSec };
    })
  };
}

/** Self-contained HTML for the host's live scoreboard (auto-refreshing). */
function renderHostBoardHtml_() {
  var keyJson = JSON.stringify(String(HOST_KEY));
  var totalQ = TOTAL_QUESTIONS;
  return [
'<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">',
'<meta name="viewport" content="width=device-width, initial-scale=1">',
'<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
'<link href="https://fonts.googleapis.com/css2?family=Special+Elite&family=Fraunces:opsz,wght@9..144,600;9..144,900&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">',
'<style>',
':root{--paper:#f4ecd8;--paper2:#faf5e6;--ink:#23201a;--soft:#5b5443;--faint:#8a8168;--red:#b3121f;--line:#d8cba8;--gold:#c8a53a;}',
'*{box-sizing:border-box;}',
'body{margin:0;font-family:Inter,system-ui,sans-serif;background:var(--paper);color:var(--ink);min-height:100vh;',
'background-image:repeating-linear-gradient(0deg,rgba(0,0,0,.012) 0 1px,transparent 1px 3px);}',
'.wrap{max-width:820px;margin:0 auto;padding:22px 18px 40px;}',
'.top{display:flex;align-items:center;gap:12px;border:2px solid var(--ink);border-radius:5px;background:var(--paper2);padding:14px 18px;}',
'.top .k{font-family:"Special Elite",monospace;font-size:.66rem;letter-spacing:.1em;color:var(--soft);}',
'.top h1{font-family:Fraunces,serif;font-weight:900;font-size:1.5rem;margin:2px 0 0;letter-spacing:-.01em;}',
'.live{margin-left:auto;font-family:"Special Elite",monospace;font-size:.72rem;letter-spacing:.08em;color:var(--red);display:flex;align-items:center;gap:7px;white-space:nowrap;}',
'.live .dot{width:9px;height:9px;border-radius:50%;background:var(--red);animation:p 1.6s infinite;}',
'@keyframes p{0%,100%{opacity:.3;}50%{opacity:1;}}',
'.meta{font-family:"Special Elite",monospace;font-size:.72rem;letter-spacing:.06em;color:var(--faint);margin:14px 2px 10px;text-transform:uppercase;display:flex;justify-content:space-between;}',
'table{width:100%;border-collapse:collapse;}',
'th{font-family:"Special Elite",monospace;font-size:.64rem;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);text-align:left;padding:6px 10px;border-bottom:1px solid var(--line);}',
'th.r,td.r{text-align:right;font-variant-numeric:tabular-nums;}',
'td{padding:12px 10px;border-bottom:1px solid var(--line);font-size:1rem;}',
'tr td:first-child{font-family:Fraunces,serif;font-weight:900;font-size:1.15rem;width:54px;}',
'.nm{font-weight:600;}',
'.cl{color:var(--soft);font-size:.85rem;}',
'.sc{font-family:Fraunces,serif;font-weight:900;font-size:1.2rem;color:var(--red);}',
'.tm{color:var(--soft);font-variant-numeric:tabular-nums;}',
'tr.top1 td{background:color-mix(in srgb,var(--gold) 20%,transparent);}',
'tr.top2 td{background:color-mix(in srgb,var(--faint) 14%,transparent);}',
'tr.top3 td{background:color-mix(in srgb,var(--red) 9%,transparent);}',
'.empty{text-align:center;color:var(--soft);padding:50px 20px;font-family:Fraunces,serif;font-size:1.2rem;}',
'.err{text-align:center;color:var(--red);padding:40px;}',
'@media (max-width:520px){.cl{display:block;}td{padding:10px 6px;}}',
'@media (prefers-color-scheme:dark){:root{--paper:#1c1a16;--paper2:#26231d;--ink:#ece3cf;--soft:#b9ac8f;--faint:#857a5f;--red:#e5434f;--line:#3a3529;}}',
'</style></head><body><div class="wrap">',
'<div class="top"><span style="font-size:1.6rem" aria-hidden="true">🕊️</span>',
'<div><div class="k">HOST VIEW · LIVE</div><h1>The Albatross Files — Scoreboard</h1></div>',
'<div class="live"><span class="dot"></span><span id="live">connecting…</span></div></div>',
'<div class="meta"><span id="count">—</span><span>Ranked by score, then fastest time</span></div>',
'<div id="board"><div class="empty">Loading…</div></div>',
'</div><script>',
'var KEY=' + keyJson + ';var TOTAL=' + totalQ + ';',
'function esc(s){return String(s).replace(/[&<>]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c];});}',
'function medal(r){return r===1?"🥇":r===2?"🥈":r===3?"🥉":r;}',
'function paint(res){',
'  if(!res||!res.ok){document.getElementById("board").innerHTML="<div class=\\"err\\">Could not load the scoreboard. Check the host key in the link.</div>";return;}',
'  document.getElementById("live").textContent="Updated "+res.updated;',
'  document.getElementById("count").textContent=res.count+(res.count===1?" entry":" entries");',
'  if(!res.players.length){document.getElementById("board").innerHTML="<div class=\\"empty\\">No submissions yet — the board fills as people finish.</div>";return;}',
'  var h="<table><thead><tr><th>#</th><th>Participant</th><th class=\\"r\\">Score</th><th class=\\"r\\">Time</th></tr></thead><tbody>";',
'  res.players.forEach(function(p){',
'    var cls=p.rank<=3?(" class=\\"top"+p.rank+"\\""):"";',
'    h+="<tr"+cls+"><td>"+medal(p.rank)+"</td>";',
'    h+="<td><span class=\\"nm\\">"+esc(p.name)+"</span> <span class=\\"cl\\">"+esc(p.cluster)+"</span></td>";',
'    h+="<td class=\\"r\\"><span class=\\"sc\\">"+p.score+"</span>/"+TOTAL+"</td>";',
'    h+="<td class=\\"r tm\\">"+p.timeSec+"s</td></tr>";',
'  });',
'  h+="</tbody></table>";document.getElementById("board").innerHTML=h;',
'}',
'function poll(){google.script.run.withSuccessHandler(paint).withFailureHandler(function(){document.getElementById("live").textContent="reconnecting…";}).getLeaderboard(KEY);}',
'poll();setInterval(poll,4000);',
'</script></body></html>'
  ].join('\n');
}

/* ===========================================================================
 *  TELEGRAM
 * ======================================================================== */

var TELEGRAM_API = 'https://api.telegram.org/bot';
var PROP_MESSAGE_ID = 'LEADERBOARD_MESSAGE_ID';

/** True only when the bot token & chat id look like real values (not placeholders). */
function telegramConfigured_() {
  return BOT_TOKEN &&
    CHAT_ID &&
    BOT_TOKEN.indexOf('PASTE_') !== 0 &&
    String(CHAT_ID).indexOf('PASTE_') !== 0;
}

/**
 * Update (or create) the single self-editing leaderboard message.
 * Stores the message_id in Script Properties. If editing fails because the
 * message was deleted, sends a fresh one and stores the new id.
 */
function updateTelegramLeaderboard_(board) {
  if (!telegramConfigured_()) {
    console.log('Telegram not configured — skipping leaderboard update.');
    return;
  }

  var text = renderLeaderboardText_(board);
  var props = PropertiesService.getScriptProperties();
  var messageId = props.getProperty(PROP_MESSAGE_ID);

  if (messageId) {
    var edited = telegramCall_('editMessageText', {
      chat_id: CHAT_ID,
      message_id: Number(messageId),
      text: text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });
    if (edited && edited.ok) return;
    // Edit failed (e.g. message deleted). Fall through to send a fresh one.
    console.log('editMessageText failed, sending a new message.');
  }

  var sent = telegramCall_('sendMessage', {
    chat_id: CHAT_ID,
    text: text,
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  });
  if (sent && sent.ok && sent.result && sent.result.message_id) {
    props.setProperty(PROP_MESSAGE_ID, String(sent.result.message_id));
  }
}

/** Render the leaderboard message text. */
function renderLeaderboardText_(board) {
  var medals = ['🥇', '🥈', '🥉']; // 🥇🥈🥉
  var lines = ['*🗂 The Albatross Files — Leaderboard*', ''];

  if (!board.length) {
    lines.push('_No submissions yet._');
  } else {
    var top = board.slice(0, LEADERBOARD_SIZE);
    for (var i = 0; i < top.length; i++) {
      var p = top[i];
      var badge = i < 3 ? medals[i] : (i + 1) + '.';
      lines.push(
        badge + ' ' + escapeMarkdown_(p.name) +
        ' (' + escapeMarkdown_(p.cluster) + ') — ' +
        p.score + '/' + TOTAL_QUESTIONS + ' in ' + p.timeSec + 's'
      );
    }
  }

  lines.push('');
  // An "Updated" line guarantees the text always changes → avoids Telegram's
  // "message is not modified" error on edit.
  lines.push('_Updated ' + nowHHMMSS_() + '_');
  return lines.join('\n');
}

/** Current time as HH:MM:SS in the script's timezone. */
function nowHHMMSS_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm:ss');
}

/** Escape Telegram Markdown (v1) special characters. */
function escapeMarkdown_(s) {
  return String(s).replace(/([_*\[\]`])/g, '\\$1');
}

/** POST to the Telegram Bot API; returns the parsed JSON or null on failure. */
function telegramCall_(method, params) {
  try {
    var res = UrlFetchApp.fetch(TELEGRAM_API + BOT_TOKEN + '/' + method, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(params),
      muteHttpExceptions: true
    });
    var json = JSON.parse(res.getContentText());
    if (!json.ok) console.log('Telegram ' + method + ' responded: ' + res.getContentText());
    return json;
  } catch (e) {
    console.error('Telegram ' + method + ' threw: ' + e);
    return null;
  }
}

/* ===========================================================================
 *  HELPER / MAINTENANCE FUNCTIONS  (run these from the Apps Script editor)
 * ======================================================================== */

/**
 * Post a test message to the configured chat to confirm the bot works.
 * Run this once from the editor (approving permissions on first run) before
 * going live.
 */
function testTelegram() {
  if (!telegramConfigured_()) {
    Logger.log('Telegram is not configured yet — set BOT_TOKEN and CHAT_ID at the top of Code.gs.');
    return;
  }
  var res = telegramCall_('sendMessage', {
    chat_id: CHAT_ID,
    text: '✅ The Albatross Files bot is connected. ' + nowHHMMSS_()
  });
  Logger.log(res ? JSON.stringify(res) : 'No response — check BOT_TOKEN / CHAT_ID.');
}

/**
 * Forget the stored leaderboard message id so the next submission posts a
 * brand-new leaderboard message. Run from the editor if you deleted the old
 * message or moved the bot to a different chat.
 */
function resetLeaderboardMessage() {
  PropertiesService.getScriptProperties().deleteProperty(PROP_MESSAGE_ID);
  Logger.log('Leaderboard message id cleared. The next submission will post a fresh message.');
}

/**
 * Rebuild and re-post the leaderboard from the current Sheet contents without
 * needing a new submission. Handy after editing rows by hand.
 */
function refreshLeaderboardNow() {
  var board = buildLeaderboard_(getResultsSheet_());
  updateTelegramLeaderboard_(board);
  Logger.log('Leaderboard refreshed.');
}
