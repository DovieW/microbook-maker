# Self-hosting and upgrades

MicroBook Maker listens on **7777**. Express serves the interface and API; a child worker owns Chromium. The container does not launch Nginx or PM2.

## Published release (after the tag is available)

```sh
docker compose -f docker-compose.release.yml up -d
```

This file pins `2.0.0-rc.1` and binds to localhost. Until that image is published, use the source-build instructions below. For a network installation, configure an authenticated proxy or trusted-network port mapping. The container currently supports linux/amd64.

Set `MICROBOOK_IMAGE=dovieuu/microbook-maker@sha256:...` to pin an immutable digest. Use the same compose project name and volume names when switching files. The release candidate is not a stable upgrade recommendation until the checks below are complete.

## New installation

```sh
docker compose -f docker-compose.production.yml up --build -d
```

The compose file retains the existing `mbm-generated` and `mbm-uploads` volume names and the persistent container paths:

- `/app/be/generated`
- `/app/be/uploads`

Use the same compose project name as an existing installation to retain its named volumes. For TrueNAS bind mounts, retain the exact host paths already configured. Environment overrides `GENERATED_DIR` and `UPLOADS_DIR` are available for other layouts. Port 7777 remains unchanged.

## Release candidate on separate storage

Build the runtime image after verification:

```sh
npm run mb -- check
npm run mb -- test --no-build --suite full
docker build --target runtime -t microbook-maker:release-candidate .
```

Record the currently installed image digest and take a snapshot/backup of **both** persistent volumes. Copy the data into separate candidate directories; do not point the candidate at live production volumes.

```sh
docker run -d --name microbook-candidate --init \
  -p 127.0.0.1:7780:7777 \
  -v /absolute/path/candidate/uploads:/app/be/uploads \
  -v /absolute/path/candidate/generated:/app/be/generated \
  microbook-maker:release-candidate
```

Check [localhost:7780](http://localhost:7780). Open a historical item, inspect its metadata, and verify that its PDF download matches the original bytes. Import an EPUB, Apply different settings, reload with an unapplied draft, Print/Download, cancel/retry, and reopen a kept version inline from History. Confirm `/api/health` reports `rendererReady: true`.

The compatibility reader adds versioned document/render records while retaining old flat files and download URLs. It never replaces a historical export with a freshly rendered approximation. A malformed historical record or missing original file is reported in server logs for repair; existing flat download URLs still work while their files remain present.

## Switching and rollback

After the candidate and a physical duplex/folding check are accepted, stop the old application and start the verified image with the original mounts and port. Keep the prior digest and pre-upgrade volume snapshot.

For rollback, stop the new container, restore the recorded old image and both volume snapshots, and restart with the original configuration. Do not rely on a mutable `latest` tag as the rollback identifier. Never use `docker compose down -v` during an upgrade.

CI runs the quick suite for changes. Release tags run the full corpus/browser suite before an image is published. A successful CI run does not switch a running TrueNAS installation.

## Health and logs

```sh
docker logs microbook-candidate
curl http://127.0.0.1:7780/api/health
```

Interrupted jobs remain in the Library and can be retried. Queued jobs resume after restart. Failed Apply keeps the last successful preview. Kept versions are retained until unkept or their book is removed. The latest completed Basic/Rich PDFs remain available automatically.

## Print check

Print at **100% / actual size**, Letter portrait, with printer scaling disabled. Use the duplex edge setting used by your existing Classic workflow. Compare a two-sided sheet against the original cell sequence before folding/cutting. The automated suite checks Letter geometry, 16 cells per side, side transitions, complete text, and Classic pixels. It cannot verify your printer's feed direction, unprintable margins, ink legibility at 4.5 pt, or the physical folding result.

### Phone testing over Tailscale

The desktop candidate at `127.0.0.1:7780` can also be reached within the tailnet
at `http://100.79.27.109:36243/` (or
`http://dovie-desktop-linux.barn-chameleon.ts.net:36243/`).
The Galaxy S25 Ultra must have Tailscale connected. Its own IP is not the server URL.

The persistent TCP proxy is configured with:

```sh
tailscale serve --bg --tcp=36243 tcp://127.0.0.1:7780
tailscale serve status
```

This leaves the IdeaPad localhost SSH forward and the container's loopback binding
unchanged. It exposes the candidate to permitted tailnet devices, not the public
internet. To remove only this proxy, run `tailscale serve --tcp=36243 off`.
