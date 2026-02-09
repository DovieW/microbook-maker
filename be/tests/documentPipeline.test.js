const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseUploadedDocument,
  normalizeDocument,
  serializeDocumentToTokens,
  getSupportedExtensions,
} = require('../pipeline/documentPipeline');

test('getSupportedExtensions includes txt and md', () => {
  const extensions = getSupportedExtensions();
  assert.deepEqual(extensions, ['.txt', '.md', '.markdown']);
});

test('parseUploadedDocument parses txt into paragraphs', () => {
  const input = Buffer.from('Alpha one two.\n\nBeta three four.');
  const parsed = parseUploadedDocument({
    originalName: 'chapter.txt',
    mimeType: 'text/plain',
    input,
  });

  assert.equal(parsed.format, 'txt');
  assert.equal(parsed.blocks.length, 2);
  assert.equal(parsed.blocks[0].type, 'paragraph');
  assert.match(parsed.blocks[0].text, /Alpha one two/);
});

test('parseUploadedDocument parses markdown headings and quotes', () => {
  const input = Buffer.from('# Intro\n\n> A quote line\n\nBody paragraph.');
  const parsed = parseUploadedDocument({
    originalName: 'chapter.md',
    mimeType: 'text/markdown',
    input,
  });

  assert.equal(parsed.format, 'markdown');
  assert.equal(parsed.blocks[0].type, 'heading');
  assert.equal(parsed.blocks[1].type, 'quote');
  assert.equal(parsed.blocks[2].type, 'paragraph');
});

test('parseUploadedDocument throws for unsupported extensions', () => {
  const input = Buffer.from('<html><body>hello</body></html>');

  assert.throws(() => {
    parseUploadedDocument({
      originalName: 'chapter.html',
      mimeType: 'text/html',
      input,
    });
  }, /Unsupported file format/);
});

test('normalizeDocument computes wordCount and keeps semantic blocks', () => {
  const parsed = {
    format: 'txt',
    blocks: [
      { type: 'paragraph', text: 'One two three' },
      { type: 'heading', text: 'Four five', level: 2 },
    ],
  };

  const normalized = normalizeDocument(parsed);

  assert.equal(normalized.wordCount, 5);
  assert.equal(normalized.blocks.length, 2);
});

test('serializeDocumentToTokens emits word and break tokens', () => {
  const normalized = {
    blocks: [
      { type: 'heading', text: 'Chapter One', level: 1 },
      { type: 'paragraph', text: 'Alpha beta gamma' },
    ],
    wordCount: 5,
  };

  const tokens = serializeDocumentToTokens(normalized);

  assert.ok(tokens.some(token => token.type === 'word' && token.variant === 'heading-1'));
  assert.ok(tokens.some(token => token.type === 'break' && token.variant === 'paragraph'));
  assert.ok(tokens.some(token => token.type === 'word' && token.variant === 'body'));
});

test('serializeDocumentToTokens preserves inline markdown emphasis and links', () => {
  const input = Buffer.from('See [OpenAI](https://openai.com), **Bold Move**, and *italics*.');
  const parsed = parseUploadedDocument({
    originalName: 'chapter.md',
    mimeType: 'text/markdown',
    input,
  });

  const normalized = normalizeDocument(parsed);
  const tokens = serializeDocumentToTokens(normalized);

  assert.ok(tokens.some(token => token.type === 'link' && token.text === 'OpenAI' && token.url === 'https://openai.com'));
  assert.ok(tokens.some(token => token.type === 'word' && token.text === 'Bold' && token.inlineStyle === 'strong'));
  assert.ok(tokens.some(token => token.type === 'word' && token.text === 'Move' && token.inlineStyle === 'strong'));
  assert.ok(tokens.some(token => token.type === 'word' && token.text === 'italics' && token.inlineStyle === 'emphasis'));
});

