const multer = require('multer');
const express = require('express');
const PdfGenerationService = require('./services/pdfGenerationService');
const { checkFileStatus, readInProgressFile } = require('./utils/fileUtils');

const app = express();
const port = 3001;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const date = new Date();
    const formattedDate = `${date.getFullYear()}${date.getMonth() + 1}${date.getDate()}${date.getHours()}${date.getMinutes()}${date.getSeconds()}`;
    const fileName = `${formattedDate}_${file.originalname}`;
    cb(null, fileName);
  },
});

const upload = multer({ storage: storage });
const pdfService = new PdfGenerationService();

/**
 * Generate unique ID for PDF generation process
 * @param {string} bookName - Name of the book
 * @param {string} fontSize - Font size
 * @returns {string} Unique identifier
 */
function generateProcessId(bookName, fontSize) {
  const date = new Date();
  return `${date.getFullYear()}${date.getMonth() + 1}${date.getDate()}${date.getHours()}${date.getMinutes()}${date.getSeconds()}_${bookName}_${fontSize}`;
}

/**
 * Handle file upload and start PDF generation
 */
app.post('/api/upload', upload.fields([{ name: 'file' }]), async (req, res) => {
  try {
    const json = JSON.parse(req.body.params);
    const { bookName, borderStyle } = json;
    const { fontSize } = json.headerInfo;

    const id = generateProcessId(bookName, fontSize);

    // Start PDF generation asynchronously
    setImmediate(async () => {
      try {
        await pdfService.generatePdf({
          filePath: req.files.file[0].path,
          id,
          bookName,
          fontSize,
          borderStyle,
          json,
        });
      } catch (error) {
        console.error('PDF generation error:', error);
      }
    });

    res.json({ message: 'PDF creation started.', id });
  } catch (error) {
    console.error('Upload endpoint error:', error);
    res.status(500).json({ error: 'Failed to start PDF generation' });
  }
});

/**
 * Handle download requests and status checks
 */
app.get('/api/download/', (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).send('Missing ID parameter');
    }

    const fileStatus = checkFileStatus(id);

    if (fileStatus.pdfExists) {
      res.redirect(`/history/${id}.pdf`);
    } else if (fileStatus.inProgressExists) {
      const progressContent = readInProgressFile(fileStatus.inProgressPath);
      res.send(progressContent);
    } else {
      res.send('Not started. It\'s either in the queue, or failed entirely.');
    }
  } catch (error) {
    console.error('Download endpoint error:', error);
    res.status(500).send('Internal server error');
  }
});

/**
 * Start the server
 */
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
