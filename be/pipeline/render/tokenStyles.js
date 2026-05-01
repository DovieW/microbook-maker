const SAFE_BORDER_STYLES = new Set(['dashed', 'solid', 'dotted']);

function normalizeBorderStyle(borderStyle) {
  return SAFE_BORDER_STYLES.has(borderStyle) ? borderStyle : 'dashed';
}

function buildTokenStyles({
  selectedFontStack,
  borderStyle,
}) {
  const safeBorderStyle = normalizeBorderStyle(borderStyle);
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
      --microbook-line-height: 1;
      --microbook-word-spacing: 0px;
      --microbook-letter-spacing: 0px;
      --microbook-text-align: left;
      text-align: var(--microbook-text-align, left);
      text-align-last: left;
      text-justify: inter-word;
    }

    .grid-item.microbook-horizontal-justified {
      --microbook-text-align: justify;
    }

    .grid-item.microbook-horizontal-justified .main-header {
      text-align: left;
      text-align-last: left;
    }

    .grid-item.microbook-horizontal-justified .token-body,
    .grid-item.microbook-horizontal-justified .token-heading-1,
    .grid-item.microbook-horizontal-justified .token-heading-2,
    .grid-item.microbook-horizontal-justified .token-heading-3,
    .grid-item.microbook-horizontal-justified .token-heading-4,
    .grid-item.microbook-horizontal-justified .token-heading-5,
    .grid-item.microbook-horizontal-justified .token-heading-6,
    .grid-item.microbook-horizontal-justified .token {
      hyphens: auto;
      overflow-wrap: normal;
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
      white-space: normal;
      letter-spacing: 0;
      word-spacing: 0;
    }

    .token-body {
      font-family: ${safeFontStack};
      font-size: 1em;
      line-height: var(--microbook-line-height, 1);
      letter-spacing: var(--microbook-letter-spacing, 0px);
      word-spacing: var(--microbook-word-spacing, 0px);
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
      line-height: var(--microbook-line-height, 1);
      letter-spacing: var(--microbook-letter-spacing, 0px);
      word-spacing: var(--microbook-word-spacing, 0px);
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
      line-height: var(--microbook-line-height, 1);
      letter-spacing: var(--microbook-letter-spacing, 0px);
      word-spacing: var(--microbook-word-spacing, 0px);
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
  normalizeBorderStyle,
};
