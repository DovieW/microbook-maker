# Refactor And Notes

## Context
This project has a clear and valid hobby goal: take uploaded book text and generate a printable microbook PDF.
That goal is already working. Most problems are not about idea fit, they are about maintainability, safety, and making the next features (new input formats + better output quality) easy.

## Implementation Status (2026-02-08)
- [x] Replaced user-derived job IDs with UUID-backed IDs (`be/utils/fileUtils.js`, `be/index.js`).
- [x] Added safe filename sanitization for uploads and metadata usage (`be/utils/fileUtils.js`).
- [x] Added queue-based job execution with bounded concurrency and queue cancellation support (`be/services/jobQueueService.js`, `be/index.js`).
- [x] Added parser pipeline for multiple input formats with plugin-style importers (`be/pipeline/documentPipeline.js`, `be/pipeline/importers/textImporter.js`, `be/pipeline/importers/markdownImporter.js`).
- [x] Added normalized document model + token serializer for renderer abstraction (`be/pipeline/documentPipeline.js`).
- [x] Removed style preset architecture and UI to simplify output controls (`be/index.js`, `be/services/capabilitiesService.js`, `fe/src/components/PdfOptions.tsx`, `fe/src/types/index.ts`).
- [x] Added end-to-end curated font selector with Arial default (backend font whitelist + capabilities, frontend selector, upload params, job metadata/details) (`be/pipeline/render/fontCatalog.js`, `be/services/capabilitiesService.js`, `be/index.js`, `fe/src/components/PdfOptions.tsx`, `fe/src/hooks/usePdfOptions.ts`, `fe/src/hooks/useFileHandling.ts`, `fe/src/types/index.ts`, `fe/src/hooks/useCapabilities.ts`).
- [x] Limited font selector to backend-detected available fonts and auto-fallback to a valid default when preferred fonts are not installed (`be/pipeline/render/fontCatalog.js`, `be/services/capabilitiesService.js`, `be/index.js`, `fe/src/context/AppContext.tsx`).
- [x] Tuned default microbook typography back toward dense “wall-of-text” output while preserving markdown semantics: enabled horizontal justification, reduced body line-height/letter spacing, and moderated heading scale (`be/pipeline/render/tokenStyles.js`, `be/index.js`).
- [x] Fixed stretched mini-sheet header under horizontal justification by forcing compact/non-justified mini header layout (`be/pipeline/render/tokenStyles.js`).
- [x] Changed paragraph break rendering from hard line breaks to four non-breaking spaces, while keeping heading boundaries as line breaks (`be/index.js`).
- [x] Refined justified-flow readability: mini sheet header now renders inline with body text (`display: inline-block`) and paragraph separators now use preserved plain spaces (`white-space: pre`) to reduce stretched/empty-looking lines (`be/pipeline/render/tokenStyles.js`, `be/index.js`).
- [x] Removed stretchable paragraph separator spaces from justified flow: paragraph breaks now render as fixed-width non-stretch gaps (`inline-block` width), reducing large intra-line spacing artifacts while keeping horizontal justification (`be/pipeline/render/tokenStyles.js`, `be/index.js`, `be/tests/tokenStyles.test.js`).
- [x] Tightened line density under justified layout: reduced paragraph-gap width, allowed link label/url wraps without NBSP lock, tightened base word spacing, and reduced horizontal cell padding to fit more words per line (`be/pipeline/render/tokenStyles.js`, `be/index.js`, `be/page.html`, `be/tests/tokenStyles.test.js`).
- [x] Switched body flow from full justification to deterministic left alignment to eliminate renderer-added large intra-line gaps; paragraph separators are now literal preserved 4 spaces only (`be/pipeline/render/tokenStyles.js`, `be/index.js`, `be/tests/tokenStyles.test.js`).
- [x] Eliminated hidden spacing sources in token rendering: removed implicit trailing spaces from token payloads, inserted explicit single-space text nodes only between adjacent text-like tokens, restored exact 4-space paragraph separators, and collapsed inline styled runs to phrase-level tokens to avoid per-word italic/bold spacing artifacts (`be/index.js`, `be/pipeline/documentPipeline.js`, `be/tests/documentPipeline.test.js`).
- [x] Upgraded markdown import to parser-backed `markdown-it` and added inline formatting/link support (`be/pipeline/importers/markdownImporter.js`).
- [x] Added semantic inline token rendering (bold/italic/code/links) in renderer pipeline (`be/pipeline/documentPipeline.js`, `be/index.js`).
- [x] Fixed link rendering edge cases: bare URL links now render as plain URL, and wrapped links render as `Label (URL)` with underline on label only (`be/pipeline/documentPipeline.js`, `be/index.js`).
- [x] Added tolerant parsing for malformed `**bold**Word` markdown and reduced stretched line artifacts via markdown normalization/link rendering fixes (`be/pipeline/importers/markdownImporter.js`, `be/page.html`, `be/index.js`).
- [x] Preserved markdown list markers (ordered/bulleted) so numbering is rendered in output (`be/pipeline/importers/markdownImporter.js`, `be/tests/documentPipeline.test.js`).
- [x] Tuned link underline style to be thinner and less visually broken in wrapped/italic text (`be/index.js`).
- [x] Hardened Puppeteer launch config: auto-detect browser binary paths and fallback to Puppeteer-managed Chrome instead of hardcoded `/usr/bin/chromium` (`be/utils/browserUtils.js`, `be/index.js`).
- [x] Added backend capabilities endpoint for accepted formats/max upload/basic defaults (`be/services/capabilitiesService.js`, `be/index.js`).
- [x] Integrated frontend with dynamic capabilities and simplified upload params (`fe/src/hooks/useCapabilities.ts`, `fe/src/services/capabilitiesService.ts`, `fe/src/hooks/useFileHandling.ts`, `fe/src/types/index.ts`).
- [x] Removed module-level dropped/loaded file globals by moving selected file into shared app state (`fe/src/hooks/useFileState.ts`, `fe/src/hooks/useFileHandling.ts`, `fe/src/context/AppContext.tsx`).
- [x] Added backend tests for pipeline + queue (`be/tests/documentPipeline.test.js`, `be/tests/jobQueueService.test.js`).
- [x] Fixed Vitest/Jest drift and updated tests for current architecture (`fe/src/**/*.test.ts*` updates).
- [ ] Remaining nice-to-have: split `be/index.js` into route/controller modules. It is cleaner than before but still central.

