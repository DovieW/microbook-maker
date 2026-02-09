const { getSupportedExtensions } = require('../pipeline/documentPipeline');
const { getAvailableFontOptions, getDefaultFontFamily } = require('../pipeline/render/fontCatalog');

function getCapabilities({ installedFamilies } = {}) {
  const fontOptions = getAvailableFontOptions({ installedFamilies });
  const defaultFontFamily = getDefaultFontFamily(fontOptions);

  return {
    acceptedFormats: getSupportedExtensions(),
    maxUploadSizeBytes: 10 * 1024 * 1024,
    fontOptions,
    defaults: {
      format: '.txt',
      borderStyle: 'dashed',
      fontSize: '6',
      fontFamily: defaultFontFamily,
    },
  };
}

module.exports = {
  getCapabilities,
};
