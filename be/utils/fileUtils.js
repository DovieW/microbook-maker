const fs = require('fs');
const path = require('path');

/**
 * File system utility functions
 */

/**
 * Ensure the generated directory exists
 */
function ensureGeneratedDirectoryExists() {
  const generatedDir = path.join(__dirname, '..', 'generated');
  if (!fs.existsSync(generatedDir)) {
    fs.mkdirSync(generatedDir, { recursive: true });
  }
}

/**
 * Write progress status to IN_PROGRESS file
 * @param {string} text - Progress text to write
 * @param {string} id - Unique identifier for the process
 */
function writeToInProgress(text, id) {
  console.log(`${text}`);
  ensureGeneratedDirectoryExists();
  const inProgressPath = path.join(
    __dirname,
    '..',
    'generated',
    `IN_PROGRESS_${id}.txt`,
  );
  fs.writeFileSync(inProgressPath, text);
}

/**
 * Check if IN_PROGRESS file exists and remove it
 * @param {string} id - Unique identifier for the process
 */
function cleanupInProgressFile(id) {
  const inProgressPath = path.join(
    __dirname,
    '..',
    'generated',
    `IN_PROGRESS_${id}.txt`,
  );
  if (fs.existsSync(inProgressPath)) {
    fs.unlinkSync(inProgressPath);
  }
}

/**
 * Read text file content
 * @param {string} filePath - Path to the text file
 * @returns {string} File content as string
 */
function readTextFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Write PDF buffer to file
 * @param {Buffer} pdfBuffer - PDF buffer data
 * @param {string} id - Unique identifier for the file
 */
function writePdfFile(pdfBuffer, id) {
  ensureGeneratedDirectoryExists();
  const pdfOutput = path.join(__dirname, '..', 'generated', `${id}.pdf`);
  fs.writeFileSync(pdfOutput, pdfBuffer);
}

/**
 * Write HTML content to output file
 * @param {string} htmlContent - HTML content to write
 */
function writeHtmlOutput(htmlContent) {
  fs.writeFileSync(path.join(__dirname, 'output.html'), htmlContent);
}

/**
 * Check if files exist for download endpoint
 * @param {string} id - Unique identifier
 * @returns {Object} Object containing file existence status and paths
 */
function checkFileStatus(id) {
  const pdfOutput = path.join(__dirname, '..', 'generated', `${id}.pdf`);
  const inProgressPath = path.join(
    __dirname,
    '..',
    'generated',
    `IN_PROGRESS_${id}.txt`,
  );

  return {
    pdfExists: fs.existsSync(pdfOutput),
    inProgressExists: fs.existsSync(inProgressPath),
    pdfPath: pdfOutput,
    inProgressPath: inProgressPath,
  };
}

/**
 * Read IN_PROGRESS file content
 * @param {string} inProgressPath - Path to IN_PROGRESS file
 * @returns {string} File content
 */
function readInProgressFile(inProgressPath) {
  return fs.readFileSync(inProgressPath, 'utf8');
}

module.exports = {
  writeToInProgress,
  cleanupInProgressFile,
  readTextFile,
  writePdfFile,
  writeHtmlOutput,
  checkFileStatus,
  readInProgressFile,
  ensureGeneratedDirectoryExists,
};
