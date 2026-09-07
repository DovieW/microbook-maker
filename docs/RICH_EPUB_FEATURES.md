# Rich EPUB features

Rich mode can preserve EPUB navigation and semantics while adding references that work on paper. These controls do not change Basic rendering or the 4 × 4 Letter print geometry. All generated text remains black; images retain their own colors.

## Defaults and controls

New Rich imports enable compact generated contents, PDF bookmarks, clickable links, printed URLs after link text, printed internal-link locations, chapter-end notes, and semantic passage formatting. Existing documents retain their previous settings and PDFs. **Layout → Navigation & references → Use new Rich defaults**, followed by **Apply**, opts an existing book into these defaults. The action changes the new Rich feature settings only.

| Group | Settings | New-book default |
| --- | --- | --- |
| Navigation & references | Printed contents: compact / publisher / none; parts and chapters / all sections | Compact; parts and chapters |
| Navigation & references | PDF bookmarks and bookmark depth | On; parts and chapters |
| Navigation & references | Chapter names in position headers | Off |
| Navigation & references | Original page references: off / mini headers / source boundaries | Off |
| Links & notes | Printed URLs: after text / chapter list / book list / hidden | After text |
| Links & notes | Clickable links; printed internal destinations | On |
| Links & notes | Notes: after chapter / referring paragraph / end of book / source placement / existing layout | After chapter |
| Special passages | Quotes, epigraphs, letters, poetry, asides; spacing and indentation | Enabled, 0.25 em gap and 0.5 em quote/aside indent |
| Headings | MicroBook / available publisher heading font | MicroBook |
| Headings | Chapter drop caps, two or three lines | Off; two lines |
| Images → Defaults | Preserve vector SVG / raster compatibility | Preserve vector |

Settings remain per-document drafts until Apply. Revert, retained versions, mode caches, source navigation, and output cancellation retain their existing behavior. Outdated completed PDFs are offered an explicit **Update layout** action; opening a document does not silently replace its PDF.

## Printable and clickable references

Compact contents and internal-link references use final locations such as **Sheet 3 · Back · Cell 6**. Cells count left to right, top to bottom on each printed side. The layout reserves location space before pagination and fills it from final destinations afterward, avoiding a pagination feedback loop. PDF bookmarks and links target the actual content block, not the generated contents entry.

For an external link, its visible text is retained and the full URL is added without shortening its path, query, or fragment. URLs already visible as link text are not repeated. Chapter/book URL lists deduplicate destinations within their group. Email and telephone links print their addresses/numbers. Internal EPUB filenames are resolved to printed locations instead of being printed as web URLs. Unsupported schemes stay plain text and receive a grouped diagnostic.

Linked images use their supplied alternative text and destination after the image's existing caption. Ordinary image alt text is not printed as an unsolicited caption. Link destinations are never fetched.

Typed footnotes/endnotes are grouped once, including multi-paragraph notes and repeated references. Included references retain their notes even when their original note section is excluded. Linked notes include a return link to the first referring block. Unmarked note text is retained. Near-reference placement means **after the referring paragraph**, not a footnote pinned to a cell bottom. Source placement follows the original block order; missing or unreferenced targets fall back to end notes.

Generated contents, printed URLs, and navigation labels are excluded from source reading offsets and word counts. The renderer verifies source character coverage separately from generated display text.

## Source-dependent features and limits

- Semantic passage formatting relies on EPUB markup and existing line breaks. It does not guess that ordinary prose is poetry or invent stanza divisions.
- Page references use EPUB pagebreak markers or page-list navigation. Books without either cannot acquire authentic original page numbers. Header references require position headers to be enabled.
- Compact contents replaces publisher contents explicitly identified by semantic markup, EPUB guide references, or navigation landmarks; ambiguous unmarked front matter is preserved to avoid deleting prose.
- Publisher fonts are optional and limited to headings. Local TTF, OTF, WOFF, and WOFF2 fonts are validated with Fontkit. Standard IDPF/Adobe font obfuscation is supported; DRM remains unsupported. Missing, damaged, restricted, or oversized fonts fall back to MicroBook typography with a diagnostic. Arbitrary publisher CSS/page geometry is not adopted.
- Drop caps apply to Latin chapter-opening prose. Notes, special passages, and non-Latin openings keep their normal typography.
- SVG is preserved as vector by default. Raster compatibility rasterizes only SVG images after placement, at up to 600 dpi with a 40-megapixel cap; body text remains vector text. This is a compatibility option, not a guarantee of improved printer output.
- Audio/video, scripting, fixed-layout EPUB reconstruction, MathML conversion, and true cell-bottom footnotes are outside this implementation.

## Implementation and verification

Import revision 4 adds anchors, navigation hierarchy, note groups, source order, passage roles, page lists, and publisher font records without adding or renumbering source blocks. Reimport writes assets/fonts into revision directories and retains document metadata and completed artifacts. `rich-content.ts` performs the configurable transforms; the Rich browser compositor assigns final PDF destinations.

Tests cover legacy defaults, immutable imported source, note deduplication and excluded note containers, linked captions/tables, navigation-only page markers, damaged fonts, and IDPF/Adobe font obfuscation. Browser checks inspect actual PDF outlines, link annotations, URL text, note occurrence, optional typography, and layout coverage, alongside the existing Basic and workspace suites.