## Short Answer: Is Puppeteer The Right Tool?
Yes, for this project right now.

Why Puppeteer is a good fit:
- You already rely on HTML/CSS layout, which is ideal for print-style control.
- It is fast to iterate visually for a hobby project.
- It avoids building a custom PDF layout engine from scratch.

When Puppeteer becomes the wrong fit:
- You need strict deterministic typography independent of browser engine changes.
- You need very high throughput at scale (many concurrent jobs).
- You need advanced book publishing controls beyond what CSS paged media can comfortably do.

Recommendation:
- Keep Puppeteer.
- Refactor architecture around a content pipeline so Puppeteer is just the renderer, not the entire business logic.

## Major Oversights / Anti-Patterns / Architecture Risks

### 1) High risk: unsanitized job IDs used in filesystem paths
- `bookName` is embedded directly into `id`, then used in file paths.
- A crafted book name can cause path traversal-like behavior or unsafe file paths.
- File refs: `be/index.js:53`, `be/index.js:68`, `be/index.js:536`.

What to do:
- Stop deriving file paths from user text.
- Use `crypto.randomUUID()` (or ULID) for job IDs.
- Store user-facing name in metadata only.

### 2) Monolithic backend file (hard to extend)
- `be/index.js` owns API routes, job lifecycle, rendering, progress, and persistence.
- This makes “add format support” and “new output styles” harder than needed.

What to do:
- Split into modules: `routes`, `services`, `pipeline`, `renderers`, `storage`.

### 3) No formal document model
- Rendering logic currently works directly on raw split words in `page.evaluate`.
- That blocks rich formatting and structured imports (Markdown/HTML/docx).

What to do:
- Introduce a normalized intermediate model (AST/document blocks) before layout.

### 4) Frontend hard-codes `.txt` in multiple places
- File acceptance and validation is scattered.
- File refs: `fe/src/components/FileControls.tsx`, `fe/src/hooks/useDragAndDrop.ts`, `fe/src/hooks/useFileHandling.ts`.

What to do:
- Centralize allowed formats in one source of truth (prefer backend-driven config endpoint).

