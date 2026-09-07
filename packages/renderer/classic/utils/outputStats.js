const PAPER_COUNTS = Object.freeze({
  '4': 38266,
  '5': 24427,
  '6': 16850,
  '7': 12278,
  '8': 9113,
  '9': 7070,
  '10': 5584,
});

function calculateSheetsCount(wordCount, fontSize) {
  const normalizedWordCount = Number(wordCount) || 0;
  const wordsPerPaper = PAPER_COUNTS[String(fontSize || '')];
  if (!wordsPerPaper || normalizedWordCount <= 0) {
    return 0;
  }

  return Math.ceil(normalizedWordCount / wordsPerPaper);
}

function calculateReadingTime(wordCount) {
  const normalizedWordCount = Number(wordCount) || 0;
  if (normalizedWordCount <= 0) {
    return '--';
  }

  const wordsPerMinute = 215;
  const timeLeftMinutes = normalizedWordCount / wordsPerMinute;
  const hoursLeft = Math.floor(timeLeftMinutes / 60);
  const minsLeft = Math.round(timeLeftMinutes % 60);
  let timeText = '';

  if (hoursLeft > 0) {
    timeText += `${hoursLeft} hour${hoursLeft > 1 ? 's' : ''}`;
  }
  if (minsLeft > 0) {
    timeText += `${timeText ? ' ' : ''}${minsLeft} minute${minsLeft > 1 ? 's' : ''}`;
  }

  return timeText || '1 minute';
}

function normalizeDisplayBookName(input, fallback = 'Untitled') {
  const normalized = String(input || fallback)
    .replace(/\0/g, '')
    .trim();

  return normalized || fallback;
}

module.exports = {
  PAPER_COUNTS,
  calculateReadingTime,
  calculateSheetsCount,
  normalizeDisplayBookName,
};
