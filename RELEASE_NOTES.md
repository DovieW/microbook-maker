# MicroBook 2.2

This release makes the workspace feel more responsive and pleasant while keeping motion subtle and purposeful.

## What’s new

- **Clear Apply feedback.** Applying layout changes now has a short, readable progress transition and a restrained completion response.
- **Smoother workspace navigation.** Sidebar tabs, sections, dialogs, and expanding content controls transition without abrupt jumps.
- **Stable content reordering.** Moving text and images animates their actual before-and-after positions, making the new order easier to follow.
- **Gentler preview updates.** Completed renders enter cleanly and preserve the reader’s sense of place while controls update.
- **Motion accessibility.** The interface follows the operating system’s reduced-motion preference and keeps essential state changes understandable without animation.

## Upgrading

Back up both persistent volumes and keep the previous container image before upgrading. Reuse the same compose project, volumes, and mount paths so the existing library remains available. Do not run `docker compose down -v`.

See [deployment and rollback instructions](DEPLOYMENT.md). Existing PDFs remain stored as originally rendered; applying settings again uses the updated renderer and can change page flow.