### 5) Module-level file storage in frontend hooks
- `droppedFileStorage` / `loadedFileStorage` are module globals.
- This is fragile and makes behavior harder to reason about in React lifecycle.
- File ref: `fe/src/hooks/useFileHandling.ts`.

What to do:
- Move selected file into context/store state.

### 6) Concurrency and job-control limitations
- No queue/backpressure strategy for many jobs.
- Multiple jobs can contend for browser/process resources.
- Shared `output.html` debug file can be overwritten by parallel runs.
- File ref: `be/index.js:500`.

What to do:
- Add a minimal in-process queue (concurrency 1-2).
- Make debug outputs job-scoped.

### 7) Tests are drifting from implementation
- Vitest is configured, but many tests still use Jest globals (`jest.mock`, `jest.spyOn`) and fail.
- Some component tests don’t match provider requirements.

What to do:
- Standardize test runtime on Vitest (`vi`), fix provider wiring, then enforce CI pass.

## Refactor Direction For Your Two Goals

## Goal A: Easy to add new import formats
### Recommended design
Create an import pipeline:
1. `ingest` (read uploaded file bytes + MIME/ext)
2. `parse` (format-specific parser)
3. `normalize` (convert to common document model)
4. `layout` (paginate into microbook cells)
5. `render` (Puppeteer HTML->PDF)

### Importer plugin interface
Example concept:
- `canParse(fileMeta): boolean`
- `parse(buffer, options): ParsedDocument`

Start with importers:
- `txt` importer (existing behavior)
- `md` importer (headings, paragraphs, emphasis)
- Later: `html`, `docx` (optional)

### Frontend/backend contract
- Add endpoint `GET /api/capabilities` returning allowed formats + limits.
- Frontend `accept` and validation use that response.
- Remove hard-coded `.txt` checks from UI hooks/components.

## Goal B: Nicer output, not just wall of text
### Recommended design
Separate content semantics from rendering style:
- Keep structured blocks: heading, paragraph, quote, separator, metadata.
- Keep one strong default print style while making inline semantics (links/emphasis/code) first-class.

### First improvements with best ROI
- Better paragraph detection and spacing.
- Heading treatment (size/weight/spacing).
- Optional drop caps for chapter starts.
- Slightly improved line-height and margins by block type.
- Orphans/widows guard heuristics for cleaner page breaks.

### Keep it simple
Do not try to build a full publishing engine.
Support a few semantic blocks and reliable inline markdown rendering.

## Suggested Target Structure

```text
be/
  src/
    routes/
      upload.js
      jobs.js
      progress.js
      capabilities.js
    services/
      jobService.js
      progressService.js
      storageService.js
    pipeline/
      importers/
        txtImporter.js
        markdownImporter.js
      normalize/
        toDocumentModel.js
      layout/
        microbookLayout.js
      render/
        htmlRenderer.js
        puppeteerPdfRenderer.js
    templates/
      page.html
      styles/
        classic.css
        compact.css
```

## Minimal Incremental Plan (No Big Rewrite)

Phase 1 (Safety + stability):
- Replace ID generation with UUID.
- Sanitize filenames/metadata.
- Add queue concurrency limit.
- Make output/debug files job-specific.

Phase 2 (Format extensibility):
- Introduce `DocumentModel` type.
- Implement `txtImporter` through new importer interface.
- Wire pipeline while keeping current visual output.
- Add `GET /api/capabilities` and frontend uses it.

Phase 3 (Output quality):
- Add paragraph-aware normalization.
- Add markdown importer.
- Add robust inline markdown rendering (links/images/emphasis/code) and link display formatting.

Phase 4 (Developer experience):
- Fix Vitest suite and CI test command.
- Add integration tests for upload -> progress -> completed.

## Practical Notes
- For a hobby project, avoid premature abstraction. Build just enough plugin/pipeline boundaries to support `txt` + `md` first.
- Keep Puppeteer unless your real pain is rendering performance or deterministic typography.
- Most of your future flexibility comes from a good content model, not from swapping rendering engines.

## Recommended Immediate Next Moves
1. Fix ID/path safety and queueing first.
2. Add a tiny importer registry with `txt` as first plugin.
3. Add markdown support as the first “new format”.
4. Improve inline rendering quality (especially links/images) to prove the architecture.
