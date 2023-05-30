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
    let doc = new PDFDocument({font: 'Poppins-Regular.ttf', margin: 15});
    // doc.columns

    // Define the output file path
    const outputPath = path.join(__dirname, 'generated', `${uuidv4()}.pdf`);

    doc.pipe(fs.createWriteStream(outputPath));

    let text = fs.readFileSync(req.file!.path, 'utf8');
    text = text.replace(/(\r\n|\n|\r)/g, "   ");
    text = text.replace(/ {4,}/g, "   ");
    // let words = text.split(' ');

    // let pageNumber = 1;
    // let wordIndex = 0;
    // let chunkX = 0, chunkY = 0;
    // const chunkWidth = doc.page.width / 4;   // divide each page into 16 parts
    const chunkHeight = doc.page.height / 4;
    // const fontSize = 7; 
    // doc.fontSize(fontSize);
    // const wordsPerLine = Math.floor(chunkWidth / (fontSize / 2.2));
    // const linesPerChunk = Math.floor(chunkHeight / (fontSize * 1.5));
    // const wordsPerChunk = wordsPerLine * linesPerChunk;

    doc
      .fontSize(7)
      .text(text, {
        columns: 4, 
        columnGap: 10,
        align: 'justify',
        ellipsis: true,
      });

    // while (wordIndex < words.length) {
    //   doc.text(`Page ${pageNumber}`, 0, 0);
    //   doc.moveDown();

    //   for (let i = 0; i < 16; i++) {
    //     if (wordIndex < words.length) {
    //       let chunkText = words.slice(wordIndex, wordIndex + wordsPerChunk).join(' ');
    //       doc.text(chunkText, chunkX, chunkY, { width: chunkWidth, height: chunkHeight});
    //       wordIndex += wordsPerChunk;

    //       chunkX += chunkWidth;
    //       if (chunkX >= doc.page.width) {
    //         chunkX = 0;
    //         chunkY += chunkHeight;
    //       }
    //     }
    //   }

    //   if (wordIndex < words.length) {
    //     doc.addPage();
    //     chunkX = 0;
    //     chunkY = 0;
    //     pageNumber++;
    //   }
    // }

    doc.end();
    res.send('PDF created!');
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred while creating the PDF.');
  }  
});


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
