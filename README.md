# MicroBook Maker

Turn a book into a compact, printable PDF. One self-hosted application, no account, on port **7777**.

**Basic** preserves the original TXT/Markdown pipeline and folding geometry. **Rich** imports reflowable EPUB 2/3 and retains chapters, paragraph boundaries, emphasis, illustrations, captions, poetry, lists, simple tables, and endnotes. Both start at **6 CSS px / 4.5 pt**, on Letter paper with 16 cells per side. Text size is always your choice. The preview always shows full printed sides. Solid fold lines and space at folds are the defaults.

Rich distinguishes parts and chapters when EPUB semantics or clear numbered labels identify them. **Layout → Headings** provides separate size, spacing and upright/italic controls, plus optional rules. Rich position headers show sheet/front-or-back and text progress; they can be disabled in Layout. Images stay in full color and use one cell by default; optional **Two-cell images** centers each illustration across two adjacent cells, rotated for viewing by turning the paper clockwise. Source page numbers are hidden by default, and the opening cell has no position header. Continuous paragraphs remain the default, with optional blank-line spacing. Generated print text is pure black. See [print controls and Brother printer guidance](docs/PRINT_REFINEMENTS.md).

The left sidebar brings **Layout, Contents, and Images** together. It starts at 280px and can be resized; phones use the same controls in a full-screen drawer. Images have compact thumbnails, actual printed locations, inclusion and one/two-cell choices.

The flat navy workspace displays the server PDF continuously, with selectable text and full-book search. Open a book, edit settings, and press **Apply**; **Revert changes** restores the displayed layout. Drafts, mode preferences, reading positions, zoom, and sidebar size are remembered in your browser. **Print** uses the existing vector PDF without a new tab; the adjacent download icon is optional. The header’s **History** button opens recent books and versions in the sidebar. History automatically retains the latest Basic/Rich layouts. **Keep version** preserves an older layout under a name without downloading it. See the [workspace guide](docs/WORKSPACE_REDESIGN.md).

## Start locally

The host needs Node 24 and Docker. No host Chromium, Python, or font installation is required.

```sh
npm run mb -- setup
npm run mb -- doctor
npm run mb -- dev --no-build
```

Open [localhost:7777](http://localhost:7777). Development data goes in `.artifacts/dev-data`. Use `--port 7780` for another local port, or `--data /absolute/path` for an explicit development data directory. Re-run setup after editing source to rebuild the image; Docker caches dependencies and the rendering environment.

For an installed native Chromium environment, `npm ci --ignore-scripts`, `npm run build`, and `npm run dev` run the server directly. Set `PUPPETEER_EXECUTABLE_PATH` if necessary. Use Docker for authoritative Basic comparisons.

## Test or render any book

```sh
npm run mb -- check
npm run mb -- render --input /absolute/path/book.epub --mode rich --out /tmp/microbook-report
npm run mb -- compare --input /absolute/path/book.epub --out /tmp/microbook-comparison
npm run mb -- test --suite full
npm run mb -- bench --input /absolute/path/book.epub --mode rich --runs 3
```

CLI modes are `basic` and `rich`; the original `classic` and `book` aliases remain supported. API/settings JSON retain `classic` and `book` identifiers so existing preferences and exports remain compatible.

Add `--no-build` to reuse the image from setup. The optional `--settings /absolute/path/settings.json` accepts the same versioned schema as the interface. Export a configuration from **Layout → Advanced → Settings JSON**.

Every command starts its own application with temporary storage and an available local port. Input files are mounted read-only. Tests never discover or target production. Reports contain the PDF, page images, source map, settings and font fingerprints, content/overflow checks, timings, and memory measurements. Benchmarks separate cold application/browser startup, warm rendering, and cache hits. Reports and private inputs stay outside tracked fixtures.

The quick suite includes logic tests, original Basic parser tests, pixel comparisons, browser workflows, cancellation/recovery, and boundary cases. The full suite adds a multi-side Basic folding reference and pinned public-domain editions of illustrated Alice, Frankenstein, and Moby Dick. See [verification details](docs/VERIFICATION.md).

## Deploy

```sh
docker compose -f docker-compose.production.yml up --build -d
```

The existing volume paths remain `/app/be/uploads` and `/app/be/generated`. Historical exports retain their original bytes and download URLs. **Test a copy of existing volumes on another port before upgrading an installation.** The [deployment guide](DEPLOYMENT.md) describes the candidate and rollback procedure.

## Code

| Component | Responsibility |
| --- | --- |
| `apps/web` | React workspace, browser preferences, PDF preview, Library |
| `apps/server` | Express API, atomic filesystem records, background job coordination |
| `packages/core` | Shared settings/contracts, bounded source import, semantic document model |
| `packages/renderer` | Frozen Basic pipeline, compact Rich compositor, Chromium rendering |
| `tools` | Docker runner, fixtures, independent content/PDF audits, reports |
| `tests` | Synthetic inputs, Basic goldens, logic/browser tests, public-book manifest |

See [architecture and API](docs/ARCHITECTURE.md) for storage, rendering, and compatibility details.
