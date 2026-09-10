export function parseLRC(lrcContent) {
  const lines = lrcContent.split('\n');
  const sentences = [];

  lines.forEach((line) => {
    const match = line.trim().match(/^\[(\d{2}):(\d{2}\.\d{2,3})\](.*)$/);
    if (match) {
      const [, minutes, seconds, content] = match;
      const start = parseFloat(minutes) * 60 + parseFloat(seconds);
      const text = content.includes('^')
        ? content.replace('^', ' - ')
        : content;
      if (isEntireSentenceBracketed(text)) return;
      sentences.push({ start, text });
    }
  });

  for (let i = 0; i < sentences.length - 1; i++) {
    sentences[i].end = sentences[i + 1].start;
  }
  return sentences;
}

export function parseSRT(content) {
  const blocks = content.trim().split(/\r?\n\r?\n/);
  return blocks.map((block) => {
    const [id, time, ...textLines] = block.split(/\r?\n/);
    const [startTime, endTime] = time.split(' --> ').map(timeToSeconds);
    return {
      start: startTime,
      end: endTime,
      text: textLines.join(' '),
    };
  }).filter((sentence) => !isEntireSentenceBracketed(sentence.text));
}

export function isEntireSentenceBracketed(text) {
  const value = text.trim();
  const pairs = {
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
  if (!pairs[value[0]] || value.at(-1) !== pairs[value[0]]) return false;

  const stack = [];
  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if (pairs[character]) {
      stack.push(pairs[character]);
    } else if (closingBrackets.has(character)) {
      if (stack.pop() !== character) return false;
      if (!stack.length && index !== value.length - 1) return false;
    }
  }
  return stack.length === 0;
}

function timeToSeconds(timeString) {
  const [hours, minutes, seconds] = timeString.split(':');
  return (
    parseFloat(hours) * 3600 +
    parseFloat(minutes) * 60 +
    parseFloat(seconds.replace(',', '.'))
  );
}
