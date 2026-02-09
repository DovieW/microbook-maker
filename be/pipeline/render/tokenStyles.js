function buildTokenStyles({
  selectedFontStack,
  borderStyle,
}) {
  const safeBorderStyle = borderStyle || 'dashed';
  const safeFontStack = selectedFontStack || "Arial, sans-serif";

  return `
    .grid-item:nth-child(4n-2),
    .grid-item:nth-child(4n-1),
    .grid-item:nth-child(4n-3) {
      border-right: 1px ${safeBorderStyle} black;
    }

    .grid-item:nth-child(n+5) {
      border-top: 1px ${safeBorderStyle} black;
    }

    .grid-item {
      font-family: ${safeFontStack};
      text-align: left;
    }

    .miniSheetNum {
      display: inline-block;
      width: auto;
      text-align: left;
      text-justify: auto;
      white-space: nowrap;
      word-spacing: 0;
      margin-right: 0.25em;
    }

    .token {
      white-space: normal;
    }

    .token-break-paragraph-space {
      display: inline;
      white-space: pre;
      letter-spacing: 0;
      word-spacing: 0;
    }

    .token-body {
      font-family: ${safeFontStack};
      font-size: 1em;
      line-height: 1.05;
      letter-spacing: 0;
      word-spacing: 0;
      font-kerning: none;
      font-variant-ligatures: none;
    }

    .token-heading-1,
    .token-heading-2,
    .token-heading-3,
    .token-heading-4,
    .token-heading-5,
    .token-heading-6 {
      font-family: ${safeFontStack};
      font-weight: 700;
      line-height: 1.05;
      letter-spacing: 0;
      word-spacing: 0;
      font-kerning: none;
      font-variant-ligatures: none;
    }

    .token-heading-1 { font-size: 1.15em; }
    .token-heading-2 { font-size: 1.1em; }
    .token-heading-3 { font-size: 1.06em; }
    .token-heading-4,
    .token-heading-5,
    .token-heading-6 { font-size: 1em; }

    .token-quote {
      font-style: italic;
      color: #1f2d3d;
      word-spacing: 0;
      font-kerning: none;
      font-variant-ligatures: none;
    }

    .token-separator {
      display: block;
      border-top: 1px solid #333;
      margin: 0.2em 0;
    }

    .token-inline-strong {
      font-weight: 700;
    }

    .token-inline-emphasis {
      font-style: italic;
      letter-spacing: 0;
      word-spacing: 0;
    }

    .token-inline-code {
      font-family: 'Courier New', Courier, monospace;
      background: rgba(0, 0, 0, 0.08);
      border-radius: 2px;
      padding: 0 0.12em;
    }

    .token-link-label {
      text-decoration: none;
      color: #222;
      font-weight: 500;
      overflow-wrap: anywhere;
    }

    .token-link-url {
      text-decoration: none;
      color: #333;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .token-link-bare {
      text-decoration: none;
      color: #222;
      font-weight: 500;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
  `;
}

module.exports = {
  buildTokenStyles,
};
