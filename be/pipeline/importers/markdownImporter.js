const MarkdownIt = require('markdown-it');

const markdownParser = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
});

function normalizeLooseMarkdown(text) {
  return String(text || '')
    .replace(/(\*\*[^*\n]+?\*\*)(?=[A-Za-z0-9])/g, '$1 ')
    .replace(/(__[^_\n]+?__)(?=[A-Za-z0-9])/g, '$1 ');
}

function getAttr(token, attrName) {
  if (!Array.isArray(token?.attrs)) {
    return null;
  }
  const match = token.attrs.find(([name]) => name === attrName);
  return match ? match[1] : null;
}

function normalizeStyle(styleStack) {
  if (styleStack.includes('code')) {
    return 'code';
  }
  if (styleStack.includes('strong')) {
    return 'strong';
  }
  if (styleStack.includes('emphasis')) {
    return 'emphasis';
  }
  return null;
}

function pushTextSegment(segments, text, inlineStyle) {
  const normalizedText = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalizedText) {
    return;
  }

  const last = segments[segments.length - 1];
  if (last && last.type === 'text' && last.inlineStyle === inlineStyle) {
    last.text = `${last.text} ${normalizedText}`.replace(/\s+/g, ' ').trim();
    return;
  }

  segments.push({
    type: 'text',
    text: normalizedText,
    inlineStyle: inlineStyle || null,
  });
}

