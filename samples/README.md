# Illustrated Alice sample

[Open the PDF](alice-microbook.pdf) · [Render settings](alice-settings.json)

Complete **Alice’s Adventures in Wonderland**, by Lewis Carroll, illustrated by Arthur Rackham, with a proem by Austin Dobson. [Project Gutenberg ebook 28885](https://www.gutenberg.org/ebooks/28885) is identified as **public domain in the United States**. Check local law elsewhere. Credits and the Project Gutenberg license remain in the PDF. This reformatted MicroBook sample is not endorsed by Project Gutenberg.

- Source: https://www.gutenberg.org/cache/epub/28885/pg28885-images-3.epub
- Source SHA-256: 17bb2c40e514a7cf4f0c6d0139aadad45c82a535a2a2202aa3da3c4501186e64
- PDF SHA-256: 60ba5a803f4b3e0bea147f2f8c59d9d22efeccf3c81ef06c00fac594c3082602
- Rich layout: Letter portrait, 6 CSS px / 4.5 pt, 7 printed sides / 4 duplex sheets.
- Images: Laser optimized, Gentle. Default source section inclusion retained.
- Generated from MicroBook commit 96b97f0. PDF bytes include generation timestamps.

Print at actual size / 100%, without an additional pages-per-sheet setting. Check duplex direction and folding on one sheet first. The final sheet has only a front side.

Reproduce using the pinned EPUB cached by the full test suite:

```sh
npm run mb -- render --input .cache/public-books/alice.epub --mode rich --settings samples/alice-settings.json --out .artifacts/alice-sample
```

The README screenshot shows this book and layout, with no private uploaded material.
