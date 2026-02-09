function parseTextBuffer(input) {
  const rawText = input.toString('utf8').replace(/\r\n/g, '\n').trim();

  if (!rawText) {
    return {
      format: 'txt',
      blocks: [],
    };
  }

  const paragraphs = rawText
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  return {
    format: 'txt',
    blocks: paragraphs.map(text => ({
      type: 'paragraph',
      text,
    })),
  };
}

module.exports = {
  parseTextBuffer,
};
