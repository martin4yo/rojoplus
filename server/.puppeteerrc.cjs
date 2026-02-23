const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Cambiar la ruta de caché para evitar problemas
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),

  // Descargar Chrome automáticamente
  skipChromeDownload: false,
  skipChromeHeadlessShellDownload: false,
};
