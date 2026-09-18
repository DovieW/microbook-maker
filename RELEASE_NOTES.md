# MicroBook 2.1

This release improves Rich EPUB navigation, sheet identification, and image flow.

## What’s new

- **Better contents.** Full tables of contents stay at the front, include the EPUB’s deeper navigation entries, and use clearer, self-contained content previews.
- **Clearer sheet headers.** The book and sheet headers are larger. Each sheet can show its number, book title, and print date in a compact header.
- **Smarter opening images.** Two-cell images can favor text first, images first, or preserve the source order. Text first is the default and avoids leaving an empty opening cell by moving following text ahead of the image.
- **Repeated artwork controls.** Repeated images are detected between paragraphs, quotations, and list items. Their preview and shared settings now use the same expandable content-row design as other images.
- **Reproducible verification.** The public-domain EPUB fixtures used by the release checks are pinned in the repository.

## Upgrading

Back up both persistent volumes and keep the previous container image before upgrading. Reuse the same compose project, volumes, and mount paths so the existing library remains available. Do not run `docker compose down -v`.

See [deployment and rollback instructions](DEPLOYMENT.md). Existing PDFs remain stored as originally rendered; applying settings again uses the updated renderer and can change page flow.
