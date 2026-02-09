const { execFileSync } = require('child_process');

const FONT_OPTIONS = [
  {
    value: 'arial',
    label: 'Arial',
    stack: "Arial, 'Liberation Sans', 'Nimbus Sans L', sans-serif",
    detectionFamilies: ['Arial'],
  },
  {
    value: 'times-new-roman',
    label: 'Times New Roman',
    stack: "'Times New Roman', 'Liberation Serif', serif",
    detectionFamilies: ['Times New Roman'],
  },
  {
    value: 'georgia',
    label: 'Georgia',
    stack: "Georgia, 'Times New Roman', serif",
    detectionFamilies: ['Georgia'],
  },
  {
    value: 'courier-new',
    label: 'Courier New',
    stack: "'Courier New', 'Liberation Mono', monospace",
    detectionFamilies: ['Courier New'],
  },
  {
    value: 'dejavu-sans',
    label: 'DejaVu Sans',
    stack: "'DejaVu Sans', sans-serif",
    detectionFamilies: ['DejaVu Sans'],
  },
  {
    value: 'dejavu-serif',
    label: 'DejaVu Serif',
    stack: "'DejaVu Serif', serif",
    detectionFamilies: ['DejaVu Serif'],
  },
  {
    value: 'dejavu-sans-mono',
    label: 'DejaVu Sans Mono',
    stack: "'DejaVu Sans Mono', monospace",
    detectionFamilies: ['DejaVu Sans Mono'],
  },
];

const FONT_STACKS = Object.fromEntries(FONT_OPTIONS.map((option) => [option.value, option.stack]));
const FONT_VALUES = new Set(FONT_OPTIONS.map((option) => option.value));

const DEFAULT_FONT_FAMILY = 'arial';

function normalizeFamilyName(familyName) {
  return String(familyName || '')
    .replace(/['"]/g, '')
    .trim()
    .toLowerCase();
}

function parseInstalledFamilies(fcListOutput) {
  return new Set(
    String(fcListOutput || '')
      .split(/\r?\n/)
      .flatMap((line) => line.split(','))
      .map(normalizeFamilyName)
      .filter(Boolean)
  );
}

function detectInstalledFamilies() {
  try {
    const output = execFileSync('fc-list', [':', 'family'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    return parseInstalledFamilies(output);
  } catch (error) {
    return null;
  }
}

function getAvailableFontOptions({ installedFamilies } = {}) {
  const families = installedFamilies ?? detectInstalledFamilies();
  if (families === null) {
    return FONT_OPTIONS.map(({ value, label }) => ({ value, label }));
  }

  return FONT_OPTIONS
    .filter((option) => option.detectionFamilies.some((family) => families.has(normalizeFamilyName(family))))
    .map(({ value, label }) => ({ value, label }));
}

function getDefaultFontFamily(fontOptions = FONT_OPTIONS.map(({ value, label }) => ({ value, label }))) {
  if (fontOptions.some((option) => option.value === DEFAULT_FONT_FAMILY)) {
    return DEFAULT_FONT_FAMILY;
  }

  if (fontOptions.length > 0) {
    return fontOptions[0].value;
  }

  return DEFAULT_FONT_FAMILY;
}

function getAllowedValuesSet(allowedValues) {
  if (!allowedValues) {
    return FONT_VALUES;
  }

  if (allowedValues instanceof Set) {
    return allowedValues;
  }

  return new Set(Array.from(allowedValues));
}

function resolveFontFamily(value, { allowedValues } = {}) {
  const allowedSet = getAllowedValuesSet(allowedValues);
  const defaultFontFamily = getDefaultFontFamily(FONT_OPTIONS
    .filter((option) => allowedSet.has(option.value))
    .map(({ value: optionValue, label }) => ({ value: optionValue, label })));

  const normalized = String(value || '').trim().toLowerCase();
  if (!FONT_STACKS[normalized]) {
    return defaultFontFamily;
  }

  if (!allowedSet.has(normalized)) {
    return defaultFontFamily;
  }

  return normalized;
}

function getFontStack(value, { allowedValues } = {}) {
  const resolved = resolveFontFamily(value, { allowedValues });
  return FONT_STACKS[resolved];
}

module.exports = {
  FONT_OPTIONS,
  DEFAULT_FONT_FAMILY,
  getAvailableFontOptions,
  getDefaultFontFamily,
  resolveFontFamily,
  getFontStack,
};