test('serializeDocumentToTokens emits inline emphasis as per-word tokens to avoid long-run spacing artifacts', () => {
  const parsed = parseUploadedDocument({
    originalName: 'book.md',
    mimeType: 'text/markdown',
    input: Buffer.from('_A big thank you to organizers of the LDX3 conference_', 'utf8'),
  });

  const normalized = normalizeDocument(parsed);
  const tokens = serializeDocumentToTokens(normalized);
  const emphasisTokens = tokens.filter((token) => token.inlineStyle === 'emphasis' && token.type === 'word');

  assert.equal(emphasisTokens.length, 10);
  assert.deepEqual(
    emphasisTokens.map((token) => token.text),
    ['A', 'big', 'thank', 'you', 'to', 'organizers', 'of', 'the', 'LDX3', 'conference'],
  );
});

test('parseUploadedDocument converts linked markdown images into link tokens', () => {
  const input = Buffer.from('[![Image 1](https://cdn.example/image.jpg)](https://example.com/post)');
  const parsed = parseUploadedDocument({
    originalName: 'chapter.md',
    mimeType: 'text/markdown',
    input,
  });

  const normalized = normalizeDocument(parsed);
  const tokens = serializeDocumentToTokens(normalized);

  assert.ok(tokens.some(token => token.type === 'link'
    && token.text === 'Image 1'
    && token.url === 'https://example.com/post'
    && token.isImage === true));
});

test('serializeDocumentToTokens marks bare-url links for plain rendering', () => {
  const input = Buffer.from('See [https://example.com](https://example.com)');
  const parsed = parseUploadedDocument({
    originalName: 'chapter.md',
    mimeType: 'text/markdown',
    input,
  });

  const normalized = normalizeDocument(parsed);
  const tokens = serializeDocumentToTokens(normalized);

  assert.ok(tokens.some(token => token.type === 'link'
    && token.text === 'https://example.com'
    && token.url === 'https://example.com'
    && token.isBareUrl === true));
});

test('parseUploadedDocument tolerates missing space after closing bold marker', () => {
  const input = Buffer.from('**Bear case: disappointed devs.**Two examples follow.');
  const parsed = parseUploadedDocument({
    originalName: 'chapter.md',
    mimeType: 'text/markdown',
    input,
  });

  const normalized = normalizeDocument(parsed);
  const tokens = serializeDocumentToTokens(normalized);

  assert.ok(tokens.some(token => token.type === 'word' && token.text === 'Bear' && token.inlineStyle === 'strong'));
  assert.ok(tokens.some(token => token.type === 'word' && token.text === 'case:' && token.inlineStyle === 'strong'));
  assert.ok(tokens.some(token => token.type === 'word' && token.text === 'devs.' && token.inlineStyle === 'strong'));
  assert.ok(tokens.some(token => token.type === 'word' && token.text === 'Two' && token.inlineStyle === null));
});

test('parseUploadedDocument preserves ordered-list numbering markers', () => {
  const input = Buffer.from('1. First item\n2. Second item');
  const parsed = parseUploadedDocument({
    originalName: 'chapter.md',
    mimeType: 'text/markdown',
    input,
  });

  const normalized = normalizeDocument(parsed);
  const tokens = serializeDocumentToTokens(normalized);

  assert.ok(tokens.some(token => token.type === 'word' && token.text === '1.'));
  assert.ok(tokens.some(token => token.type === 'word' && token.text === '2.'));
});

test('serializeDocumentToTokens keeps adjacent markdown list items compact', () => {
  const input = Buffer.from('- One\n- Two\n\nAfter list');
  const parsed = parseUploadedDocument({
    originalName: 'chapter.md',
    mimeType: 'text/markdown',
    input,
  });

  const normalized = normalizeDocument(parsed);
  const tokens = serializeDocumentToTokens(normalized);
  const paragraphBreaks = tokens.filter((token) => token.type === 'break' && token.variant === 'paragraph');

  assert.equal(paragraphBreaks.length, 1);
  assert.match(
    tokens.map((token) => (token.type === 'break' ? `[${token.variant}]` : token.text)).join(' '),
    /- One - Two After list \[paragraph\]/,
  );
});
