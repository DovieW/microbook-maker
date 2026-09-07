# MicroBook 2.0.0-rc.1

A new workspace for turning books into compact, printable PDFs. This is a release candidate; a stable v2 tag has not been published.

## What’s new

- Unified Layout, Contents and Images sidebar with phone-friendly controls and a compact header.
- Continuous PDF viewing, selectable text, full-book search, chapter/image jumps, and direct printing.
- Basic and Rich layouts, with separate part/chapter styling, improved heading detection and optional custom rules.
- Configurable EPUB contents, bookmarks, printable link URLs, notes and semantic formatting.
- Larger image previews, side-by-side output comparisons, gentle laser optimization, per-image rotation, one/two-cell placement and compact flourishes.
- Group controls for repeated artwork, including inclusion, treatment, size, spacing, orientation and output.
- History, retained current layouts, named kept versions, explicit Apply/Revert and recovery without losing the previous PDF.
- Built-in CC0 test-print artwork for new installations, plus a complete public-domain Alice sample PDF.

## Compatibility and upgrading

Existing uploaded books, saved PDFs and kept versions remain available. Existing book settings remain intact; gentle laser optimization is the default for new Rich imports. Basic’s print geometry and original rendering path remain preserved.

Back up both persistent volumes, test copies, and retain the previous image digest. See [upgrade instructions](DEPLOYMENT.md). No automatic deletion or merging of existing Library records is part of this release.

The supported container platform is **linux/amd64**. The current application is for personal/self-hosted use and has a shared Library without visitor isolation. Public anonymous upload hosting is not included in this candidate.

## Before stable v2

- Automated checks passed: packaged quick/full suites, all 35 browser tests, public corpus, original Basic comparisons, copied-Library preservation and native Chrome Save as PDF.
- Confirm a physical duplex/folding and Brother image-quality print.
- Publish the verified candidate container and sample assets, then promote after the trial.

[Sample PDF](samples/alice-microbook.pdf) · [README](README.md) · [Public hosting proposal](docs/PUBLIC_HOSTING.md)

Older implementation logs are archived in [development notes](docs/history/DEVELOPMENT_NOTES.md); their interface descriptions and counts are historical.
