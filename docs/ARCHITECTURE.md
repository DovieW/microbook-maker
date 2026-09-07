# Architecture

The container runs Express on 7777 and one child render worker. Express serves the compiled React application, API, original assets, PDFs, and thumbnails. The worker owns one warm Chromium process. Each Classic job receives a fresh page; Book reuses an isolated page and bounded Pretext preparations for its active document. There is no Nginx, PM2, database, login, or cloud dependency in the application process graph.

## Shared model

`packages/core/src/index.ts` defines `BookDocument`, `RenderSettings`, `RenderJob`, `RenderResult`, source-to-cell mappings, physical geometry, and Zod validation. All font sizes are CSS pixels; PDF points are pixels × 0.75. There are 4 × 4 cells per Letter side. Duplex sheets are `ceil(actual printed sides / 2)`.

The importer stores the original bytes, metadata, ordered sections, blocks, nested inline marks, and packaged images. EPUB container/manifest/spine resolution uses bounded `yauzl` archive reading and `@xmldom/xmldom`. EPUB 3 navigation and EPUB 2 NCX anchors identify chapters even when many chapters share one XHTML document. Typed footnotes are collected once as endnotes, including referenced note files outside the spine. All spine content is included by default; section selection is specific to a document.

Publisher page geometry is replaced by controlled print styles. Rich mode optionally uses validated embedded publisher heading fonts; body typography stays controlled. Supported emphasis, alignment, line breaks, poetry, lists, images, captions, and simple tables survive. Illustrations retain their aspect ratio and fit inside a cell without enlarging small source images. Poetry and intentional line breaks retain natural alignment. Illustrated publisher-layout tables are reflowed in reading order with an explicit diagnostic. Simple text tables split at row boundaries; a row taller than a cell produces an actionable error. Fixed layout, DRM removal, arbitrary publisher CSS and interactive media are outside this renderer.

The importer resolves supported default CSS rules and hidden ancestors without flattening device-specific media blocks into the default EPUB styles. Hidden Kindle image alternatives are excluded; intentional repeated illustrations remain. Image lettering inside an identified chapter heading uses its supplied alternative text for Book typography, with an import diagnostic. The original asset stays stored and Classic text extraction continues to omit image lettering. Import revisions rebuild older EPUB models from their original bytes into a separate asset directory, then atomically replace the document record while retaining metadata edits and export pointers.

Uploads are limited to 50 MiB. EPUBs are limited to 250 MiB expanded, 32 MiB per entry, and 5,000 entries. Raster/SVG dimensions are inspected before decode: at most 40 million pixels and 32,768 pixels on either axis. Traversal, encryption, unsafe SVG, and XML entity declarations are rejected. Book scripts never run. Chromium only fetches the application's own assets; external metadata lookup uses a separate, explicit action.

## Classic boundary

`packages/renderer/classic` preserves the parser, normalizer, tokenizer, styles, and HTML template from `43f3a28`. Its paginator retains the original placement path and adds optional batching of adjacent words that would merge into the same span; binary searches find the fitting prefix at cell boundaries. The renderer enables batching, and omitting `batchWords` runs the reference path. Font size, cell text, cell order, and physical geometry remain compatible. `pretext-classic` aliases Pretext 0.0.6; Book uses 0.0.8. The immutable engine image and font hashes are recorded in `tests/baseline/manifest.json`. The runtime's Chromium and fonts match the original reference environment.

Classic continues to receive original TXT/Markdown bytes. EPUB in Classic is new functionality: its reading-order text is flattened through the frozen TXT path. Display metadata is escaped before entering the historical HTML header. Application counts come from actual PDF sides; the original printed header's estimated count is intentionally preserved. Markdown-it and Puppeteer received compatible security updates; the original parser tests and controlled PDF goldens verify the result.

