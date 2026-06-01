const test = require('node:test');
const assert = require('node:assert/strict');

const { getCapabilities } = require('../services/capabilitiesService');

test('getCapabilities includes font options and default font family', () => {
  const capabilities = getCapabilities({
    installedFamilies: new Set(['dejavu sans']),
  });

  assert.ok(Array.isArray(capabilities.fontOptions));
  assert.ok(capabilities.fontOptions.length > 0);
  assert.ok(capabilities.fontOptions.some((option) => option.value === 'dejavu-sans' && option.label === 'DejaVu Sans'));
  assert.ok(!capabilities.fontOptions.some((option) => option.value === 'arial'));

  assert.equal(capabilities.defaults.fontFamily, 'dejavu-sans');
});

test('getCapabilities keeps Arial available when Arimo is installed in the container', () => {
  const capabilities = getCapabilities({
    installedFamilies: new Set(['arimo', 'dejavu sans']),
  });

  assert.ok(capabilities.fontOptions.some((option) => option.value === 'arial' && option.label === 'Arial'));
  assert.equal(capabilities.defaults.fontFamily, 'arial');
});
