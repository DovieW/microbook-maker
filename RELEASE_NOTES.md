# MicroBook 2.0

MicroBook 2.0 adds a full editing and PDF preview workspace around the original compact book layout.

## What’s new

- **Basic and Rich layouts.** Keep the original approach or preserve more of an EPUB’s headings, illustrations, notes, and structure. Adjust typography, fold gaps, and reading order by row or quadrant.
- **One Content sidebar.** Reorder sections and images together, filter the list, and jump from an item to its place in the PDF.
- **Custom text and images.** Add a note or picture, replace a cover, choose its starting position, and control whether a custom title appears in the book. Edits stay in draft until Apply.
- **Image controls.** Preview print treatments, rotate artwork, use one or two cells, and adjust repeated decorative images together. EPUB covers outside the reading spine are now imported.
- **A searchable PDF preview.** Browse printed sides, follow chapter and image jumps, and print or download the PDF.
- **Saved layouts.** Import and export settings, remember preferences in the browser, and keep named versions in History.
- **Hosted browser history.** The Cloudflare beta stores books and PDFs in the browser without a 24-hour expiry. Its PDF downloads have also been corrected.

The new [Flatland sample](samples/flatland-microbook.pdf) replaces the illustrated Alice example. Its [settings and credits](samples/README.md) are included.

## Upgrading

Back up both persistent volumes and keep the previous container image before upgrading. Reuse the same compose project, volumes, and mount paths so the existing library remains available. Do not run `docker compose down -v`.

Self-hosting uses a shared library without user accounts. The supported container platform is **linux/amd64**. The hosted Cloudflare service remains a beta; its browser history is separate from a self-hosted library.

See [deployment and rollback instructions](DEPLOYMENT.md). Existing PDFs should be downloaded as stored; re-rendering a book uses the updated renderer and may change its layout.
