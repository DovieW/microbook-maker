# Heading artwork

Rich mode distinguishes image-based chapter/part titles from illustrations. Explicit heading markup remains authoritative. For unmarked images, automatic recognition requires three agreeing signals: the image opens its EPUB section, its alternative text contains a numbered Chapter/Part/Book label, and that text matches the section navigation title after case and punctuation normalization. Uncertain images stay illustrations. There is no OCR or remote lookup.

Detection runs over the shared document model, including previously imported Library books. It does not rewrite original EPUB bytes, source blocks, block IDs or saved PDFs. A normal Apply updates an older preview. Basic rendering is unchanged.

Each illustration has a collapsed **Heading** control containing **Treat as heading**, editable text and Chapter/Part selection. The resulting text uses the existing Rich heading styles. Converted illustrations remain listed with a Heading label so their corrections can be reversed. Automatically detected artwork is collected separately in collapsed **Heading artwork**, with the same correction controls and preview-location jumps. Reset restores automatic detection; unchecking Treat as heading explicitly restores the source image, even when detection would classify it as a heading.

Corrections are per-occurrence `imageTreatments` entries in the shared render settings, with either `{kind: 'image'}` or `{kind: 'heading', text, headingKind: 'chapter' | 'part'}`. They persist per document, participate in render caching and content coverage, and are cleared from defaults inherited by other books. Illustration inclusion and two-cell settings do not suppress text headings. Restoring an image restores its previous illustration controls. Empty manual titles are rejected by the API; an empty text field restores the previous value on blur.

## Verification and rollout

Verified September 6, 2026: type checking, 28 logic tests, 30 Basic tests and the quick PDF rendering/content checks passed. All 19 browser workflows passed against the packaged application with copied Library storage; the heading-correction workflow was repeated successfully after the final collapsed-row UI refinement. The initial browser attempt needed a test correction because a checkbox legitimately moves between lists when its classification changes.

A copied edition of the reported book detects all 78 heading-artwork occurrences, including source block `b2412` (Chapter 48). Its new output retains 14 printed sides, and Chapter 48 no longer appears in image regions. The corrected heading controls and image list were visually inspected. Private reports remain under ignored `.artifacts/heading-artwork`.

The localhost candidate was updated and its bundle, health and five Library documents verified from the IdeaPad at `http://localhost:36243/`. All 17 source/PDF files in the immediate backup remained byte-identical. Rollback image: `microbook-maker:before-heading-artwork`; backup: `.artifacts/heading-artwork/before-volumes.tar`; deployment evidence: `.artifacts/heading-artwork/deployment.json`. TrueNAS production was not changed.
