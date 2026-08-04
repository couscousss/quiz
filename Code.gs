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

// Block a second submission from the same Name + Number (case-insensitive)?
var ONE_ATTEMPT_PER_PERSON = true;

// Clusters shown in the start-screen dropdown.
// PLACEHOLDER — replace these with the department's real cluster names.
var CLUSTERS = ['Cluster A', 'Cluster B', 'Cluster C', 'Cluster D'];

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
    q: 'Why did Goh Keng Swee name his secret file "Albatross"?',
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
    q: 'Which Singapore ministers were reluctant to sign the Separation Agreement, having been deeply invested in the MSC’s "Malaysian Malaysia" ideal? Select all that apply.',
    options: ['Toh Chin Chye', 'S. Rajaratnam', 'Ong Pang Boon', 'Lim Kim San', 'E.W. Barker', 'Goh Keng Swee'],
    multi: true,
    answer: [0, 1] // Toh Chin Chye + S. Rajaratnam
  },
  {
    q: 'When Tun Razak instructed Goh Keng Swee to explore separation while avoiding calamity, he gave two specific instructions. Select both.',
    helper: 'Two conditions from Razak’s briefing to Goh — select both for full credit.',
    options: [
      'Avoid a racial clash or bloodshed',
      'Complete the review within one month',
      'Keep the exercise leak-proof, minimum people involved',
      'Report only to the British High Commissioner',
      'Draft a new constitution before informing Lee Kuan Yew',
      'Hold a referendum in Singapore first'
    ],
    multi: true,
    answer: [0, 2] // 1 + 3
  },
  {
    q: 'According to E.W. Barker, Lee Kuan Yew’s 27 May 1965 speech in the Federal Parliament — partly in fluent Malay — was the moment the Tunku and colleagues realized two things. Select both.',
    helper: 'Barker’s own words captured two linked realizations — select both for full credit.',
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

/** Serve the single-page front end. */
function doGet() {
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

var HEADERS = ['Timestamp', 'Name', 'Number', 'Cluster', 'Score', 'Total', 'TimeSec', 'AnswersJSON'];

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

/** 1-based rank of a Name + Number within the sorted board, or null. */
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
