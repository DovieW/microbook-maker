# Cloudflare beta verification

7 September 2026. The complete hosted app is deployed at **https://microbook.dovieweinstock.workers.dev**. See [architecture, privacy, limits, and deployment](PUBLIC_HOSTING.md).

Browser-side EPUB import, image processing/cache, shared Basic/Rich layout engines, temporary History, PDF viewing/search, and print/download now use the same workspace. Live synthetic EPUB verification passed Rich and Basic rendering, full source coverage, no overflow, mode caching, reload, separate-browser isolation, and deletion. This is a beta; it does not imply that every EPUB or browser engine has been verified. Physical Brother-printer output remains a manual check.

## Verified on the account

- The authenticated `cf` 0.9.1 CLI deployed a Worker using Build Output API v0. No Wrangler CLI invocation, paid subscription, bucket, database, or Container was needed.
- The account subscription list contains no Workers/browser paid plan. Deployment tooling checks this and refuses to continue if that changes or the check fails.
- Worker: `microbook-renderer-preview`, health at `https://microbook-renderer-preview.dovieweinstock.workers.dev/api/health`.
- Render requests require a temporary machine credential. It is not embedded in JavaScript or committed. Anonymous requests receive 401. This is a development gate, not the final visitor authentication design.
- The Worker streams back the generated PDF and stores no source, HTML, or PDF in application storage. Cloudflare's own processing/logging remains subject to its policies.
- Requests are bounded to 24 MiB of prepared HTML, including embedded assets. This is a memory/request safety limit, not a visitor usage quota. It has not yet been validated as an appropriate final book-size limit.
- Cloudflare's built-in Free limits apply. Capacity errors are surfaced without automatic retries, upgrade, or custom per-user quota accounting.

## Rendering evidence

The generated publisher EPUB fixture includes chapter/part headings, two-cell SVG images, source mapping, and 300 text passages. No private Library book was uploaded.

| Check                           | Local pinned engine  | Cloudflare browser | Deployed Worker PDF      |
| ------------------------------- | -------------------- | ------------------ | ------------------------ |
| Printed sides                   | 2                    | 2                  | 2                        |
| Physical cells                  | 30                   | 30                 | Prepared layout retained |
| Source characters accounted for | 50,830 / 50,830      | 50,830 / 50,830    | Same PDF text as local   |
| Overflow                        | 0                    | 0                  | Same layout as local     |
| PDF page size                   | 612 × 792 pt         | 612 × 792 pt       | 612 × 792 pt             |
| Extracted PDF characters        | 50,574               | 50,574             | 50,574                   |
| Text color                      | Black                | Black              | Black                    |
| Font families                   | Embedded Arimo/Tinos | Same               | Same                     |

Maximum character-position difference from the local PDF: **0.000103 pt**. Source coverage and extracted PDF character counts measure different things (source normalization versus generated/printed text); comparisons use like-for-like counts.

First direct remote test: 5.6 seconds including connection. Deployed Worker test: 4.5 seconds for 7.25 MB of prepared HTML with embedded fonts. These are small-fixture observations, not performance promises for long books or mobile devices.

The local browser reported Chromium 148; Cloudflare reported Chromium 128. The synthetic layout passed despite that difference. Full Basic golden checks and long Rich book tests on Cloudflare remain necessary.

Local evidence (gitignored): `.artifacts/cloudflare-proof/` contains the two PDFs, Worker PDF, layout reports, screenshots, and PDF comparison JSON. Its `secrets.json` is a local credential file and must never be uploaded as a CI artifact.


The earlier gated renderer URL is only a development proof, not the visitor application. No private Library content is used in public test fixtures.

## Final rollout checks

The local hosted workflow also passes cancellation, opening another workspace during a render, removal of PDF access after deletion, and a narrow-screen empty state. The final live recheck successfully rendered Rich with bookmarks, then received Cloudflare's Free-capacity 429 during Basic. Earlier live Rich and Basic conversions passed. This capacity response is an expected provider limit, not a paid fallback; the Worker does not automatically retry it.

The personal packaged build passed 56 unit tests and 30 frozen Basic tests. The quick rendering checks and 33/35 browser checks passed on the first run; the two image checks timed out while other builds were running, then both passed in isolation (25 s and 18 s). TrueNAS was upgraded only after testing a copied Library. All 86 historical PDFs and 238 original files were preserved, including eight PDFs whose original source is unavailable. A rollback image and consistent volume backup were retained.

GitHub deployment automation is included. It requires the repository's Cloudflare API-token secret; local CLI OAuth authentication is not copied into GitHub.