Horizontal alignment now runs unconditionally after pagination (`justifyAllCells: true` at runtime). The legacy finishing pass could skip whole cells because of token-span counts, markup, text-density heuristics, or its processing budget. Pagination records whether a word continues into the next cell. For those cells, the trailing inline flow receives `text-align-last: justify` in a block wrapper, keeping earlier forced breaks and headings naturally aligned. True text endings retain natural alignment. The pass preserves wrapping rules, headers, text allocation, line positions, and physical geometry. The optional vertical finishing pass retains its historical budget. Tests can omit `justifyAllCells` to reproduce the original output; original baseline PDFs remain unchanged.

## Book pagination

Whole blocks are placed first. For a crossing block, cached Pretext measurements predict the boundary, then bounded Chromium measurements find a fitting source range. DOM ranges preserve inline marks across fragments; grapheme splitting handles long unbreakable tokens. Headings are left aligned and keep at least the following line with them. Ordinary paragraphs are continuous by default; intentional alignment, quotations and forced line breaks remain distinct. New-line and marker treatments remain selectable.

Major Book headings use bold italic Tinos/Times serif lettering with a fine rule. Numbered chapter, part and book headings separate the small label from the title, preserving every source character and inline mark. This adds deliberate emphasis to the printed book; it does not change the navy application interface or Classic rendering. The existing heading-scale setting controls the typography's size.

Full-size color illustrations stay in reading order. Page labels move with their following content, including space reserved inside image groups, so a label cannot leave an otherwise empty cell before a full-height image. The generated title/info panel joins the first text cell after any leading artwork. Its sheet count is populated from final pagination without changing its reserved geometry; word count, reading time, author, year, and CSS pixel size are included. An independent PDF-text audit checks the panel against actual PDF page counts.

The compositor applies native paragraph justification in a separately measured final pass, leaves final paragraph lines naturally aligned, and checks final bounds and complete character consumption. The verification runner additionally extracts actual PDF text with Poppler and compares it independently with the selected model. Full-book tests also compare imported text with an independent Python EPUB-spine extraction.

Cache keys include original-source hash, metadata snapshot, effective settings, Chromium version, font hashes, renderer sources, and lockfile. Results are scoped to their owning Library document. A result is reused only for an identical key. No fitting target or automatic font-size adjustment exists.

## Apply and browser state

The 48px header, left sidebar and 40px bottom bar frame a continuous PDF viewer. Layout, Contents, Images and Books share one sidebar and one Apply action. Desktop width/collapse preferences are remembered; mobile starts with a closed full-screen drawer. Rich-only tabs and settings stay hidden in Basic. Source image and chapter jumps use the displayed PDF's source map, never predicted page numbers.

Preference version 5 retains prior per-document drafts, render IDs, image choices and source locations while discarding Cell/Sheet view choice. It adds sidebar state, per-mode PDF-coordinate reading positions, per-document search and the last opened kept version. Original source bytes remain on the server.

`useWorkspace.ts` separates working drafts, applied previews in each mode, an optional read-only kept render, and queued output intent. Immutable Apply snapshots and generation/render IDs reject stale replies. Returning to a cached mode never applies a pending draft or regenerates its PDF. Revert restores the current displayed layout's applied settings and metadata. Opening a kept version leaves drafts untouched; Use these settings deliberately transfers its snapshot into the working draft.

`Preview.tsx` adapts the installed PDF.js `PDFViewer`, `PDFFindController`, `PDFLinkService` and event bus. Their text layer supports selection and whole-PDF search. Visible-page events update side navigation; PDF coordinates preserve reading position through scaling/resizing. Lazy pages have a 16-megapixel canvas limit; distant canvases and inactive mode canvases are released. Each inactive mode retains its loaded PDF and reading position. Image edit controls and outlines are independent HTML overlays, outside print content.

`useOutput.ts` handles Print and Download against the displayed render ID. Pending edits queue the chosen action until that exact Apply completes; failure, cancellation and document/mode changes discard the intent. Print uses an offscreen same-origin native PDF frame and `window.print()`, preserving vector text. Unsupported automatic printing exposes native PDF controls inline with Return to preview. Printing/downloading never marks a version kept. An isolated Chrome/Linux verification profile explicitly selects Save as PDF and verifies that this route produces no extra tab.

