const fs = require('fs');
const path = require('path');

/**
 * Service for managing PDF generation progress
 * Provides structured progress information for frontend consumption
 */
class ProgressService {
  constructor() {
    this.progressDir = path.join(__dirname, '..', 'generated');
  }

  /**
   * Write structured progress information to file
   * @param {string} id - Generation ID
   * @param {Object} progressInfo - Progress information
   */
  writeProgress(id, progressInfo) {
    const progressPath = path.join(this.progressDir, `PROGRESS_${id}.json`);
    const timestamp = new Date().toISOString();
    
    const progressData = {
      id,
      timestamp,
      ...progressInfo
    };

    try {
      // Ensure the directory exists
      const dir = path.dirname(progressPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(progressPath, JSON.stringify(progressData, null, 2));
      console.log(`Progress updated for ${id}: ${progressInfo.step} - ${progressInfo.percentage}%`);
    } catch (error) {
      console.error('Failed to write progress:', error);
    }
  }

  /**
   * Read progress information from file
   * @param {string} id - Generation ID
   * @returns {Object|null} Progress information or null if not found
   */
  readProgress(id) {
    const progressPath = path.join(this.progressDir, `PROGRESS_${id}.json`);
    
    try {
      if (fs.existsSync(progressPath)) {
        const data = fs.readFileSync(progressPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to read progress:', error);
    }
    
    return null;
  }

  /**
   * Clean up progress file when generation is complete
   * @param {string} id - Generation ID
   */
  cleanupProgress(id) {
    const progressPath = path.join(this.progressDir, `PROGRESS_${id}.json`);
    
    try {
      if (fs.existsSync(progressPath)) {
        fs.unlinkSync(progressPath);
      }
    } catch (error) {
      console.error('Failed to cleanup progress:', error);
    }
  }

  /**
   * Create progress info for initialization
   * @param {string} bookName - Name of the book
   * @param {number} estimatedSheets - Estimated number of sheets
   * @returns {Object} Progress information
   */
  createInitialProgress(bookName, estimatedSheets = 0) {
    return {
      step: `Initializing: ${bookName}`,
      percentage: 5,
      currentSheet: 0,
      totalSheets: estimatedSheets,
      isComplete: false,
      isError: false,
      phase: 'initialization'
    };
  }

  /**
   * Create progress info for page creation
   * @param {number} currentSheet - Current sheet being processed
   * @param {number} totalSheets - Total number of sheets
   * @returns {Object} Progress information
   */
  createPageProgress(currentSheet, totalSheets) {
    const percentage = Math.min(90, Math.round((currentSheet / totalSheets) * 75) + 10); // 10-85% range
    
    return {
      step: `Creating sheet ${currentSheet} of ${totalSheets}`,
      percentage,
      currentSheet,
      totalSheets,
      isComplete: false,
      isError: false,
      phase: 'page_creation'
    };
  }

  /**
   * Create progress info for PDF generation
   * @returns {Object} Progress information
   */
  createPdfProgress() {
    return {
      step: 'Generating PDF file',
      percentage: 95,
      isComplete: false,
      isError: false,
      phase: 'pdf_generation'
    };
  }

  /**
   * Create progress info for completion
   * @returns {Object} Progress information
   */
  createCompletionProgress() {
    return {
      step: 'Complete',
      percentage: 100,
      isComplete: true,
      isError: false,
      phase: 'complete'
    };
  }

  /**
   * Create progress info for error
   * @param {string} errorMessage - Error message
   * @param {string} phase - Phase where error occurred
   * @returns {Object} Progress information
   */
  createErrorProgress(errorMessage, phase = 'unknown') {
    return {
      step: 'Error',
      percentage: 0,
      isComplete: false,
      isError: true,
      errorMessage,
      phase
    };
  }

  /**
   * Parse legacy progress text and convert to structured format
   * @param {string} text - Legacy progress text
   * @returns {Object} Structured progress information
   */
  parseLegacyProgress(text) {
    let progress = {
      step: text,
      percentage: 0,
      isComplete: false,
      isError: false,
      phase: 'unknown'
    };

    // Parse different progress messages
    if (text.includes('Creating:')) {
      progress.step = 'Initializing';
      progress.percentage = 10;
      progress.phase = 'initialization';
    } else if (text.includes('Creating sheet')) {
      // Extract sheet numbers: "Creating sheet 5 of 10-ish."
      const match = text.match(/Creating sheet (\d+(?:\.\d+)?) of (\d+)/);
      if (match) {
        const current = parseFloat(match[1]);
        const total = parseInt(match[2]);
        progress.currentSheet = Math.floor(current);
        progress.totalSheets = total;
        progress.percentage = Math.min(90, Math.round((current / total) * 80) + 10); // 10-90% range
        progress.step = `Creating sheet ${Math.floor(current)} of ${total}`;
        progress.phase = 'page_creation';
      } else {
        progress.step = 'Creating pages';
        progress.percentage = 50;
        progress.phase = 'page_creation';
      }
    } else if (text.includes('Finished creating pages')) {
      progress.step = 'Generating PDF';
      progress.percentage = 95;
      progress.phase = 'pdf_generation';
    } else if (text.includes('Writing to file')) {
      progress.step = 'Finalizing PDF';
      progress.percentage = 98;
      progress.phase = 'pdf_generation';
    } else if (text.startsWith('ERROR:')) {
      progress.step = 'Error';
      progress.percentage = 0;
      progress.isError = true;
      progress.errorMessage = text.replace('ERROR: ', '');
      progress.phase = 'error';
    } else {
      // Generic progress based on keywords
      if (text.toLowerCase().includes('start')) {
        progress.percentage = 5;
        progress.phase = 'initialization';
      } else if (text.toLowerCase().includes('process')) {
        progress.percentage = 30;
        progress.phase = 'processing';
      } else if (text.toLowerCase().includes('finish')) {
        progress.percentage = 90;
        progress.phase = 'finalizing';
      }
    }

    return progress;
  }
}

module.exports = new ProgressService();
