# Cloudflare renderer milestone

7 September 2026. **The gated renderer works; the hosted MicroBook application is not ready for visitors.** TrueNAS remains the full personal application. Both live in this repository; no separate product fork is needed.

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

## Architecture supported by the experiment

Keep the personal Node/Chromium server unchanged. For the hosted mode:

1. Import EPUBs and process/cache images in the visitor's browser, reusing the core interpretation rules through an I/O adapter.
2. Keep the temporary Library and previews on that device, with explicit expiry/deletion behavior. Do not expose the personal server or use a public shared Library.
3. Lay out complete sheets with the existing compositor and pinned fonts, then send a self-contained prepared print document to the Cloudflare PDF transport.
4. Return the PDF to the same workspace. Preserve source maps, search, image overlays, Apply/cancel, and per-mode state. The snapshot and map must come from the same layout.

The cloud transport disables document JavaScript and outbound resources; images and fonts must be embedded. Browser-side font/image loading must finish before snapshotting. Different client engines need fidelity checks before enabling them. If the browser layout does not match reliably, move composition into Cloudflare's browser instead of silently accepting different wrapping.

## Remaining before sharing an application link

- Browser import adapter, bounded archive/font handling, and image processing parity. Avoid duplicating heading/content logic.
- Temporary browser storage and deletion UI; document exactly what survives closing a tab and what expires on return.
- Frontend API/output adapter, Basic pipeline, and full-sheet source map/overlay verification.
- Visitor-safe request handling to replace the development credential. Never ship that credential to the frontend.
- Cancellation/disconnect behavior and larger payload/long-book/mobile validation.
- Free-only GitHub Actions deployment with a narrowly scoped CI token; this has not been configured.
- Final public privacy/usage copy, then a usable app URL. The renderer health URL is not the application.

## Repeatable commands

Build only: `node tools/build-cloudflare.mjs`.

Dry run with a verified free account:

```sh
export CLOUDFLARE_ACCOUNT_ID=your_account_id
node tools/deploy-cloudflare.mjs
```

To deploy, add `--deploy`. For the initial gate, set `MICROBOOK_CLOUDFLARE_SECRETS_FILE` to a private JSON file containing `RENDER_KEY`. Never place a live secret in a checked-in configuration file. Without a configured key, all render requests remain denied.

Direct browser comparison uses only the generated fixture:

```sh
node --import tsx tools/cloudflare-proof.mjs ACCOUNT_ID PINNED_CROSCORE_FONT_DIRECTORY
```

Use `CHROMIUM_PATH` for a local engine executable or `LOCAL_BROWSER_URL` for a disposable engine's DevTools URL. The script closes both browser sessions. It supports the default `cf` OAuth profile or `CLOUDFLARE_API_TOKEN`; do not point it at a personal interactive browser.

Run `npx vitest run tests/cloudflare.test.ts` for the transport's local tests.

Official references: [Cloudflare PDF Quick Action and binding](https://developers.cloudflare.com/browser-run/quick-actions/pdf-endpoint/), [remote Puppeteer](https://developers.cloudflare.com/browser-run/cdp/puppeteer/), [Free limits](https://developers.cloudflare.com/browser-run/limits/), [pricing](https://developers.cloudflare.com/browser-run/pricing/).