function inlineSegmentsToText(segments) {
  return segments
    .map((segment) => segment.text || '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseInlineChildren(children) {
  const segments = [];
  const styleStack = [];
  let activeLink = null;

  const currentStyle = () => normalizeStyle(styleStack);
  const appendText = (text) => {
    if (activeLink) {
      const normalizedText = String(text || '').replace(/\s+/g, ' ').trim();
      if (normalizedText) {
        activeLink.parts.push(normalizedText);
      }
      return;
    }

    pushTextSegment(segments, text, currentStyle());
  };

  for (const token of children || []) {
    if (token.type === 'strong_open') {
      styleStack.push('strong');
      continue;
    }

    if (token.type === 'strong_close') {
      const index = styleStack.lastIndexOf('strong');
      if (index >= 0) {
        styleStack.splice(index, 1);
      }
      continue;
    }

    if (token.type === 'em_open') {
      styleStack.push('emphasis');
      continue;
    }

    if (token.type === 'em_close') {
      const index = styleStack.lastIndexOf('emphasis');
      if (index >= 0) {
        styleStack.splice(index, 1);
      }
      continue;
    }

    if (token.type === 'link_open') {
      activeLink = {
        url: getAttr(token, 'href') || '',
        parts: [],
        inlineStyle: currentStyle(),
        isImage: false,
      };
      continue;
    }

    if (token.type === 'link_close') {
      if (activeLink && activeLink.url) {
        const text = activeLink.parts.join(' ').replace(/\s+/g, ' ').trim() || activeLink.url;
        segments.push({
          type: 'link',
          text,
          url: activeLink.url,
          inlineStyle: activeLink.inlineStyle || null,
          isImage: activeLink.isImage === true,
        });
      }
      activeLink = null;
      continue;
    }

    if (token.type === 'image') {
      const altText = String(token.content || getAttr(token, 'alt') || 'Image').replace(/\s+/g, ' ').trim() || 'Image';
      const imageUrl = getAttr(token, 'src');

      if (activeLink) {
        activeLink.isImage = true;
        activeLink.parts.push(altText);
        continue;
      }

      if (imageUrl) {
        segments.push({
          type: 'link',
          text: altText,
          url: imageUrl,
          inlineStyle: currentStyle(),
          isImage: true,
        });
      } else {
        appendText(altText);
      }
      continue;
    }

    if (token.type === 'code_inline') {
      styleStack.push('code');
      appendText(token.content || '');
      const index = styleStack.lastIndexOf('code');
      if (index >= 0) {
        styleStack.splice(index, 1);
      }
      continue;
    }

    if (token.type === 'softbreak' || token.type === 'hardbreak') {
      appendText(' ');
      continue;
    }

    if (token.type === 'text' || token.type === 'html_inline') {
      appendText(token.content || '');
    }
  }

  if (activeLink && activeLink.url) {
    const text = activeLink.parts.join(' ').replace(/\s+/g, ' ').trim() || activeLink.url;
    segments.push({
      type: 'link',
      text,
      url: activeLink.url,
      inlineStyle: activeLink.inlineStyle || null,
      isImage: activeLink.isImage === true,
    });
  }

  return segments;
}

function parseInlineBlockToken(inlineToken, blockType, level) {
  const inlines = parseInlineChildren(inlineToken?.children || []);
  const text = inlineSegmentsToText(inlines);

  if (!text && !inlines.length) {
    return null;
  }

  const block = {
    type: blockType,
    text,
    inlines,
  };

  if (blockType === 'heading') {
    block.level = level;
  }

  return block;
}

function markListCompactBreak(block, listItem) {
  if (!block || !listItem) {
    return block;
  }

  return {
    ...block,
    compactBreak: true,
  };
}

function prependListMarker(block, marker) {
  const normalizedMarker = String(marker || '').trim();
  if (!block || !normalizedMarker) {
    return block;
  }

  const prefixedText = `${normalizedMarker} ${block.text || ''}`.trim();
  const alreadyPrefixed = String(block.text || '').startsWith(`${normalizedMarker} `)
    || String(block.text || '') === normalizedMarker;

  if (alreadyPrefixed) {
    return block;
  }

  return {
    ...block,
    text: prefixedText,
    inlines: [
      { type: 'text', text: normalizedMarker, inlineStyle: null },
      ...(block.inlines || []),
    ],
  };
}

function parseMarkdownBuffer(input) {
  const rawText = normalizeLooseMarkdown(
    input.toString('utf8').replace(/\r\n/g, '\n').trim()
  );

  if (!rawText) {
    return {
      format: 'markdown',
      blocks: [],
    };
  }

  const tokens = markdownParser.parse(rawText, {});
  const blocks = [];
  const listStack = [];
  const listItemStack = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];

    if (token.type === 'ordered_list_open') {
      const start = Number(getAttr(token, 'start')) || 1;
      listStack.push({
        type: 'ordered',
        nextIndex: start,
      });
      continue;
    }

    if (token.type === 'bullet_list_open') {
      listStack.push({
        type: 'bullet',
      });
      continue;
    }

    if (token.type === 'ordered_list_close' || token.type === 'bullet_list_close') {
      listStack.pop();
      continue;
    }

    if (token.type === 'list_item_open') {
      const currentList = listStack[listStack.length - 1];
      let marker = null;

      if (currentList?.type === 'ordered') {
        marker = `${currentList.nextIndex}.`;
        currentList.nextIndex += 1;
      } else if (currentList?.type === 'bullet') {
        marker = '-';
      }

      listItemStack.push({
        marker,
        markerApplied: false,
      });
      continue;
    }

    if (token.type === 'list_item_close') {
      listItemStack.pop();
      continue;
    }

    if (token.type === 'hr') {
      blocks.push({ type: 'separator', text: '' });
      continue;
    }

    if (token.type === 'heading_open') {
      const level = Number(String(token.tag || '').replace('h', '')) || 1;
      const inlineToken = tokens[i + 1];
      let block = parseInlineBlockToken(inlineToken, 'heading', level);
      if (block) {
        const currentListItem = listItemStack[listItemStack.length - 1];
        block = markListCompactBreak(block, currentListItem);
        if (currentListItem && currentListItem.marker && !currentListItem.markerApplied) {
          block = prependListMarker(block, currentListItem.marker);
          currentListItem.markerApplied = true;
        }
        blocks.push(block);
      }
      i += 2;
      continue;
    }

    if (token.type === 'paragraph_open') {
      const inlineToken = tokens[i + 1];
      const isQuote = tokens[i - 1]?.type === 'blockquote_open';
      let block = parseInlineBlockToken(inlineToken, isQuote ? 'quote' : 'paragraph');
      if (block) {
        const currentListItem = listItemStack[listItemStack.length - 1];
        block = markListCompactBreak(block, currentListItem);
        if (currentListItem && currentListItem.marker && !currentListItem.markerApplied) {
          block = prependListMarker(block, currentListItem.marker);
          currentListItem.markerApplied = true;
        }
        blocks.push(block);
      }
      i += 2;
      continue;
    }

    if (token.type === 'fence' || token.type === 'code_block') {
      const codeText = String(token.content || '').replace(/\s+/g, ' ').trim();
      if (codeText) {
        blocks.push({
          type: 'paragraph',
          text: codeText,
          inlines: [{ type: 'text', text: codeText, inlineStyle: 'code' }],
        });
      }
    }
  }

  return {
    format: 'markdown',
    blocks,
  };
}

module.exports = {
  parseMarkdownBuffer,
};
