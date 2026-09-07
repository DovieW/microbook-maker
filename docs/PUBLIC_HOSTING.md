# Public hosting proposal

Status: design only. Public upload isolation is not implemented in the current personal/self-hosted application.

## Requirements

Zero hosting spend; free visitor access; private uploads with automatic deletion; GitHub Actions deployment; a US operator.

## Host selection

| Option                                | Assessment                                                                                                                                                                                                                                                           |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Render Free                           | A restricted experiment, not a reliable recommendation for the current Chromium renderer: 512 MB RAM, 0.1 CPU, idle sleep, no persistent disk.                                                                                                                       |
| Cloudflare Workers Free + Browser Run | Candidate for a small, quota-limited public edition: 10 browser-minutes per day, after which requests fail until the next UTC day. Requires a port of import/storage/render orchestration and verification with Cloudflare’s browser/fonts; not a Docker deployment. |
| Cloud Run                             | Scale-to-zero with a free allowance, but overages can be charged. Does not meet a strict zero-bill requirement.                                                                                                                                                      |
| Static browser-only edition           | Best architectural match for zero server-rendering cost and privacy. Files can stay on-device. Requires a substantial replacement for the Node/Chromium rendering path and cross-browser PDF verification.                                                           |
| Existing home server                  | No new hosting subscription, but uses electricity/bandwidth and needs isolated public-service infrastructure. Not literally cost-free.                                                                                                                               |

On 7 September 2026 the isolated current container used about 500 MiB after rendering Alice. This is one observation, not a peak-memory benchmark. It is already near Render's free limit.

Sources checked that day: [Render compute plans](https://render.com/docs/compute-plans), [free-service limitations](https://render.com/docs/free), [Cloud Run pricing](https://cloud.google.com/run/pricing), [Cloudflare Browser Run limits](https://developers.cloudflare.com/browser-run/limits/).

GitHub Actions can deploy; it is not the application host. A static site cannot execute this server's Chromium renderer. No provider or paid service has been provisioned.

## Required hosted-mode changes

1. **Private ownership:** issue an unguessable HttpOnly/Secure/SameSite session cookie and authorize every document, image, render, PDF, download and mutation. Random document IDs are not authorization. Disable or protect legacy routes. Verify that visitor A cannot access visitor B's files.
2. **Retention:** provisionally delete after one hour of inactivity, with a 24-hour hard lifetime. Show expiry and Delete now. Include sources, PDFs, thumbnails, processed caches, jobs and leases; sweep orphans on restart. Do not preserve ephemeral visitor files in backups.
3. **Resource limits:** bound upload bytes, expanded EPUB size, image pixels, render time, queue depth and disk use. Start with one active render, rate limits and an honest busy response.
4. **Process isolation:** restrict imported content's outbound access and audit ZIP parsing, fonts, SVGs and external resource loading. Keep rendering separated from host services.
5. **Privacy:** exclude book text, titles, filenames and asset URLs from routine analytics/logs. Describe provider logging and deletion limits accurately.
6. **Failure tests:** cover expiry, restart, interrupted uploads, deletion during rendering and cleanup errors. Test multi-visitor isolation independently of the UI.

The current shared Library must never be reused as a public anonymous Library.

## Copyright in the United States

Owning an ebook file is not the same as owning copyright. The app cannot reliably determine permission from a file, and copyrighted material is not automatically an unlawful upload.

Proposed notice: “Only upload material you are authorized to process, whether through permission, a license, public-domain status, or applicable law.” An acknowledgment records that statement; it is not legal immunity.

Before public launch, prepare terms, a privacy/retention notice and a working copyright-contact process. Obtain qualified US advice on which Section 512 provisions apply, including any designated-agent registration, repeat-infringer policy, notice and counter-notice requirements. Private processing and short retention do not automatically establish safe-harbor eligibility or eliminate liability.

Reference: [US Copyright Office Section 512 guidance](https://www.copyright.gov/512/).

## Deployment pipeline

Test changes without deployment credentials. Publish a verified immutable container digest, deploy through a protected environment with narrowly scoped credentials, run health and synthetic-conversion checks, and roll back if they fail. Keep personal Library data and visitor uploads out of CI artifacts.

Host selection and a public URL remain open. Public hosting is a separate milestone from the v2 self-hosted release.

## Recommended next experiment

Test Cloudflare’s free browser execution with a synthetic short book before committing to a hosted architecture. Measure end-to-end browser seconds, output fidelity, fonts, upload limits and whether import/image processing can be moved into the visitor browser. Close the cloud browser immediately after each job; explain the shared daily quota in the UI and stop accepting jobs when exhausted. This can be a genuinely zero-charge but limited demo, not an unlimited public converter. Do not enable paid Workers or billable storage implicitly.
