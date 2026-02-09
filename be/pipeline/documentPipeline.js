const path = require('path');
const { parseTextBuffer } = require('./importers/textImporter');
const { parseMarkdownBuffer } = require('./importers/markdownImporter');

const SUPPORTED_IMPORTERS = {
  '.txt': {
    format: 'txt',
    parser: parseTextBuffer,
  },
  '.md': {
    format: 'markdown',
    parser: parseMarkdownBuffer,
  },
  '.markdown': {
    format: 'markdown',
    parser: parseMarkdownBuffer,
  },
};

function getSupportedExtensions() {
  return Object.keys(SUPPORTED_IMPORTERS);
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeInlineStyle(style) {
  if (style === 'strong' || style === 'emphasis' || style === 'code') {
    return style;
  }
  return null;
}

function normalizeInlineSegments(inlines) {
  return (inlines || [])
    .map((segment) => {
      if (!segment || typeof segment !== 'object') {
        return null;
      }

      if (segment.type === 'link') {
        const text = cleanText(segment.text);
        const url = String(segment.url || '').trim();

        if (!url) {
          return text ? { type: 'text', text, inlineStyle: normalizeInlineStyle(segment.inlineStyle) } : null;
        }

        return {
          type: 'link',
          text: text || url,
          url,
          inlineStyle: normalizeInlineStyle(segment.inlineStyle),
          isImage: Boolean(segment.isImage),
        };
      }

      const text = cleanText(segment.text);
      if (!text) {
        return null;
      }

      return {
        type: 'text',
        text,
        inlineStyle: normalizeInlineStyle(segment.inlineStyle),
      };
    })
    .filter(Boolean);
}

function isBareUrlLink(text, url) {
  return String(text || '').trim() === String(url || '').trim();
}

function parseUploadedDocument({ originalName, mimeType, input }) {
  if (!input || !Buffer.isBuffer(input)) {
    throw new Error('Input buffer is required');
  }

  const extension = path.extname(originalName || '').toLowerCase();
  const importer = SUPPORTED_IMPORTERS[extension];

  if (!importer) {
    throw new Error(`Unsupported file format: ${extension || 'unknown'}`);
  }

  const parsed = importer.parser(input, { mimeType, originalName });

  return {
    format: importer.format,
    blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [],
  };
}

function normalizeDocument(parsedDocument) {
  const blocks = (parsedDocument?.blocks || [])
    .map((block) => {
      const type = block?.type || 'paragraph';
      const inlines = normalizeInlineSegments(block?.inlines || []);
      const text = cleanText(block?.text || inlines.map((segment) => segment.text).join(' '));
      const normalized = {
        type,
        text,
        inlines,
        compactBreak: Boolean(block?.compactBreak),
      };

      if (type === 'heading') {
        const level = Math.max(1, Math.min(6, Number(block?.level) || 1));
        normalized.level = level;
      }

      return normalized;
    })
    .filter((block) => block.type === 'separator' || block.text.length > 0 || block.inlines.length > 0);

  const wordCount = blocks.reduce((count, block) => {
    if (block.type === 'separator') {
      return count;
    }

    const sourceText = block.inlines.length > 0
      ? block.inlines.map((segment) => segment.text).join(' ')
      : block.text;

    if (!sourceText) {
      return count;
    }

    return count + sourceText.split(/\s+/).filter(Boolean).length;
  }, 0);

  return {
    format: parsedDocument?.format || 'unknown',
    blocks,
    wordCount,
  };
}

function splitToWordTokens(text, variant, inlineStyle) {
  const normalizedText = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalizedText) {
    return [];
  }

  const normalizedInlineStyle = normalizeInlineStyle(inlineStyle);
  return normalizedText.split(' ').map((word) => ({
    type: 'word',
    text: word,
    variant,
    inlineStyle: normalizedInlineStyle,
  }));
}

function appendInlineTokens(tokens, inlines, variant) {
  for (const segment of inlines || []) {
    if (segment.type === 'link') {
      const text = segment.text || segment.url;
      const url = segment.url;
      tokens.push({
        type: 'link',
        text,
        url,
        variant,
        inlineStyle: normalizeInlineStyle(segment.inlineStyle),
        isBareUrl: isBareUrlLink(text, url),
        isImage: Boolean(segment.isImage),
      });
      continue;
    }

    tokens.push(...splitToWordTokens(segment.text, variant, segment.inlineStyle));
  }
}

function serializeDocumentToTokens(normalizedDocument) {
  const tokens = [];
  const blocks = normalizedDocument.blocks || [];

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const nextBlock = blocks[index + 1] || null;

    const appendParagraphBreak = () => {
      tokens.push({ type: 'break', variant: 'paragraph' });
    };

    const shouldAppendParagraphBreak = () => {
      // Keep list-like compact blocks dense: don't inject a 4-space paragraph
      // separator for compact/list-derived blocks.
      if (block.compactBreak) {
        return false;
      }
      return true;
    };

    if (block.type === 'separator') {
      tokens.push({ type: 'break', variant: 'separator' });
      appendParagraphBreak();
      continue;
    }

    if (block.type === 'heading') {
      const level = Math.max(1, Math.min(6, Number(block.level) || 1));
      if (block.inlines && block.inlines.length > 0) {
        appendInlineTokens(tokens, block.inlines, `heading-${level}`);
      } else {
        tokens.push(...splitToWordTokens(block.text, `heading-${level}`));
      }
      appendParagraphBreak();
      continue;
    }

    if (block.type === 'quote') {
      if (block.inlines && block.inlines.length > 0) {
        appendInlineTokens(tokens, block.inlines, 'quote');
      } else {
        tokens.push(...splitToWordTokens(block.text, 'quote'));
      }
      if (shouldAppendParagraphBreak()) {
        appendParagraphBreak();
      }
      continue;
    }

    if (block.inlines && block.inlines.length > 0) {
      appendInlineTokens(tokens, block.inlines, 'body');
    } else {
      tokens.push(...splitToWordTokens(block.text, 'body'));
    }
    if (shouldAppendParagraphBreak()) {
      appendParagraphBreak();
    }
  }

  return tokens;
}

module.exports = {
  getSupportedExtensions,
  parseUploadedDocument,
  normalizeDocument,
  serializeDocumentToTokens,
};
