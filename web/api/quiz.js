/** GET /api/quiz — returns quiz data WITHOUT answers. */
const { getPublicQuiz } = require('../lib/quiz');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(getPublicQuiz());
};
