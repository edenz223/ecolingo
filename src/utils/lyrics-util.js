export function parseLRC(lrcContent) {
  const lines = lrcContent.split("\n");
  const sentences = [];

  lines.forEach((line) => {
    const match = line.trim().match(/^\[(\d{2}):(\d{2}\.\d{2,3})\](.*)$/);
    if (match) {
      const [, minutes, seconds, content] = match;
      const start = parseFloat(minutes) * 60 + parseFloat(seconds);
      const text = content.includes("^")
        ? content.replace("^", " - ")
        : content;
      sentences.push({ start, text });
    }
  });

  for (let i = 0; i < sentences.length - 1; i++) {
    sentences[i].end = sentences[i + 1].start;
  }
  return sentences;
}
