# UI and rendering refinements — 6 September 2026

The running candidate is served on desktop port 7780. A loopback SSH forward on `dovie-ideapad-linux` connects `localhost:36243` to that instance. The earlier “Failed to fetch” was reproduced with no listener on the laptop's port; the restored forward returns successful UI and Library responses. TrueNAS production remains separate.

## Interface

- Sheet is the initial preview view. Preference version 2 updates the former initial view and inherited global defaults; saved document drafts and applied exports remain intact.
- New print settings enable space at folds and solid fold lines. Classic reference checks continue to request the original dashed/no-gap settings explicitly.
- Fonts, chapters, fold lines, and paragraph treatments use navy Radix Select menus. The interface uses custom CSS and Radix primitives, rather than shadcn components.
- Chapter navigation only appears for Book with mapped chapters. Chapter locations are indexed once per document/preview instead of repeatedly scanning all blocks and cells on every update.
- Footer numbers accept direct cell/printed-side jumps, clamp out-of-range entries, and support Enter, blur, and Escape.
- The side-count comparison identifies the other mode explicitly, for example “5 fewer sides than Book.”
- Active renders display their phase, measured layout progress, current printed side, elapsed time, and Cancel. PDF download/drawing has a separate loading indicator.
- Library has loading and connection-error states with Retry. Interrupted reads retry once; mutations are not automatically replayed. Its endpoint returns compact summaries instead of full document/render records.
- The background is flat navy and the duplicate header import button is removed.

## Classic performance and compatibility

Adjacent words that would merge into the same span are placed in batches. A bounded search finds the final fitting prefix at a cell boundary; breaks, links, style changes, and the next-cell transition use the original path. The original unbatched path remains available to rendering tests by omitting `batchWords`.

Three quiet, repeated runs of the complete Frankenstein EPUB use the same original Arial/Arimo 6 px, dashed borders, and no-gap settings as the earlier benchmark. Median warm API time fell from **30.88 s to 5.78 s**, about **5.3× faster**. The new median cold render is 6.04 s; cached lookup is 7 ms. Startup and report generation are separate. New measurements are in `.artifacts/ui-classic-benchmark-quiet`; the earlier measurements are in `.artifacts/benchmark-classic`.

In the initial batching update, all three public novels retained identical cell text, cell count, and side count at matching settings. The original three small/duplex goldens, full Alice and Frankenstein PDFs, and four Markdown font/size/fold combinations matched in text and pixels. The original optional vertical finishing pass retains a four-second time budget: the captured full Moby Dick comparison differed in some late line spacing when that budget expired, despite identical cell contents and geometry. Full-book pixel identity across that cutoff is not claimed. Horizontal justification is now independent of that cutoff, as described below.

Enabling fold gaps exposed an EPUB illustration bug when moving between cells with different padding. Images now refit to the destination cell; tall illustrations spanning row and column boundaries have a regression fixture.

## Verification and running data

The checks cover 16 Vitest cases, 30 Classic cases, nine Playwright workflows, four paired Classic rendering configurations, all three public-domain novels, PDF text/geometry, and the three-page duplex reference. UI screenshots include the navy font menu, live processing, Sheet navigation, and narrow layouts. Reports remain under `.artifacts` and are not tracked.

A copy of the candidate's existing volumes was saved to `.artifacts/ui-update-volume-backup.tar` before replacing its container. The running candidate keeps the same upload/generated mounts. A real printer/folding check remains a physical validation step, as documented in the original release notes.

## Follow-up: Classic alignment and mode caching

Whole Classic cells could remain ragged because the legacy optimizer counted spans instead of words, rejected cells containing particular markup, applied density thresholds, or stopped at its time/block budget. Horizontal alignment now runs over every populated cell after pagination. It changes only text alignment, preserving wrapping rules, cell contents and order, font size, folding geometry, and natural final lines. Original PDFs stay immutable; tests restore only the legacy alignment and require its original pixels and line layout to match.

Classic and Book each keep their own completed PDF and reading position. The first visit to an unrendered mode generates it once; subsequent switches select its existing preview, including its loaded PDF.js document and raster side. Draft changes still require Apply. Background completion cannot replace a different selected mode. Per-mode pointers persist in the browser and on the server; cleanup retains the latest completed preview in both modes, plus saved exports and leased artifacts. Older single-preview records remain readable.

After an application update, an older renderer fingerprint enables Apply so an existing preview can be refreshed once. Saved exports retain their original bytes.

The complete `npm run mb -- check --suite full --out .artifacts/justification-mode-cache` run passed: 16 Vitest cases, 30 Classic cases, 11 browser workflows, four paired Classic font configurations, original TXT/Markdown/duplex layout comparisons, and all three pinned public books. New tests reproduce low-span and exhausted-budget ragged cells, measure actual word edges, check natural final lines, and verify unchanged text and geometry. Browser tests count exactly two initial renders across repeated mode switches, check no PDF redownload on switching, preserve drafts across reload, and test completion while another mode is selected. Restart/cleanup tests retain both modes after leases expire.

