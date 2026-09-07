# Images workspace

The unified left-sidebar design in [Workspace redesign](WORKSPACE_REDESIGN.md) supersedes the original panel arrangement described below. Image inclusion, sizing, heading conversion and location semantics remain in use.

The preview always shows a complete printed side. The editable **Printed side** number moves through PDF pages; zoom changes only the preview. Cell view and cell-click enlargement have been removed. Physical cells remain part of the print layout and image-size controls.

In Rich mode, the **Images** tab uses the shared left sidebar (full-screen tools on mobile). Images follow source order. Tapping a title or the row's empty area expands its options without navigating the PDF. Thumbnails are larger, and the selected row includes a full-width image preview. Tapping either image opens a separate large preview with zoom, pan, Fit, Escape/Close, and focus restoration. Only the **Sheet N · Front/Back** location or **Go to context** button jumps in the PDF; on mobile, that jump closes the tools drawer.

Treatment is the single control for Illustration, Flourish, or Heading. Heading text/type appear directly for Heading treatment; the duplicate Heading disclosure and checkbox have been removed. Checkboxes throughout the workspace retain native semantics with a consistent mint mark, keyboard focus, disabled states, and a 44px touch target.

The image buttons shown on hover, keyboard focus, or touch open the editor at the corresponding image. Highlights and controls are HTML overlays, never PDF content. Older PDFs without identified image regions still support sidebar jumps through their existing cell maps; their precise overlays appear after an ordinary Apply.

Individual inclusion and two-cell controls remain independent of navigation. The collapsed **Defaults** section contains global illustration inclusion, two-cell layout and image scale. All image controls have moved out of Settings. Apply uses the same shared draft as the toolbar and Settings, including pending typography or metadata changes. It keeps the sidebar open and preserves the actual reading position across repagination. Merely inspecting a different image does not change that position. Failure or cancellation keeps the prior preview.

Excluded images remain listed. **Not in preview → Go to context** navigates to the nearest following rendered source block, or the preceding block when there is no following content. With no rendered context the button is disabled. Until Apply succeeds, locations refer to the existing PDF, including images pending exclusion.

Image choices and selected image are remembered per document. The shared sidebar preferences preserve its width and active tab. Mobile tools start closed after reload; opening a preview does not change saved print settings or reading positions. Basic hides the image editor and image overlays.

## Verification

The quick suite covers complete-sheet PDF pixel fidelity, sheet navigation and mode caching; image jumps and source-context fallback; one/two-cell overlay geometry at different zoom levels; Apply relocation and exclusion; mobile dialogs and keyboard controls; legacy maps without region IDs; and migration from Cell-view preferences. Existing PDF content, black-ink, folding and Basic regression checks remain in place.

Verified September 6, 2026: `npm run mb -- check --out .artifacts/images-sidebar/final-check` passed 25 logic tests, 30 Basic tests, rendering/content checks and all 18 browser workflows. Five focused image browser workflows also passed against the packaged runtime with copied Library storage. Desktop/mobile screenshots and the copied real-book image list were inspected.

The localhost candidate was updated and verified from the IdeaPad at `http://localhost:36243/`, including the new interface bundle, renderer health and all five Library documents. All 17 source/PDF files in the immediate deployment backup remained byte-identical. Rollback image: `microbook-maker:before-images-sidebar`; volume backup: `.artifacts/images-sidebar/before-volumes.tar`; deployment evidence: `.artifacts/images-sidebar/deployment.json`. TrueNAS production was not changed. This update changes preview controls and image-region metadata, not printed geometry; no additional physical folding test was performed.
