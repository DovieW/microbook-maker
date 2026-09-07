# Public hosting proposal

Status: the [gated Cloudflare renderer experiment](CLOUDFLARE_PROGRESS.md) passes its first PDF fidelity check. The public application and visitor upload handling are not implemented. The personal/self-hosted application remains private.

## Requirements

Zero hosting spend; private uploads with automatic deletion; GitHub Actions deployment; a US operator. Initial access is by links shared with testers. No custom per-user usage quota or account system is requested. Cloudflare’s own Free-plan limits must fail cleanly without enabling paid services.

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

GitHub Actions can deploy; it is not the application host. A static site cannot execute this server's Chromium renderer. A gated Free Cloudflare renderer Worker has been deployed; no paid service or storage was provisioned.

## Initial server-storage requirements

These requirements apply if visitor files are stored server-side. The first renderer experiment supports a simpler approach: temporary on-device storage and stateless Cloudflare PDF creation. The [current progress document](CLOUDFLARE_PROGRESS.md) records that direction and its remaining verification work.

1. **Private ownership:** issue an unguessable HttpOnly/Secure/SameSite session cookie and authorize every document, image, render, PDF, download and mutation. Random document IDs are not authorization. Disable or protect legacy routes. Verify that visitor A cannot access visitor B's files.
2. **Retention:** provisionally delete after one hour of inactivity, with a 24-hour hard lifetime. Show expiry and Delete now. Include sources, PDFs, thumbnails, processed caches, jobs and leases; sweep orphans on restart. Do not preserve ephemeral visitor files in backups.
3. **Resource limits:** bound upload bytes, expanded EPUB size, image pixels, render time, queue depth and disk use. Start with one active render and an honest busy response. This protects the process; it is not a per-user usage allowance.
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

Cloudflare is the selected hosted target. A usable public application URL remains open. Public hosting is a separate milestone from the v2 self-hosted release.

## Renderer experiment

The synthetic free-browser check and deployed Worker PDF check passed; see the [measured results](CLOUDFLARE_PROGRESS.md). Import/image processing in the visitor browser, long books, Basic compatibility, and the final visitor workflow still need implementation and testing. Handle provider limit responses clearly without a separate usage quota. Do not enable paid Workers or billable storage implicitly.
