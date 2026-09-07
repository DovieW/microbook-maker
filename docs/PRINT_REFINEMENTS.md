# Physical-print refinements

Rich keeps continuous paragraphs and full-color, single-cell illustrations by default.

- **Images → Defaults → Two-cell images** is off by default. When enabled, each illustration is centered across two horizontally adjacent cells and rotated counterclockwise. Turn the physical sheet clockwise to see it upright. Captions stay with the image when they fit. The sheet preview displays the complete illustration; its Edit image button opens the Images sidebar.
- An illustration never crosses a printed row or sheet boundary. If only the last column is available, it starts on the next row. The render diagnostics report these unavoidable row-end blank cells; content order remains unchanged.
- The first cell has no position header, including both halves of an opening two-cell illustration. Later row position headers remain optional.
- **Advanced → Source page numbers** is off by default. These are the tiny original-edition page labels imported from EPUB, not note references. Actual notes and their references remain present.
- **Advanced → Paragraphs → Blank line** adds one body-line-height gap between paragraphs. Continuous remains the default. New line and the adjustable paragraph-gap control are available for finer spacing.
- Part and chapter headings have independent size, spacing, and upright/italic controls. Parts default to upright; chapters default to italic. Changing these controls does not change the physical body-text size.
- Generated PDF text and rules are pure black, including Basic Markdown links/quotes and Rich position labels. Images retain original colors and resolution. The PDF audit checks actual vector text colors and permits source image lettering inside recorded image regions.

The Classic reference test still requires identical original text, cells, geometry, and reference pixels after removing the intentional justification and black-ink styling corrections. Basic's imported content and pagination algorithm are unchanged.

## Verification

The synthetic `two-cell-images.epub` exercises 18 captioned, asymmetric illustrations across multiple rows and printed sides. PDF extraction checks every caption and intervening text; browser geometry checks centering, orientation, aspect ratio and complete-sheet preview. In particular, bottom-row illustrations must survive actual PDF printing: rotating a tall HTML container can cause Chromium to fragment it before transforming it. The renderer instead rotates the atomic image and short caption/label boxes within a physical-size container.

Run `npm run mb -- check --suite full` for the reference, application, boundary and public-book checks. Every render report includes a PDF text-color audit. Generated reports and private inputs remain outside tracked fixtures.

Physical validation still requires a duplex print at actual size, using the established duplex edge setting, then turning and folding the paper. Software checks cannot verify the printer's margins, feed direction, toner or readability.

## Brother HL-L6200DW

Keep **Toner Save off** for these small-print books; Brother says it makes print lighter and does not recommend it for photos or grayscale images. On the printer: General Setup → Ecology → Toner Save → Off.

The model supports up to **1200 × 1200 dpi**. Try the highest available resolution for the fine text and illustrations, accepting slower printing. Brother's Windows driver also provides Improve Gray Printing and Improve Thin Line; availability and wording depend on the installed driver, particularly on Linux. These are driver choices, not filters baked into the exported image, so the same PDF retains its colors for a future color printer.

Sources: [Brother Toner Save guidance](https://support.brother.com/g/b/faqend.aspx?c=us&faqid=faq00000020_500&lang=en&prod=hll6200dw_us_as), [Brother user guide, printed pages 66 and 353](https://download.brother.com/welcome/doc100494/cv_hll5000d_use_oug_b.pdf).

## Verified candidate, 2026-09-06

`npm run mb -- check --suite full --out .artifacts/print-refinements/verified` passed: 21 logic/integration tests, 30 retained Basic tests, 14 browser workflows, Basic reference/justification comparisons, image/paragraph boundary cases, and all three pinned public books in both modes. The packaged runtime separately passed mode-cache, two-cell preview and Library/export browser workflows; renderer/font fingerprints match verification.

The user-supplied book measured 14 printed sides / 7 duplex sheets with either default single-cell images or the optional two-cell layout. The latter allocated 224 cells (223 occupied plus one row-end blank), compared with 216 for the default. Both PDFs preserve all 609,885 mapped text characters, report no overflow, and pass the pure-black generated-text audit. These private reports remain ignored under `.artifacts/print-refinements`.

The local candidate was updated with five Library documents and 16 existing source/PDF files preserved byte-for-byte. The new assets and API were verified from the actual IdeaPad URL `http://localhost:36243/`. Image digest: `sha256:97eadfb319491082378ddb0e58d982ff019beaee1d936ea4523493158e08d763`. Rollback image: `microbook-maker:before-print-refinements`; volume backup: `.artifacts/print-refinements/before-volumes.tar`. TrueNAS production was not changed. Reload the interface and Apply once to update a previously rendered PDF; saved exports retain their original bytes.

## Choosing individual illustrations

Rich **Images** lists actual illustrations in reading order, with original thumbnails. Uncheck an image, then Apply to omit that occurrence and its attached caption. Surrounding prose stays in order and the freed space is repaginated. Recheck it to restore it. The original source file and image assets are never deleted.

Image choices are remembered per document as `excludedImageIds` in settings JSON. They do not carry over to newly imported books. Two uses of the same asset have separate choices. Chapter artwork that becomes a text heading is not listed as an illustration, so excluding a cover or drawing cannot delete a chapter title.

Repeated import notes are grouped by code and message with an occurrence count. The original detailed diagnostic records remain available in render reports.

Image selection verification: the quick suite passes with 22 logic/integration tests, 30 Basic tests and 15 browser workflows. An independent PDF check verifies that excluding an illustration removes its attached caption while preserving subsequent text and repeated uses of the same asset. Browser checks cover unapplied edits, reload, Apply, restoration of cached output and isolation between documents. On the copied private book, 78 diagnostic entries are displayed as two grouped notes and five illustration choices. Deployment evidence and the preserved-file hashes are in `.artifacts/image-selection/deployment.json`; the actual IdeaPad localhost route serves the new controls. Seventeen existing source/PDF files were preserved. Rollback is `microbook-maker:before-image-selection`, with the fresh volume backup at `.artifacts/image-selection/before-volumes.tar`.

### Per-image size

Each Images row also has a **2 cells** checkbox. Images initially follow the book-wide **Two-cell images** setting. Changing a row stores an override for that occurrence: either one upright cell or two centered, rotated cells. The small reset arrow returns it to the book-wide setting. Excluding an image retains its size choice for when it is restored.

These overrides use `imageCellSpans` in settings JSON, mapping image block IDs to `1` or `2`. They are saved per document, never inherited by another import, and follow the existing draft/Apply/PDF-cache workflow.

Per-image layout verification passes the quick suite (22 logic/integration tests, 30 Basic tests, 16 browser workflows). Mixed one/two-cell fixtures are checked with either global default, including independent PDF text checks, centering/rotation, captions and bounds. The packaged runtime separately passes both image workflows. Deployment evidence is under `.artifacts/individual-image-layout`; the actual IdeaPad localhost URL serves the controls. Source files and PDFs match the immediate pre-deployment backup. Rollback: `microbook-maker:before-individual-image-layout`.
