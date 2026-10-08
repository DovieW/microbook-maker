# MicroBook 2.5

You can now import PDFs alongside EPUBs and text files. Each PDF page keeps its original layout, text, and images, and can be printed across rows, by quadrant, or as a bound booklet.

## What’s new

- **PDF import.** Basic and Rich stay visible but disabled, with an explanation that PDF pages keep their layout. A Pages tab lets you include, reorder, rotate, and preview individual pages before clicking Apply.
- **PDF layout controls.** Choose one, two, or four cells per source page, set padding and orientation, and optionally show source page numbers. Booklet PDFs offer the same page sizing, signatures, binding margin, guides, and Reading / Print sheets previews as EPUB booklets.
- **Local PDF processing on Cloudflare.** PDF generation happens in your browser and does not use the hosted EPUB renderer’s browser quota.
- **Cleaner history.** An empty library shows a simple import prompt. Opening a saved book or kept version takes you to Layout.

PDF downloads preserve vector text and images. Blank source pages are kept, and existing form appearances are included. Password-protected PDFs need to be unlocked before importing.

## Printing

Use **portrait US Letter**, **100% / actual size**, and **one page per sheet**. Bound booklets use duplex **flip on long edge**; cut the solid guides, fold the dashed guides, and nest the numbered pieces within each signature.

Existing EPUB, Basic, and folded-sheet settings remain available. Changes still require Apply, and previously generated PDFs stay unchanged.

## Upgrading

Back up both persistent volumes and reuse the existing mounts and port. Do not run `docker compose down -v`. See [deployment and rollback instructions](DEPLOYMENT.md) and [booklet printing](docs/BOUND_BOOKLET.md).
