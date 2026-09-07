# Cloudflare beta and personal hosting

The hosted beta is **https://microbook.dovieweinstock.workers.dev**. The personal Docker/TrueNAS edition and the hosted edition use the same repository and workspace UI.

| | Personal Docker / TrueNAS | Cloudflare beta |
|---|---|---|
| Library | Persistent server volumes | This browser's IndexedDB |
| Import and image processing | Personal server | Visitor's device |
| Layout | Pinned server Chromium | Visitor's browser with bundled fonts |
| PDF creation | Personal server | Stateless Cloudflare Browser Run |
| Retention | Latest layouts and kept versions | 24 hours from import, including versions |
| Accounts | Shared private Library | None; browser storage is isolated |

## Temporary books and privacy

EPUB, TXT, and Markdown sources are imported on the visitor's device. To create a PDF, the application sends the prepared book content, including its images and embedded fonts, to Cloudflare over HTTPS. The Worker returns the PDF without storing it in a server Library, bucket, or database. Application request logging is disabled. This is not a promise that the hosting provider has no operational logs.

Books, PDFs, thumbnails, and image caches expire 24 hours after import. Deletion runs while the application is open or on the next visit; a closed browser cannot run our cleanup timer. History also offers immediate removal. Clearing site data removes everything. Private/incognito windows may discard it earlier. Kept versions do not extend expiration. Download anything you want to keep.

Only process material you are authorized to use through permission, a license, public-domain status, or applicable law. The app cannot determine copyright ownership. Private processing does not itself establish permission or legal immunity. For a broader public launch, establish a working copyright contact and obtain qualified US advice about applicable obligations; see the [US Copyright Office's Section 512 guidance](https://www.copyright.gov/512/).

## Zero-cost deployment

Use a **Free Cloudflare account configuration**. The deployment helper checks account subscriptions and refuses an account with a Workers or Browser Run subscription. It does not create paid plans, R2, D1, Durable Objects, or Containers. Do not upgrade the account to a paid plan if a strict zero-bill policy is required.

Cloudflare's own [Free Browser Run limits](https://developers.cloudflare.com/browser-run/limits/) still apply. Exhausted capacity produces a clear failure while preserving the current PDF. There is no application usage quota, account system, paid fallback, or automatic render retry. Public links are accessible to anyone who has them; they are not access control.

The app limits imports to 50 MB, expanded archives to 250 MB, individual archive entries to 32 MB, and prepared print HTML to 24 MiB. Very large or image-heavy books can exceed device memory or provider limits. Chrome desktop and Android are the initial beta targets; other browser engines need more printing/fidelity validation.

```sh
npm ci --ignore-scripts
npm install --global cf@0.9.1
cf auth login
export CLOUDFLARE_ACCOUNT_ID=your_account_id
node tools/deploy-cloudflare.mjs --app          # build and dry run
node tools/deploy-cloudflare.mjs --app --deploy
```

This uses the new `cf` CLI and Build Output API v0. It does not invoke the Wrangler CLI. No runtime API key is delivered to visitors. PDF requests accept same-origin browser requests and disable scripts and outbound resources in the prepared document. Origin checking prevents cross-site browser submissions; it is not authentication against scripted clients.

`.github/workflows/cloudflare.yml` deploys after a successful Verify run on master, or manually. Configure repository variable `CLOUDFLARE_ACCOUNT_ID` and narrowly scoped repository secret `CLOUDFLARE_API_TOKEN`. Never upload a local CLI OAuth profile or `.artifacts/cloudflare-proof/secrets.json` to CI.

For local frontend integration testing, run `node tools/build-cloudflare.mjs --app`, start a disposable Chromium exposing DevTools on localhost:39222, then `node tools/hosted-dev.mjs` and `node tools/verify-hosted.mjs`. The local harness is development-only and does not use Cloudflare capacity. Set `HOSTED_URL` to the hosted URL for the real transport test.