Before this candidate update, its image was retained as `microbook-maker:before-justification-cache` and its volumes were backed up to `.artifacts/before-justification-cache-volumes.tar`.

The first mode-cache candidate image was `sha256:c9a44cbd6a8c6f1df59015e006f16e6ca76943409bcb7036190e361c1e3c8ff3`. Its renderer/font fingerprints matched the full-suite environment. Both mode-cache browser tests also passed against the packaged runtime with isolated storage. After replacement, the candidate retained all five Library documents and all six existing PDF byte fingerprints. The IdeaPad's actual `localhost:36243` route returned the new interface, assets, and healthy Library API. Opening an existing preview caused no render request; Apply was enabled for its older renderer version. TrueNAS production remained unchanged.

## Continuing lines at cell bottoms

The initial alignment fix retained `text-align-last: left`, which left the bottom line ragged even when a sentence continued into the next cell. Pagination now distinguishes word overflow from a structural break. A continuing cell's trailing inline flow gets `text-align-last: justify`; earlier headings and forced breaks keep their natural alignment, as does the book's final line. Text, line positions, cell allocation, font size, and folding geometry are unchanged.

The full `.artifacts/cell-continuations-final` check passes, including all 57 named tests, original PDF/layout comparisons, TXT and Markdown continuation regressions, and all three public books. Word rectangles verify bottom-line alignment within 0.6 CSS px and unchanged vertical positions; heading positions and emphasis are also checked. In the inspected PDF close-up, the bottom-line gap shrank from 14.546875 CSS px to zero. Reports and before/after close-ups are under `.artifacts/continuation-closeups`.

The current candidate image is `sha256:234c722c99018b789f75ff09ac7c2301dde96c318a044a08d3768b59b81bf1db`. Its renderer and font fingerprints match the test environment. The IdeaPad's `localhost:36243` route is verified healthy, and all five documents and six previous PDF byte fingerprints remain intact. Older previews need a reload and one Apply to pick up the rendering correction. Rollback uses `microbook-maker:before-cell-continuations` and `.artifacts/before-cell-continuations-volumes.tar`; TrueNAS production is unchanged.

## Book opening and zoom refinements

The percentage button toggles fit-to-width and physical 100% in both Cell and Sheet views. Fit follows the available preview width on resize. The displayed percentage is the actual scale, plus/minus enters manual zoom, and the selected behavior persists. Zoom neither requests a new PDF nor changes print size. Keyboard focus now surrounds the entire size control, including `px`.

Continuous ordinary paragraphs are the new Book default. Intentional alignment, poetry, quotations, and forced breaks remain distinct. Preference version 3 updates inherited global defaults without overwriting an existing document's saved choices.

The duplicated chapter artwork came from importing both default EPUB images and hidden Kindle alternatives. The importer now respects default visibility, CSS specificity and media boundaries. Chapter artwork inside an identified heading uses its supplied alternative text to produce a single, compact, left-aligned heading. Original image assets remain stored; repeated illustrations in separate reading locations remain present. Full-size cover and interior images remain in color. Page labels accompany their following content, preventing label-only blank cells. The compact title/info panel shares the first text cell after leading artwork and includes actual duplex sheets, word count, read time, author, year, and CSS pixel size.

Older Library EPUB models are refreshed from their original bytes into a separate asset directory before atomic record replacement. Metadata edits, creation dates, source paths and render pointers survive. Existing PDFs remain byte-identical and can be refreshed with one Apply after reload. No re-upload is required.

The complete `.artifacts/book-refinements/full` suite passed: 19 Vitest cases, 30 retained Classic cases, 12 browser workflows, the original TXT/Markdown/duplex PDF references, paired Classic geometry/justification checks, all three pinned public books, and independent Book PDF content audits. The new CC0 publisher-alternative fixture verifies single left-aligned chapter lettering, preserved full-size color images and aspect ratios, intentional repetition/alignment, no empty cells, and a title panel sharing source text. Browser checks verify responsive fit, physical 100%, reload persistence, no zoom-triggered rendering, and the complete focus ring. Three zoom/mode-cache workflows also pass against the packaged runtime with copied storage.

A supplied EPUB was checked locally: 14 printed sides / 7 sheets / 223 occupied cells, no empty cells or overflow, and complete text coverage. At the exact previous Book settings and metadata, it previously used 16 sides / 8 sheets. Classic's extracted text from that EPUB remains identical. One measured runtime render took 4.17 seconds; this is a single observation, not a repeated performance benchmark. Private inputs and reports remain outside tracked fixtures.

The candidate is now `sha256:0d7b25865c38e9d010033c7af826c8d300cce6607a9b575ab3d90f8d93b8f11c`, with the verified renderer/font fingerprint. Its existing five Library documents and all 14 recorded PDF/source files remain intact. The actual IdeaPad URL `localhost:36243` serves the matching interface/assets and Library. Rollback uses `microbook-maker:before-book-refinements` and `.artifacts/before-book-refinements-volumes.tar`. TrueNAS is unchanged; physical printer/folding validation remains the previously documented gap.

