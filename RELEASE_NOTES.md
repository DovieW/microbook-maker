# MicroBook 2.4

Print a book as small pages you can cut, fold into signatures, and sew together. Rich mode now offers **Folded sheet** and **Bound booklet** near the top of Layout.

## What’s new

- **Booklet sizing and binding.** Choose pages one or two cells wide and one to four cells tall. Set one to eight folded pieces per signature and an alternating inner binding margin. The default is one-cell pages, four pieces (16 pages) per signature, and a 2 mm binding margin.
- **Two previews.** Reading shows pages in order and facing spreads. Print sheets shows the duplex arrangement. Download always produces the printable PDF; both previews use the same pagination.
- **Page-based navigation.** Contents, references, bookmarks, and content locations use booklet page numbers. Full-cell image treatments appear as Full page in booklet mode while retaining their folded-sheet settings.
- **Assembly controls.** Cut guides, dashed fold guides, and signature/piece labels can be switched independently. Page numbers remain visible. The last signature is smaller when possible; unused sheet positions are left empty.

Basic and existing books continue to use Folded sheet. Switching formats preserves their settings. Layout changes still require Apply.

## Printing a booklet

Use **portrait US Letter**, **100% / actual size**, **one page per sheet**, and **duplex flip on long edge**. Cut along solid guides, fold along dashed guides, then nest piece 1 outside piece 2 and continue inward within each signature. How many signatures you bind into one volume is up to you.

Print the attached numbered calibration sheet before a full book. Automated checks verify page pairing, mirrored backs, content coverage, and PDF navigation; your printer’s duplex direction, cutting, nesting, and binding margin still need a physical check. Cross-gutter image spreads, volume splitting, and sewing simulation are not included.

## Upgrading

Back up both persistent volumes and retain the previous image. Reuse the existing volumes, mounts, and port. Do not run `docker compose down -v`. Existing PDFs remain unchanged; click Apply to regenerate a book.

See [booklet printing](docs/BOUND_BOOKLET.md) and [deployment and rollback instructions](DEPLOYMENT.md).