Radix Dialog/Select provide the mobile drawer and custom font/settings controls. Sidebar tabs and resizing support keyboard use. The sidebar contains a single progress/error/Apply/Revert area, and collapses with a pending indicator. Books has compact searchable rows, original filenames/import dates, current per-mode counts and named kept versions. Duplicate source records and historical artifacts are preserved.

## Filesystem and jobs

`uploads/documents/<id>` contains `source.*`, `document.json`, and sanitized packaged assets. `generated/renders/<id>` contains `job.json`, immutable `output.pdf`, `thumbnail.png`, `result.json`, and diagnostic `output.html`.

JSON writes are serialized per record and replaced atomically. PDF and result artifacts are written before completion is recorded. Running jobs become interrupted after restart; queued jobs resume. Active jobs publish measured layout progress, the current phase, and a start time. Classic progress reads its existing printed percentages without changing them. Cancelling work is separate from deleting a Library item. A crashed worker is replaced and queued work continues.

Kept versions (`saved: true`, optional `savedLabel` and `savedAt`) and the latest completed preview in each mode are retained across restarts. Existing saved exports remain kept versions. Document records have optional per-mode render pointers; older records recover the latest completed job for each mode. Superseded unsaved results are collected after their preview leases expire. UI clients renew leases for both current previews, the displayed kept version and native printing artifacts. Five-minute leases and a short completion grace period protect in-flight downloads and other browser tabs.

The legacy reader recognizes flat `METADATA_<id>.json` records, preserves original source/PDF bytes and metadata, and presents them in the new Library. It leaves existing files in place during migration. Removing a historical item removes its artifacts and writes a tombstone to prevent resurrection. Historical PDF coverage was not measured by the old renderer and is labelled accordingly.

## API

| Method and route | Behavior |
| --- | --- |
| `GET /api/health` | Runtime/worker readiness and fingerprints |
| `POST /api/documents` | Multipart `file` import; returns a document |
| `GET /api/documents` | Compact Library rows and available renders |
| `GET /api/documents/:id` | Full model and document renders |
| `PATCH /api/documents/:id` | Validate and update `{ metadata }` |
| `DELETE /api/documents/:id` | Remove inactive document and artifacts |
| `POST /api/documents/:id/renders` | Create/reuse `{ settings }`; `force: true` bypasses cache for benchmarks |
| `GET /api/renders/:id` | Status, immutable settings, progress, result/error |
| `POST /api/renders/:id/cancel` | Cancel queued/running work |
| `GET /api/renders/:id/pdf` | Exact preview PDF |
| `GET /api/renders/:id/thumbnail` | Render thumbnail |
| `GET /api/renders/:id/map` | Physical cell/source map |
| `POST /api/renders/:id/export` | Mark saved and return download URL |
| `PATCH /api/renders/:id` | Keep, rename or unkeep a completed render with `{ saved?, label? }` |
| `GET /api/renders/:id/download` | Download completed bytes without changing retention |
| `POST /api/renders/:id/lease` | Renew an active preview lease |
| `POST /api/renders/:id/release` | Schedule cleanup after existing leases expire |
| `GET /api/metadata/lookup?title=…` | Explicit Open Library lookup; UI only fills untouched missing fields |

Historical `/history/*`, `/api/download?id=…`, `/uploads/:file`, and `/health` routes remain available.

## Updating dependencies

Use one root lockfile. Upgrade Book helpers independently from the Classic alias. Changing Chromium, print fonts, or Classic code requires a controlled golden comparison and a physical print check. The current release engine is pinned for Linux amd64; another architecture needs its own verified engine/goldens before publishing it.

Rich EPUB navigation, printable references, configurable notes, passage formatting, and compatibility defaults are described in [Rich EPUB features](RICH_EPUB_FEATURES.md).
