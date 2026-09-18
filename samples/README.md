# Flatland sample

[Sample PDF](flatland-microbook.pdf) · [Layout settings](flatland-settings.json) · [Source EPUB](https://standardebooks.org/ebooks/edwin-a-abbott/flatland)

*Flatland*, by Edwin A. Abbott, is a short novel about a two-dimensional world. This sample uses the Standard Ebooks edition: proper chapter headings, the original geometric diagrams, and a cover based on Edward Wadsworth’s *Rotterdam* (1914).

The text and artwork are public domain in the United States. Standard Ebooks dedicates its contributions to the public domain under CC0. Rights can differ elsewhere. The source credits and Uncopyright section remain in the PDF; MicroBook is not affiliated with Standard Ebooks.

## This layout

- Rich mode, Letter portrait, 7 CSS px (5.25 pt), Arial.
- Six printed sides on three duplex sheets, read by quadrant.
- 2.5 mm fold protection at quadrant boundaries, solid fold lines.
- One-cell cover, original diagrams, gentle laser image output.
- The duplicate title/half-title pages and dedication are omitted. Publisher logos are hidden, and the imprint is moved to the end. The preface, all 22 chapters, notes, illustration list, colophon, and rights text are retained.
- The displayed year, 2018, comes from the EPUB edition metadata; the book was first published in 1884.

The README screenshot shows this same PDF in the local MicroBook workspace. The sample layout has been approved for release.

## Source and reproduction

- [Download EPUB](https://standardebooks.org/ebooks/edwin-a-abbott/flatland/downloads/edwin-a-abbott_flatland.epub)
- Source edition: August 15, 2026; Standard Ebooks revision `f27032c`, as recorded in its colophon.
- Source SHA-256: `16825d30312e53208c6031f6966736e3e6a01c4969c188a68ec47493cad620d7`
- PDF SHA-256: `f0aa5b68cd23143d27149cdccd488a4a38b42868a7a6c59eb7ce57ea41d1372e`
- Renderer source: MicroBook commit `2fdf531` (before the release documentation changes).

Download the EPUB as `flatland.epub`, then run:

```sh
npm run mb -- render --input flatland.epub --mode rich --settings samples/flatland-settings.json --out .artifacts/flatland-sample
```

The source download can change; use the recorded hash to identify this edition. The settings contain section/image IDs from that file. PDF timestamps may differ between runs.

In the app, import `flatland-settings.json` under Layout → Advanced to reuse the portable layout settings. The app intentionally skips book-specific section and image choices; repeat the omissions and imprint move listed above in Content, then Apply. The CLI command preserves those choices for the matching source EPUB.

Print at **100% / actual size**, one PDF page per printed side, and check duplex direction on one sheet first.
