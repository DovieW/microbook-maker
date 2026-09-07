# Unified MicroBook workspace

The workspace has a 48px header, a left sidebar and a 40px bottom bar. The first printed side begins 10px below the header. Flat navy surfaces use a restrained mint accent; the generated PDF's typography, colors, folding geometry and defaults are unchanged.

Layout contains mode, font/size, folds and Rich paragraph/heading controls. Contents separates section navigation from inclusion. Images keeps small thumbnails in source order and expands detailed controls only for the selected image. The header’s History button opens recent books, current Basic/Rich layouts and kept versions in the sidebar. History is separate from the editing tabs; Back to layout returns to the controls. Original filename/import date in each book menu distinguishes identical titles; no duplicate records are merged.

The desktop sidebar stays open, defaults to 280px, resizes from 280–440px and remembers its width. Its separator accepts Left/Right for 10px changes, Home or double-click for 280px. Tab headings support Left/Right/Home/End. Below 960px the same tabs appear in a full-screen drawer, closed initially; navigation jumps close it and restore focus to the tools button.

One sticky area handles Apply, Revert, progress, Cancel and Retry. Apply remains visible and disabled when nothing has changed. Revert restores the displayed current layout's applied settings and metadata without changing books or reading position. On mobile, the tools button indicates unapplied changes when the drawer is closed. Image and section locations continue to describe the current PDF until Apply succeeds. Failed/cancelled rendering preserves the PDF and its map.

An application update alone does not mark an existing PDF as pending or require regeneration before printing. Pending changes compare actual settings and metadata; new Apply requests still use renderer fingerprints for server cache validation.

## Reading and output

PDF.js viewer components render complete printed sides continuously, with selectable text. Find uses the displayed PDF, including older kept versions; Ctrl/Cmd+F opens it, Enter/Shift+Enter navigate matches, and Escape closes it. The footer reports actual sheets/sides, provides editable side navigation and Front/Back location, and places Find/zoom on the right. Clicking the zoom percentage toggles fit-to-width and physical 100%. PDF coordinates preserve the reading location across zoom and resizing.

Canvas rendering is lazy and limited to 16 megapixels per canvas. Distant canvases are reset after scrolling, while inactive modes retain their PDF and location and release canvases. Image highlights, Edit buttons and search overlays do not enter the PDF.

Print invokes the native PDF frame on the same origin, without opening another tab. Download is a separate optional icon. Pending edits become Apply & Print / Apply & Download; only the matching successful result can complete that action. Cancellation, failure and switching documents/modes discard queued output. If automatic printing is unavailable, native PDF controls appear inline with Return to preview.

## History and kept versions

The latest completed Basic and Rich layouts are retained automatically. Keep version in History adds a retention flag and an automatic mode/size/date label; it does not download anything. Rename and Stop keeping version are in the version menu. Existing saved exports are preserved as kept versions.

Opening a version displays its exact artifact and metadata without changing working drafts. Return to current restores the working layout; Use these settings intentionally copies the version's snapshot into the draft. Printing/downloading does not keep a version. Displayed and printing artifacts renew server leases so routine cleanup cannot remove them mid-session.

Preference version 5 preserves existing drafts, images, zoom, render IDs and reading locations while removing the obsolete view choice. It adds sidebar preferences, continuous reading coordinates and per-document PDF search. Original books and all PDF artifacts stay on the server.

## Verification

The browser suite covers the compact frame, keyboard resize/tab navigation, mobile drawer and focus, continuous PDF fidelity, text selection/search, canvas bounds/eviction, mode caching, Apply/Revert/retry/cancellation, stale responses, per-document settings, image placement/context navigation, legacy preference migration, kept-version isolation and exact output bytes. The ordinary quick runner also checks Basic goldens and Rich content/layout boundaries.

The Chrome/Linux native-print check used the application's actual Print button and an isolated Save as PDF destination: three Letter pages, 21,701 extracted words, identical word bounds (0 pt measured difference), embedded vector fonts and exclusively `#000000` generated text. It opened no extra tab and did not keep the render. Evidence is under `.artifacts/workspace-redesign/native-app-print`.

The final packaged application passed all 23 browser workflows against copied Library storage. The quick verification also passed type checking, the production build, 28 logic tests, 30 Basic parser/style tests, Basic reference comparisons, Rich content/layout checks and worker recovery checks. A long-document search found all 24 known matches, including matches on an unrendered side; only five canvases remained after navigation. Reports are under `.artifacts/workspace-redesign`.

The localhost candidate was updated and checked in Chrome 152 on the IdeaPad at `http://localhost:36243/`. Its existing five books opened without regeneration; the header measured 48px, the sidebar 320px, and the first printed side began at y=58px. All 15 original source/PDF files matched their pre-update checksums. The original rollback image is `microbook-maker:before-workspace-redesign`; the original volume backup is `.artifacts/workspace-redesign/before-volumes.tar`. The final compatibility patch also has a separate `before-final-volumes.tar` backup. Exact image IDs, checksums and the deployment record are retained alongside them. TrueNAS production was not changed.

Physical Brother HL-L6200DW feed direction, printable margins, duplex folding and toner/image quality still require an actual paper check. This interface update does not alter PDF generation or print geometry.

The follow-up sidebar polish removes image previous/next controls, wraps Contents titles without horizontal scrolling, and toggles Select all / Deselect all. The footer displays the difference against the other mode’s last rendered layout in muted text; settings need not match, so this is an actual paper-count comparison rather than a controlled density benchmark.

Layout uses aligned control columns, a full-width font selector and full-width book details with a multiline title. Images use section titles as the primary label, compact divided rows and an expanded selected row for layout and heading controls. Existing draft, Apply and source-location behavior is unchanged.

## Flourishes

Rich mode supports Illustration, Flourish and Heading treatments per image occurrence. Under Images → Repeated images, **Use as flourishes** converts a confirmed group of identical imported assets occurring between paragraphs. Detection proposes groups only; it does not automatically change or exclude content.

Flourishes remain at their source position, centered in the text flow. Their default maximum width is 4 em, capped at 3 em high while preserving aspect ratio; the default gap above and below is 0.25 em. They ignore one/two-cell placement and the illustration scale. Max width and gap are adjustable per occurrence. Matching-image controls copy the selected treatment and its sizing, or include/exclude the whole exact-asset group. Individual overrides and exclusions remain available. Apply updates the PDF, maps and actual paper counts together.
