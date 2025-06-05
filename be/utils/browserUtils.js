const puppeteer = require('puppeteer');

/**
 * Browser and page management utilities
 */

/**
 * Launch a new browser instance with standard configuration
 * @returns {Promise<Browser>} Puppeteer browser instance
 */
async function launchBrowser() {
  return await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-extensions',
      '--mute-audio',
    ],
    protocolTimeout: 1000000,
    headless: true,
    devtools: false,
  });
}

/**
 * Create a new page with standard settings
 * @param {Browser} browser - Puppeteer browser instance
 * @returns {Promise<Page>} Puppeteer page instance
 */
async function createPage(browser) {
  return await browser.newPage();
}

/**
 * Set up page console logging and progress tracking
 * @param {Page} page - Puppeteer page instance
 * @param {Function} progressCallback - Callback function for progress updates
 * @param {number} sheetsCount - Total number of sheets to process
 */
function setupPageLogging(page, progressCallback, sheetsCount) {
  page.on('console', pageIndex => {
    const n = Number(pageIndex.text());
    if (isNaN(n)) {
      console.log(pageIndex.text());
      return;
    }
    progressCallback(`Creating sheet ${n / 2} of ${sheetsCount}-ish.`);
  });
}

/**
 * Configure page styles
 * @param {Page} page - Puppeteer page instance
 * @param {string} fontSize - Font size in pixels
 * @param {string} borderStyle - Border style (dashed, solid, dotted)
 */
async function configurePageStyles(page, fontSize, borderStyle) {
  await page.addStyleTag({
    content: `body { font-size: ${fontSize}px; }`,
  });

  await page.addStyleTag({
    content: `
      .grid-item:nth-child(4n-2), 
      .grid-item:nth-child(4n-1), 
      .grid-item:nth-child(4n-3) {
          border-right: 1px ${borderStyle || 'dashed'} black;
      }
      .grid-item:nth-child(n+5) {
          border-top: 1px ${borderStyle || 'dashed'} black;
      }
    `,
  });
}

/**
 * Generate PDF from page content
 * @param {Page} page - Puppeteer page instance
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generatePdf(page) {
  return await page.pdf({ format: 'Letter' });
}

/**
 * Get HTML content from page
 * @param {Page} page - Puppeteer page instance
 * @returns {Promise<string>} HTML content
 */
async function getPageContent(page) {
  return await page.content();
}

module.exports = {
  launchBrowser,
  createPage,
  setupPageLogging,
  configurePageStyles,
  generatePdf,
  getPageContent,
};
