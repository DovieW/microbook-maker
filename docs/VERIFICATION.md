# Verification

The Docker runner is the reproducible test environment. The host needs Node and Docker; the image supplies Chromium, controlled print fonts, Poppler, Python, and browser-test dependencies. `npm run mb -- setup` builds it. `--no-build` reuses that image for subsequent commands.

The quick suite runs TypeScript, Vitest, 30 retained Classic parser/style/font tests, a production build, Classic TXT/Markdown pixel comparisons, a structured EPUB smoke test, worker/restart recovery, long-token/table/paragraph boundary cases, and real Playwright workflows. The full suite adds all three sides of a Classic duplex golden, reference-versus-batched Classic comparisons across four fonts/print configurations, and the checksummed public corpus. Reference goldens explicitly use their original dashed/no-gap settings; current defaults use solid fold lines and fold spacing. Tall illustrations crossing different fold paddings are included in boundary checks.

Original fixtures are CC0. Public books are identified with URLs, SHA-256 checksums, and licensing information in `tests/public-books.json`. Downloads are cached in `.cache/public-books`. A checksum mismatch fails the test; a newer upstream file is never silently substituted. All Project Gutenberg source/licensing material remains included in the selected book by default.

`tests/baseline/manifest.json` records source commit `43f3a28`, exact engine image, Chromium, font files/hashes, and fixture hashes. Original PDFs stay immutable. To verify the intentional horizontal-alignment correction, the runner removes only the new alignment from diagnostic HTML and requires the resulting PDF to match the original line layout and pixels. It also checks that the corrected PDF preserves ordered text and every cell's contents and geometry. Raw PDF text extraction avoids interleaving neighboring cells differently when their horizontal spacing changes. `node tools/baseline.mjs <explicit fixture filenames>` reproduces goldens using a disposable instance of the immutable original image. It never uses production.

The full Classic regression reproduces the ragged-cell bug with long prose merged into fewer than six spans and with an exhausted optimization budget. It measures actual Chromium word rectangles: continuing prose lines, including the bottom line of each cell, must reach the cell edge within 0.6 CSS px. The book ending and forced breaks before headings remain naturally aligned. TXT and Markdown cases check emphasis, heading placement, exact word/line positions, cell text, and geometry. Before/after PDFs, images, and line-edge measurements are saved with the report.

Book verification checks the model's complete consumption and final cell bounds, then independently compares Poppler's PDF text against the selected document. Full public-book tests additionally extract original EPUB spine text with Python's standard ZIP/XML libraries and compare it against the importer. Whitespace, discretionary soft hyphens, generated paragraph markers, and Poppler-inserted bidi controls are normalized; source punctuation and textual order remain checked.

Each render report includes the PDF, all side images, actual sides/sheets/cells, source map, settings, source/settings/renderer/font fingerprints, diagnostics, phase timings, peak memory, and PDF inspection results. Peak memory is sampled for the isolated container; a native run samples the application process tree. Cold Chromium startup is identified separately from pagination, final justification, PDF writing, and preview generation. Benchmark elapsed times include API polling overhead; renderer timings exclude report-image generation.

Browser tests cover import mode defaults, browser drafts surviving reload, Apply, failure/retry, cancellation, stale responses, exact preview/download bytes, continuous-sheet fidelity, selection/search, canvas eviction, chapter position, Books/kept versions/removal, manual metadata precedence, keyboard focus, and narrow layouts. Mode-cache tests count render requests, verify returning to either PDF without redownload, preserve separate positions and unapplied edits, reload both previews, and hold a background completion while another mode is selected. Storage tests retain both modes after leases expire and across restart. Source maps and content checks complement screenshots; screenshots alone do not prove complete content.

The multi-side Classic fixture verifies all 42 occupied cells across 3 printed sides (2 duplex sheets), including transitions at cells 16 and 32. The physical print check remains a separate release step: printer feed/duplex direction, physical margins, tiny-text legibility, and folding/cutting cannot be established by a headless browser.

Current measured results and any release-candidate limitations are recorded in `RELEASE_NOTES.md` after verification.


## Native Chrome printing

The optional Linux desktop check uses a fresh Chrome profile whose printer destination is explicitly **Save as PDF**, never a physical printer:

```sh
node tools/verify-native-print.mjs --url http://127.0.0.1:17881 --out .artifacts/native-print
```

Use a local isolated application; the script imports the synthetic duplex fixture through the UI and clicks the actual Print action. It records the original and native-printed PDFs, new-tab count and retention flags. It requires a graphical Chrome environment in addition to the ordinary Docker runner. Compare the resulting PDF with Poppler `pdftotext -bbox-layout`, `pdffonts`, `pdfinfo`, and `pdftohtml -xml` to verify word geometry, vector fonts, Letter size and black generated text. This does not verify physical printer margins, duplex feed or toner behavior.
