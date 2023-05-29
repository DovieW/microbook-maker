import express, { Request, Response } from 'express';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import multer from 'multer';

const app = express();
const port = 3001;
const upload = multer({ dest: 'uploads/' });

app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    console.log(req);
    // Create a new PDF
    let doc = new PDFDocument();

     // Handle the 'finish' event of the PDF stream
    doc.on('finish', () => {
      // Once the PDF has been written to disk, send it in the response
      // res.sendFile(outputPath);
      res.send('PDF created!');
    });

    // Define the output file path
    const outputPath = path.join(__dirname, 'generated', `${uuidv4()}.pdf`);

    // Pipe the PDF output to a .pdf file
    doc.pipe(fs.createWriteStream(outputPath));

    // Read the uploaded text file and split it into words
    let text = fs.readFileSync(req.file!.path, 'utf8');
    let words = text.split(' ');

    // Now we'll add each word to the PDF, creating new pages and chunks as necessary
    let pageNumber = 1;
    let wordIndex = 0;
    let chunkX = 0, chunkY = 0;
    const chunkWidth = doc.page.width / 4;   // We'll divide each page into 16 parts
    const chunkHeight = doc.page.height / 4;
    const fontSize = 12;  // The font size
    doc.fontSize(fontSize);
    const wordsPerLine = Math.floor(chunkWidth / (fontSize / 2.2));  // Estimate of words per line based on font size
    const linesPerChunk = Math.floor(chunkHeight / (fontSize * 1.5));  // Estimate of lines per chunk based on font size
    const wordsPerChunk = wordsPerLine * linesPerChunk;

    while (wordIndex < words.length) {
      // Add the page number to the top of the page
      doc.text(`Page ${pageNumber}`, 0, 0);

      // Add each chunk of text to the page
      for (let i = 0; i < 16; i++) {
        if (wordIndex < words.length) {
          let chunkText = words.slice(wordIndex, wordIndex + wordsPerChunk).join(' ');
          doc.text(chunkText, chunkX, chunkY, { width: chunkWidth, height: chunkHeight });
          wordIndex += wordsPerChunk;

          // Update the chunk position for the next chunk
          chunkX += chunkWidth;
          if (chunkX >= doc.page.width) {
            chunkX = 0;
            chunkY += chunkHeight;
          }
        }
      }

      // Create a new page if there are more words to add
      if (wordIndex < words.length) {
        doc.addPage();
        chunkX = 0;
        chunkY = 0;
        pageNumber++;
      }
    }

    // Finalize the PDF and end the stream
    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred while creating the PDF.');
  }  
});


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
