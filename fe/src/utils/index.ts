import { PaperCountsType } from '../types';

export const paperCounts: PaperCountsType = {
  '4': 38266,
  '5': 24427,
  '6': 16850,
  '7': 12278,
  '8': 9113,
  '9': 7070,
  '10': 5584,
};

export const calculatePapers = (wordCount: number, fontSize: string): number => {
  const wordsPerPaper = paperCounts[fontSize];
  if (!wordsPerPaper) return 0;
  return Math.ceil(wordCount / wordsPerPaper);
};

export const calculateReadingTime = (wordCount: number): string => {
  const wordsPerMinute = 215;

  const timeLeftMinutes = wordCount / wordsPerMinute;
  const hoursLeft = Math.floor(timeLeftMinutes / 60);
  const minsLeft = Math.round(timeLeftMinutes % 60);
  let timeText = '';
  if (hoursLeft > 0) {
    timeText += `${hoursLeft} hour${hoursLeft > 1 ? 's' : ''}`;
  }
  if (minsLeft > 0) {
    timeText += ` ${minsLeft} minute${minsLeft > 1 ? 's' : ''}`;
  }

  return timeText;
};


