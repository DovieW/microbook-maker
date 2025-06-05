const {
  writeToInProgress,
  cleanupInProgressFile,
  readTextFile,
  writePdfFile,
  writeHtmlOutput,
} = require('../utils/fileUtils');
const {
  launchBrowser,
  createPage,
  setupPageLogging,
  configurePageStyles,
  generatePdf,
  getPageContent,
} = require('../utils/browserUtils');
const { createPageContentScript } = require('../utils/contentUtils');

/**
 * Main PDF generation service
 */
class PdfGenerationService {
  /**
   * Generate PDF from uploaded file
   * @param {Object} params - Generation parameters
   * @param {string} params.filePath - Path to the uploaded text file
   * @param {string} params.id - Unique identifier for the process
   * @param {string} params.bookName - Name of the book
   * @param {string} params.fontSize - Font size for the PDF
   * @param {string} params.borderStyle - Border style for the grid
   * @param {Object} params.json - Complete configuration object
   * @returns {Promise<void>}
   */
  async generatePdf({ filePath, id, bookName, fontSize, borderStyle, json }) {
    let browser = null;

    try {
      // Initialize browser
      browser = await launchBrowser();
      const page = await createPage(browser);

      // Set up progress tracking
      const progressCallback = message => writeToInProgress(message, id);
      setupPageLogging(page, progressCallback, json.headerInfo.sheetsCount);

      // Read input file
      const text = readTextFile(filePath);

      // Navigate to page template
      const path = require('path');
      const pageHtmlPath = path.join(__dirname, '..', 'page.html');
      await page.goto(`file://${pageHtmlPath}`);

      // Configure styles
      await configurePageStyles(page, fontSize, borderStyle);

      // Update progress
      writeToInProgress(`Creating: ${bookName}`, id);

      // Generate page content
      const contentScript = createPageContentScript(json, text, bookName);
      await page.evaluate(contentScript, json, text, bookName);

      // Update progress
      writeToInProgress('Finished creating pages. Writing to file...', id);

      // Save HTML output for debugging
      const htmlContent = await getPageContent(page);
      writeHtmlOutput(htmlContent);

      // Generate and save PDF
      const pdfBuffer = await generatePdf(page);
      writePdfFile(pdfBuffer, id);

      // Clean up
      await browser.close();
      cleanupInProgressFile(id);

      console.log(`PDF generation completed for ID: ${id}`);
    } catch (error) {
      console.error(`PDF generation failed for ID: ${id}`, error);
      writeToInProgress('ERROR: ' + error.toString(), id);

      if (browser) {
        await browser.close();
      }

      throw error;
    }
  }
}

module.exports = PdfGenerationService;
