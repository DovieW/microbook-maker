# MicroBook 2.3

This release adds more control over book content and image placement, plus an experimental paper-folding simulator.

## What’s new

- **Folding simulator.** Try folds on a labeled 3D sheet, inspect its layers, rotate and pan, and record, replay, save or export a folding method. This is a prototype: it does not simulate real paper stiffness, friction, cuts or diagonal folds, and it does not yet show the book’s PDF on the paper.
- **Spoiler-free viewing.** A header toggle blurs book content in the interface without changing the printed PDF.
- **Clearer content inspection.** Excluded and empty sections have distinct statuses. Source content can be inspected even when a section has no printed location.
- **Image layout choices.** Choose Flourish, Inline, Full cell, Full two cells or Full four cells. Individual and repeated images can inherit defaults or override them.
- **Orientation defaults.** Set a book-wide image orientation, with overrides for individual images and repeated groups.
- **Less wasted space.** Text first also works with full-cell images and continues across EPUB file splits. Recognized chart source credits stay with their images. A new setting, on by default, allows following text to fill unused space below single-cell images.
- **Tighter typography.** Rich line height can be reduced to 0.5.

## Upgrading

Back up both persistent volumes and retain the previous image. Reuse the existing volumes, mounts and port. Do not run `docker compose down -v`.

Existing PDFs remain unchanged. Click Apply to regenerate a book with the new layout behavior. Folding methods and interface preferences are saved in the browser.

See [deployment and rollback instructions](DEPLOYMENT.md) and [folding simulator limits](docs/FOLDING_SIMULATOR.md).
