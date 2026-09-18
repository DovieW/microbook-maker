# MicroBook 2.0 release review

Status: approved by the owner for stable 2.0 publication and deployment to the NAS and Cloudflare.

## Review materials

- [x] Simplified README reflecting the current Layout / Content workspace.
- [x] Flatland sample PDF, settings, source attribution, and workspace screenshot.
- [x] Draft 2.0 release notes.
- [x] Release workflow switched to the Flatland attachments.
- [x] Owner approval of README, screenshot, and sample layout.

## Before publication

- [x] Change the root and workspace package versions to `2.0.0`, update the lockfile, hosted health version, release Compose image, and deployment guide. Remove the draft notice from release notes.
- [x] Run the release checks: typecheck/build, 63 logic tests, 30 Basic tests, 3 PDF-audit tests, 48 browser tests, Basic pixel comparisons, and all three public books in both modes. Reports are recorded below.
- [x] Confirm the final sample has complete text coverage, no overflow diagnostics, embedded fonts, correct page geometry, and working PDF downloads.
- [x] Test an existing library on copied storage: original PDFs, source files, kept versions, and imports must survive unchanged.
- [x] Check the hosted build locally: import, Apply, download, browser history, and reload.
- [x] Confirm a physical duplex print, folding direction, and small-type/image legibility (owner confirmed).
- [x] Obtain explicit approval to publish the stable release and deploy the approved commit.

## Verification record

Local reports are in `.artifacts/stable-2.0/` and are not published with the release.

- `full.log`: typecheck, build, logic/Basic tests, all 48 browser tests, and Basic pixel comparisons passed. The corpus stage exposed an old audit assumption that titles never truncate.
- `corpus/`: Alice, Frankenstein, and Moby Dick were rerun in both modes after correcting that audit. Source hashes and EPUB text audits also passed. The corrected audit was checked against all 16 earlier Rich verification PDFs; three new tests reject invalid metadata/counts.
- The initial browser run also exposed an obsolete image-row selector; the corrected accessible-label check passes in `full.log`.
- `library-preservation.json`: 28 existing books, source files, retained PDFs, and a kept version verified on isolated copied storage in the 2.0 runtime container. Three superseded, unkept draft renders were removed by normal cleanup, matching the original local server.
- `hosted-test.log` and `hosted-apply.log`: local hosted import, Apply, PDF download, history reload, isolation, and mobile checks passed.
- `flatland/` and `runtime-job.json`: approved sample reproduced with complete text, no overflows, and matching extracted text/layout.
- `cloudflare-dry-run.log`: existing local OAuth login and Free-account guard passed; dry run completed without deployment.

GitHub has the Docker publication secrets but is missing `CLOUDFLARE_API_TOKEN`. The automatic Cloudflare job cannot deploy until that secret is configured. The verified local CLI can deploy after approval; no credentials were copied or changed.

## Publication and deployment (after approval)

1. Record the production image digest and back up both NAS data volumes.
2. Push the approved release commit. Pushing `master` triggers Verify and then the Cloudflare workflow; treat that push as a deployment action. Use the verified local CLI for Cloudflare while the CI token is missing.
3. Tag the verified commit `v2.0.0` and push that tag. The release workflow checks the version, runs verification, publishes the linux/amd64 container, creates the GitHub release, and attaches the sample PDF/settings.
4. Confirm the published image digest and release assets. Deploy that digest to the NAS with the existing mounts and port.
5. Verify NAS and Cloudflare health, imports, rendering, downloads, and history; record their deployed revisions.

For rollback, retain the previous image digest and data snapshots. Follow [DEPLOYMENT.md](../DEPLOYMENT.md); do not delete persistent volumes.
