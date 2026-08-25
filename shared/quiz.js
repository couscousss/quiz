/**
 * The Albatross Files — quiz content + answer key (server-side only).
 * Answers are 0-based option indices and are NEVER sent to the browser.
 */

// Clusters shown in the start-screen dropdown.
export const CLUSTERS = ['SCB', 'WOG', 'HQ', 'Air Ops C3', 'Maritime', 'C3 Centex', 'Embedded Teams'];

export const QUIZ = [
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
    answer: [2] // C (23)
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
    answer: [0, 1, 2] // Toh Chin Chye + S. Rajaratnam + Ong Pang Boon
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
    answer: [0, 2] // avoid racial clash + minimum-few/leak-proof (per Albatross File exhibit)
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

export const TOTAL = QUIZ.length;

/** Public quiz for the browser — question text + options only, NO answers. */
export function getPublicQuiz() {
  return {
    clusters: CLUSTERS,
    total: TOTAL,
    questions: QUIZ.map(function (item, i) {
      return {
        index: i,
        q: item.q,
        options: item.options,
        multi: !!item.multi,
        // Count of options to pick (safe — it's the count, not which ones).
        pick: item.multi ? item.answer.length : 1,
        helper: item.helper || ''
      };
    })
  };
}

/** Full-credit scoring for single- and multi-select questions. */
export function isCorrect(question, selected) {
  const correct = question.answer || [];
  selected = Array.isArray(selected) ? selected : (selected == null ? [] : [selected]);
  // De-duplicate first: without this, a crafted payload of [0,0,0] would have
  // the same length as a key of [0,1,2] and every element would be "in" the
  // key, scoring full marks for one lucky guess repeated.
  const picked = Array.from(new Set(selected.map(Number)));
  if (picked.length !== correct.length) return false;
  const want = {};
  correct.forEach(function (c) { want[Number(c)] = true; });
  for (const s of picked) { if (!want[s]) return false; }
  return true;
}

/** Score a submission (array of selected-index arrays) out of TOTAL. */
export function scoreSubmission(answers) {
  answers = Array.isArray(answers) ? answers : [];
  let score = 0;
  QUIZ.forEach(function (q, i) { if (isCorrect(q, answers[i])) score++; });
  return score;
}
