# Images panel polish — 7 September 2026

Larger thumbnails and an expanded inline preview make images easier to inspect. Tapping the image opens a separate zoomable preview with focus restoration; tapping the title or row expands settings without moving the PDF. Only location/context buttons navigate. Treatment replaces the redundant heading disclosure and checkbox, while retaining heading text/type and reset controls. Native checkboxes now use a consistent mint mark and a 44px touch target throughout the workspace.

The quick suite passed, including all 32 browser tests, 39 unit tests, and 30 Basic tests. Mobile modal zoom/close/focus, unchanged PDF position, image controls, and copied-Library screenshots were checked. The candidate was updated with a volume backup and rollback image `microbook-maker:before-image-panel-polish`; original source/PDF bytes were preserved. Reports: `.artifacts/image-panel-polish/`.

---

# Configurable Rich EPUB features — 7 September 2026

Implemented configurable generated contents, PDF bookmarks, clickable/printable links, note placement, original page references, chapter position labels, semantic passages, publisher heading fonts, SVG compatibility, and drop caps. Settings and source-dependent limits are documented in [Rich EPUB features](../RICH_EPUB_FEATURES.md).

New Rich imports use compact defaults. Existing books preserve their settings and completed PDFs; **Use new Rich defaults → Apply** opts in. **Update layout** explicitly rebuilds an outdated PDF without forcing regeneration just to open or print it.

Validation: 39 unit tests, 30 frozen Basic tests, the quick render/recovery/boundary suite, and 32 browser tests passed. Eight relevant PDF/navigation/cache browser checks were rerun after the guide/page-marker compatibility fixes. Actual PDFs were checked for outlines, annotations, full URLs, note deduplication, Letter geometry, embedded fonts, vector artwork, and source coverage. Three copied Library books rendered successfully; all existing source and PDF bytes remained unchanged. The long linked-index regression includes 700 entries.

Candidate updated with a rollback image (`microbook-maker:before-rich-features`) and volume backup at `.artifacts/rich-features/before-volumes.tar`. Deployment and verification reports are under `.artifacts/rich-features/`. TrueNAS production is unchanged.

The phone route is **http://100.79.27.109:36243/**. The IdeaPad is offline, so its **http://localhost:36243/** forwarding route could not be verified from that device. Physical Brother HL-L6200DW print quality remains unverified; no physical print job was sent.

---

# Rebuild verification — 6 September 2026

The current interface is described in [Workspace redesign](../WORKSPACE_REDESIGN.md): a compact shared sidebar, continuous searchable PDF, native Print, Books and kept versions. The implementation and verification notes below record the original rebuild and its earlier interface.


**Later updates:** see [UI and rendering refinements](../UI_REFINEMENTS.md) for the current Sheet/fold defaults, themed menus, connection fix, Classic batching measurements, the horizontal-justification fix, and persistent previews for both modes. The paper-use and timing tables below describe the original no-gap defaults and precede the intentional alignment correction.