## More expressive Book headings

The plain chapter treatment removed too much of the original book's character. Major Book headings now use a small chapter/part label above a larger bold italic serif title and a fine rule. They remain left aligned, appear once, and retain all original text and inline marks. The existing heading-scale control still applies; Classic and the navy interface are unchanged.

The larger heading treatment exposed two boundary issues. Keeping a heading with its following line now accounts for its bottom margin. Each Book flow establishes its own formatting context so a first heading's top margin cannot collapse through the flow and push its measured bottom outside the actual cell. Final validation checks the flow against its cell's physical content bounds as well as checking the children. A quick synthetic fixture puts decorated headings after full-height images and uses repeated punctuation to reproduce the clipped-bottom-line case.

The complete `.artifacts/literary-headings/full` suite passes, including all three public-domain books, original Classic references, 19 Vitest cases, 30 retained Classic cases, and 12 browser workflows. Independent PDF extraction verifies every selected character, including the punctuation that exposed the clipping bug. The packaged runtime also renders and independently verifies the publisher-alternative fixture with matching renderer/font fingerprints.

The supplied example now occupies 228 cells, 15 printed sides / 8 duplex sheets at the same body size and continuous-paragraph settings. This is one additional printed side compared with the plainer 14-side version. The PDF close-up is retained locally in `.artifacts/literary-headings/heading-detail.png`; private books and reports remain untracked.

Candidate image: `sha256:38566f63a5dce3118e1b57208cebebfe4cea8a864ca8241b7001abd8b0e8a282`. Rollback image: `microbook-maker:before-literary-headings`; volume snapshot: `.artifacts/before-literary-headings-volumes.tar`. Existing previews need reload and one Apply for the new rendering style.

## Basic and Rich: parts, chapters, and position headers

The visible mode names are now **Basic** and **Rich**, including the workspace, Library exports, settings reset, and comparison reports. Stored settings and API identifiers remain `classic`/`book`; CLI commands also accept `basic`/`rich`. Browser drafts opened from historical exports receive defaults for newly added fields without discarding their existing choices.

EPUB import revision 3 distinguishes `part` and `chapter` using `epub:type` and `doc-part`/`doc-chapter` roles. Only a container's opening heading inherits that role; nested untyped sections and later subsection headings remain generic. Clear numbered English labels (including accessible image lettering and “Book IV”) provide a conservative fallback. Heading level alone never implies a part or chapter. Source semantics work regardless of language; unrecognized labels retain generic heading styling. See the [EPUB structural vocabulary](https://www.w3.org/TR/epub-ssv-11/).

Rich keeps left-aligned italic serif titles and small-cap labels. **Advanced → Headings** exposes independent chapter/part size and spacing, other-heading size, and optional rules. Size multipliers are relative to body text; the defaults are 1.35× for chapters and 1.65× for parts, with 0.15 em and 0.25 em spacing. Body size stays unchanged. Rich's optional position headers default on at the start of each row, matching Basic's sparse placement. `1b / 8 · 14%` means the back of sheet 1 of 8, at 14% of the selected text. A fixed line is reserved during pagination. Images retain their color and aspect ratio while fitting the remaining cell. Basic's original headers and renderer are unchanged.

The supplied example identifies 3 parts and 71 chapters, with 6 generic headings. At 6 px and the same selected content, Basic uses 202 cells / 13 printed sides / 7 duplex sheets. Rich's defaults use 227 cells / 15 sides / 8 sheets. Setting chapter size to 0.85×, part size to 1.1×, both heading gaps to zero, and rules off produces 224 cells / 14 sides / 7 sheets, with position headers and full-color images retained. A moderate 1×/1.3× setting uses 225 cells: one cell over the 14-side boundary. There is no automatic fitting or density target.

Verification: `.artifacts/basic-rich/final` passes type checking, build, 20 logic/storage tests, 30 original Basic tests, 13 browser workflows, Classic reference/justification/folding comparisons, and all three pinned novels in both modes. Independent PDF inspection checks each printed marker in its physical rectangle and removes only those verified drawing ranges before comparing every source character. Logical RTL text remains intact. Default and custom heading geometry, rules, image proportions, and disabled markers are exercised in the quick suite. The packaged runtime additionally passes the mode-cache and heading-preference workflows against copied storage. Existing source/PDF hashes and Basic's imported text remain unchanged. Private books and reports remain outside tracked fixtures. Physical printer/folding validation remains the previously documented gap.

Candidate image: `sha256:75e097e22c7179ebbaa4e2941d41eb2e9537cc9944b0ffbc5ca9f86ff3f9cbd5`. The IdeaPad’s `localhost:36243` route serves the verified Basic/Rich interface and heading controls with matching renderer/font fingerprints. All five Library documents and 14 pre-update source/PDF hashes survived the update. Rollback uses `microbook-maker:before-basic-rich` and `.artifacts/before-basic-rich-volumes.tar`. Reload and Apply refresh an older preview once; subsequent mode switches reuse the completed artifacts.
