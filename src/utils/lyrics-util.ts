import type { Sentence } from '../types/subtitles';

export function parseLRC(lrcContent: string): Sentence[] {
  const lines = lrcContent.split('\n');
  const sentences: Sentence[] = [];

  lines.forEach(line => {
    const match = line.trim().match(/^\[(\d{2}):(\d{2}\.\d{2,3})\](.*)$/);
    if (match) {
      const [, minutes = '', seconds = '', content = ''] = match;
      const start = parseFloat(minutes) * 60 + parseFloat(seconds);
      const text = content.includes('^') ? content.replace('^', ' - ') : content;
      if (!text.trim() || isEntireSentenceBracketed(text)) return;
      sentences.push({ start, text });
    }
  });

  sentences.forEach((sentence, i) => {
    const next = sentences[i + 1];
    if (next) sentence.end = next.start;
  });
  return sentences;
}

export function parseSRT(content: string): Sentence[] {
  const blocks = content.trim().split(/\r?\n\r?\n/);
  const sentences: Sentence[] = [];
  for (const block of blocks) {
    const [, time, ...textLines] = block.split(/\r?\n/);
    if (!time || !time.includes(' --> ')) continue;
    const [startTime = NaN, endTime = NaN] = time.split(' --> ').map(timeToSeconds);
    // A malformed timestamp drops that cue rather than the whole lesson.
    if (Number.isNaN(startTime) || Number.isNaN(endTime)) continue;
    const text = textLines.join(' ');
    if (!text.trim() || isEntireSentenceBracketed(text)) continue;
    sentences.push({
      start: startTime,
      end: endTime,
      text,
    });
  }
  return sentences;
}

export function isEntireSentenceBracketed(text: string): boolean {
  const value = text.trim();
  const pairs: Record<string, string> = {
    '(': ')',
    '（': '）',
    '[': ']',
    '［': '］',
    '【': '】',
    '{': '}',
    '｛': '｝',
    '〔': '〕',
  };
  const closingBrackets = new Set(Object.values(pairs));
  const first = value.charAt(0);
  if (!pairs[first] || value.at(-1) !== pairs[first]) return false;

  const stack: string[] = [];
  for (let index = 0; index < value.length; index++) {
    const character = value.charAt(index);
    const closing = pairs[character];
    if (closing) {
      stack.push(closing);
    } else if (closingBrackets.has(character)) {
      if (stack.pop() !== character) return false;
      if (!stack.length && index !== value.length - 1) return false;
    }
  }
  return stack.length === 0;
}

// "HH:MM:SS,mmm"; anything else is NaN.
function timeToSeconds(timeString: string): number {
  const [hours, minutes, seconds] = timeString.split(':');
  if (hours === undefined || minutes === undefined || seconds === undefined) return NaN;
  return (
    parseFloat(hours) * 3600 + parseFloat(minutes) * 60 + parseFloat(seconds.replace(',', '.'))
  );
}