The rebuild is implemented and verified in this workspace. A release candidate runs at [localhost:7780](http://localhost:7780) with separate storage under `.artifacts/release-data`. The existing TrueNAS production instance has not been changed, and no image has been published.

The interface provides the navy workspace, exact PDF preview, Cell/Sheet navigation, Apply and Apply & Export, browser preferences, chapter navigation, source-position preservation, and a compact Library. Book imports EPUB 2/3 structure, images, captions, nested formatting, lists, poetry, simple tables, page labels, and typed endnotes. Small source images are not enlarged. Classic retains the original import/normalization/tokenization/pagination boundary and physical output.

## Paper use

These are complete, pinned public-domain editions, including their reading-order front matter and licensing text. Both modes use Arial/Arimo at **6 CSS px / 4.5 pt**, Letter paper, 16 cells per printed side. Book includes illustrations. There is no automatic fitting or density target.

| Book | Words | Classic sheets | Book sheets | Printed sides, Classic / Book | Occupied cells, Classic / Book |
| --- | ---: | ---: | ---: | ---: | ---: |
| Illustrated Alice | 30,245 | 2 | 4 | 4 / 7 | 54 / 109 |
| Frankenstein | 78,106 | 5 | 5 | 9 / 10 | 142 / 154 |
| Moby Dick | 215,845 | 13 | 14 | 25 / 27 | 398 / 431 |

Ordinary prose used about 8% more occupied cells in Book for Frankenstein and Moby Dick. Duplex rounding leaves Frankenstein at five sheets in both modes. The illustrated edition costs more paper because illustrations and structure remain present. Counts are measured, not estimates based on word count.

The full-corpus Book renders took 1.27 s, 1.69 s, and 4.93 s respectively. They are separate outputs from Classic; these numbers do not claim an equivalent-layout Classic speedup.

## Repeated timings

Three cold/warm/cached runs per mode used the same complete Frankenstein EPUB, metadata, and physical text size on an **AMD Ryzen 5 3600, 12 logical CPUs, 16 GiB RAM, Linux amd64**. Values below are medians of elapsed API time, including polling (up to 250 ms); artifact/report generation is excluded.

| Mode | Cold render | Warm forced render | Cached result |
| --- | ---: | ---: | ---: |
| Classic | 30.90 s | 30.88 s | 7 ms |
| Book | 2.03 s | 1.52 s | 8 ms |

Application/Chromium startup is measured separately (roughly 0.6–0.9 s). Cold restarts the application and browser; warm forces real equivalent work in the same browser; cached reuses a completed result. Book's warm measurement cache recorded 149 hits and zero misses on each repetition. The font size never changes during a render.

Phase timings, source/settings/font hashes, all PDFs and side images, content checks, source ranges, and sampled container memory are retained in the JSON/HTML reports. Memory includes container filesystem caches and verification processes; it is not a measurement of the renderer alone. Timings describe this machine, not an untested TrueNAS host.

## Checks passed

- 16 Vitest logic/integration tests, 30 retained Classic parser/font/style tests, and 7 Playwright browser workflows; TypeScript and production build pass.
- Classic TXT, Markdown, and a 42-cell duplex fixture match the original PDFs in extracted text and rendered pixels. All three duplex reference sides are checked, including cell transitions at 16 and 32.
- All three public EPUBs match an independent source-spine extraction. Generated Book PDFs independently match selected text; final cell bounds report no overflow. Nested formatting, sentinels, captions, note uniqueness, long tokens, table-row splits, and paragraph treatments are covered.
- Browser tests cover drafts/reload, Apply, cancellation/retry, stale responses, metadata precedence, exact PDF/download bytes, source-position preservation, narrow layouts, focus restoration, and a pixel comparison between Cell view and a complete PDF side.
- Worker failure, queued-job restart recovery, atomic records, incomplete artifacts, retained exports, cleanup leases, and legacy migration/deletion are exercised.
- Docker-backed setup, doctor, dev on an isolated port, render, compare with a settings file and paths containing spaces, full verification, and repeated benchmarks work without host rendering dependencies.
- The actual runtime image migrated a copy of two original-format reference exports. Historical PDF URLs and original uploads retain identical bytes. New Book and Classic rendering, exact export/cache reuse, Library, preview, Settings, and restart persistence pass in that image.
- The runtime Classic PDF also matches the original reference pixels. Runtime and verification renderer/font fingerprints match. The dependency audit reported zero known vulnerabilities at verification time.

## Reproduce and review

```sh
npm run mb -- setup
npm run mb -- check
npm run mb -- test --no-build --suite full
npm run mb -- render --no-build --input /absolute/path/book.epub --out /tmp/microbook-report
npm run mb -- compare --no-build --input /absolute/path/book.epub --out /tmp/microbook-comparison
npm run mb -- bench --no-build --input /absolute/path/book.epub --mode book --runs 3
```

The final combined verification used `npm run mb -- check --no-build --suite full --out .artifacts/final-verification`. Local evidence is available at:

- .artifacts/final-verification (local verification artifact; not distributed): full corpus, Classic goldens, browser screenshots, and JSON/HTML comparisons.
- Book benchmark (local verification artifact; not distributed) and Classic benchmark (local verification artifact; not distributed).
- Candidate report (local verification artifact; not distributed), PDFs, and runtime UI screenshots.

Generated reports are intentionally ignored by Git. The controlled baseline PDFs and small offline fixtures are part of the source tree; public-book inputs are cached with exact checksums.

## Runtime and rollback

The candidate image is `microbook-maker:release-candidate`, local digest `sha256:aa2acc30b015a2e2b58875eb80310f8fd0e9d695e44007a8054dea8780177f7c`. It runs Express plus one render worker and Chromium, with no Nginx or PM2 process. Production remains on port 7777; the local candidate uses port 7780.

Controlled engine: Node 24.16.0, Chromium 148.0.7778.178, Classic Pretext 0.0.6, Book Pretext 0.0.8. Print-font fingerprint: `7606fe0425eda366d281765073c2cb42c06b3806ed4accc881a2972b0d4aa533`. Renderer/source fingerprint: `f0f99979eecc4b81e1791693dcfb495aafade2360fd2354be6d84e75c45b5c06`.

The original reference image remains pinned by digest in `tests/baseline/manifest.json` and the Dockerfile. The copied reference volumes were backed up before candidate migration. Before a production switch, back up the **actual production volumes**, retain its installed image digest, and test a copy of that data as described in [DEPLOYMENT.md](../../DEPLOYMENT.md). The local reference-data check is not a claim that the user's live production library has been migrated or tested.

**Physical-print validation remains:** print a targeted duplex sheet at 100% / actual size, using the same duplex edge setting as the existing Classic workflow, then fold/cut and compare the cell order. The automated three-side reference proves software geometry/order, but cannot establish a real printer's feed direction, unprintable margins, ink legibility at 4.5 pt, or the physical fold result. No private book is required.
