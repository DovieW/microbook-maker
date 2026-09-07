// Read the small subset of publisher CSS that affects content and inline semantics.
// Conditional device styles must not leak into the default EPUB presentation.
type Node = any;
type Rule = { selector: string; declarations: [string, string, boolean][]; specificity: number };
const properties = new Set([
  'display',
  'visibility',
  'text-align',
  'font-weight',
  'font-style',
  'white-space',
]);
function declarations(css: string): Rule['declarations'] {
  return css.split(';').flatMap((rule) => {
    const colon = rule.indexOf(':');
    const key = rule.slice(0, colon).trim().toLowerCase();
    if (colon < 0 || !properties.has(key)) return [];
    const value = rule
      .slice(colon + 1)
      .trim()
      .toLowerCase();
    return [[key, value.replace(/\s*!important\s*$/, ''), /!important\s*$/.test(value)]];
  });
}
function rules(css: string): Rule[] {
  const result: Rule[] = [];
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let start = 0,
    opening = -1,
    depth = 0,
    quote = '';
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (c === ';' && depth === 0) {
      start = i + 1;
      continue;
    }
    if (c === '{') {
      if (depth++ === 0) opening = i;
    }
    if (c !== '}' || --depth !== 0) continue;
    const selector = css.slice(start, opening).trim();
    const body = css.slice(opening + 1, i);
    start = i + 1;
    if (/^@media\s+(all|screen)\s*$/i.test(selector)) result.push(...rules(body));
    else if (!selector.startsWith('@')) {
      for (const s of selector.split(',').map((s) => s.trim())) {
        // Unsupported selectors are ignored as a whole, never broadened to a class match.
        if (!s || /[:+~|]/.test(s.replace(/\[[^\]]*\]/g, ''))) continue;
        result.push({
          selector: s,
          declarations: declarations(body),
          specificity:
            (s.match(/#/g)?.length || 0) * 100 +
            (s.match(/[.\[]/g)?.length || 0) * 10 +
            (s.match(/(?:^|[ >])\w/g)?.length || 0),
        });
      }
    }
  }
  return result;
}
function simple(node: Node, selector: string): boolean {
  if (node?.nodeType !== 1) return false;
  const tag = selector.match(/^[\w*-]+/)?.[0];
  if (tag && tag !== '*' && (node.localName || node.nodeName).toLowerCase() !== tag.toLowerCase())
    return false;
  const classes = new Set((node.getAttribute('class') || '').split(/\s+/));
  for (const m of selector.matchAll(/([.#])([\w-]+)/g)) {
    if (m[1] === '.' ? !classes.has(m[2]) : node.getAttribute('id') !== m[2]) return false;
  }
  for (const m of selector.matchAll(/\[([\w-]+)(?:\s*(=|~=)\s*["']?([^"'\]]+)["']?)?\]/g)) {
    if (!node.hasAttribute(m[1])) return false;
    const value = node.getAttribute(m[1]);
    if (m[2] === '=' && value !== m[3]) return false;
    if (m[2] === '~=' && !value.split(/\s+/).includes(m[3])) return false;
  }
  return /^[\w*#.\-[\]="'\s~]+$/.test(selector);
}
function matches(node: Node, selector: string): boolean {
  const parts = selector.replace(/\s*>\s*/g, ' > ').split(/\s+(?![^\[]*\])/);
  let i = parts.length - 1;
  if (!simple(node, parts[i--])) return false;
  while (i >= 0) {
    node = node.parentNode;
    if (parts[i] === '>') {
      if (!simple(node, parts[--i])) return false;
    } else {
      while (node && !simple(node, parts[i])) node = node.parentNode;
      if (!node) return false;
    }
    i--;
  }
  return true;
}
export function epubStyles(css: string) {
  const parsed = rules(css);
  const cache = new WeakMap<Node, { hidden: boolean; style: string; inherited: Map<string, string> }>();
  function resolve(node: Node): { hidden: boolean; style: string; inherited: Map<string, string> } {
    if (node?.nodeType !== 1) return { hidden: false, style: '', inherited: new Map() };
    const cached = cache.get(node);
    if (cached) return cached;
    const parent = resolve(node.parentNode);
    const cascade = new Map<string, { value: string; rank: number }>();
    const apply = (ds: Rule['declarations'], specificity: number) => {
      for (const [key, value, important] of ds) {
        const rank = specificity + (important ? 100_000 : 0);
        if (rank >= (cascade.get(key)?.rank ?? -1)) cascade.set(key, { value, rank });
      }
    };
    for (const rule of parsed) if (matches(node, rule.selector)) apply(rule.declarations, rule.specificity);
    apply(declarations(node.getAttribute('style') || ''), 10_000);
    const inherited = new Map(parent.inherited);
    for (const [key, { value }] of cascade) if (key !== 'display') inherited.set(key, value);
    const hidden = parent.hidden || node.hasAttribute('hidden') || cascade.get('display')?.value === 'none';
    const resolved = {
      hidden,
      inherited,
      style: [...inherited].map(([key, value]) => `${key}:${value}`).join(';'),
    };
    cache.set(node, resolved);
    return resolved;
  }
  return {
    hidden: (node: Node) => resolve(node).hidden || resolve(node).inherited.get('visibility') === 'hidden',
    style: (node: Node) => resolve(node).style,
  };
}
