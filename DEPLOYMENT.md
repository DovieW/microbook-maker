# MicroBook Maker Deployment and Debugging Guide

> This is the "production-ish" operations guide for MicroBook Maker.
> It documents the current deployment model in this repo plus the important deployment lessons captured in `chat-depoloyed-truenas.md`.
> This app is self-hosted/personal-project infrastructure, not a hardened enterprise platform.

## If you only care about TrueNAS SCALE

This is the main real-world deployment target for this project.
If you ignore everything else in this file, these are the settings that matter most on the NAS.

### The TrueNAS deployment recipe that matters

| Setting | Value |
| --- | --- |
| Image | `dovieuu/microbook-maker:latest` |
| Deployment shape | single container/custom app |
| Observed NAS shell hostname | `truenas` |
| Observed LAN/service hostname used in prior debugging | `truenas-scale` |
| Published port | `7777` |
| App URL used in prior debugging | `http://truenas-scale:7777/` |
| Health URL | `http://127.0.0.1:7777/health` |
| Persistent path 1 | `/app/be/generated` |
| Persistent path 2 | `/app/be/uploads` |
| Environment | `NODE_ENV=production` |
| Pull behavior | pull fresh on update/redeploy; prefer **Always** if the UI offers it |
| Health toggle | keep the built-in healthcheck enabled |

### Which hostname to use when debugging

The previous deployment session showed **two different hostnames** in use:

- `truenas` — this appeared in the NAS shell prompt as the machine hostname
- `truenas-scale` — this was used successfully as the LAN/browser/API hostname

So the practical rule is:

- **from the NAS shell itself**, use `127.0.0.1:7777` or `localhost:7777`
- **from another machine on your network**, use `http://truenas-scale:7777/` if that name still resolves on your LAN

Examples:

- NAS-local health check: `http://127.0.0.1:7777/health`
- NAS-local backend check: `http://127.0.0.1:7777/api/capabilities`
- LAN app URL seen in the prior session: `http://truenas-scale:7777/`

If `truenas-scale` no longer resolves on your network, then the shell hostname `truenas` is still a strong clue about the box name, but you may need to use its current LAN DNS name or IP address instead.

### What to put into the TrueNAS app config

- **Image**: `dovieuu/microbook-maker:latest`
- **Container port**: `7777`
- **Published port**: `7777`
- **Environment variable**: `NODE_ENV=production`
- **Storage mounts**:
  - mount something persistent to `/app/be/generated`
  - mount something persistent to `/app/be/uploads`
- **Health/readiness**:
  - if TrueNAS supports the image's built-in healthcheck, use it
  - if you define a manual HTTP probe, use internal port `7777` and path `/health`
- **Do not** point the probe at an external reverse proxy URL, HTTPS endpoint, or random host-mapped port

### Example of the NAS-style bind mounts used in practice

The prior deployment discussion showed a NAS setup using host binds like this:

```yaml
services:
  microbook-maker:
    image: dovieuu/microbook-maker:latest
    ports:
      - '7777:7777'
    environment:
      - NODE_ENV=production
    volumes:
      - /mnt/containers/data/microbook-maker-data/generated:/app/be/generated
      - /mnt/containers/data/microbook-maker-data/uploads:/app/be/uploads
    restart: unless-stopped
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "fetch('http://127.0.0.1:7777/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
        ]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

Adjust the host-side bind paths however you want, but the container-side paths should stay the same.

### The two biggest TrueNAS gotchas

1. `latest` is only a tag, not proof that the NAS pulled the newest image digest.
2. A container can be visibly running while TrueNAS still says **Deploying** if health/readiness never goes green.
3. There may be a difference between the **NAS hostname** (`truenas`) and the **LAN hostname you browse to** (`truenas-scale`).

## Quick summary

- The production-style deployment is a **single Docker container**.
- That container runs:
  - **Nginx** on port `7777`
  - the **Node/Express backend** on port `3001` (internal to the container)
  - **Chromium** for Puppeteer-based PDF generation
  - **PM2** to keep the backend process running
- The frontend is built with Vite into `fe/build` and served as static files by Nginx.
- Nginx proxies `/api/*` to the backend on `localhost:3001`.
- Generated files and uploaded source files live on the filesystem and should be **persisted across redeploys**.
- The currently configured production image is `dovieuu/microbook-maker:latest`.
- The current TrueNAS-friendly health path is `GET /health` on internal port `7777`.

## Deployment architecture

```mermaid
flowchart LR
    Browser -->|HTTP| Nginx[nginx :7777]
    Nginx -->|serves static frontend| Frontend[fe/build]
    Nginx -->|/api/*| Backend[Express backend :3001]
    Nginx -->|/history/*| Generated[/app/be/generated]
    Nginx -->|/uploads/*| Uploads[/app/be/uploads]
    Backend --> Chromium[Chromium via Puppeteer]
    Backend --> Generated
    Backend --> Uploads
```

## Files that define deployment

| File | Purpose |
| --- | --- |
| `Dockerfile.production` | Multi-stage production image build. Builds frontend, installs backend deps, installs nginx/chromium/fonts/pm2, copies app files, exposes `7777`, and defines the image-native healthcheck. |
| `entrypoint.production.sh` | Container startup script. Runs `fc-cache`, starts Nginx, then starts the backend via PM2. |
| `nginx.production.conf` | Production web server config. Serves `fe/build`, proxies `/api/` to `localhost:3001`, exposes `/history/`, `/uploads/`, and `/health`. |
| `docker-compose.production.yml` | Example production-ish deployment using the published image and persistent volumes. |
| `.github/workflows/docker-build.yml` | GitHub Actions workflow that builds and pushes the Docker image on `v*` tags or manual dispatch. |
| `Dockerfile.dev` | Development container image with hot reload support. |
| `entrypoint.dev.sh` | Dev startup script: installs deps, starts backend and Vite via PM2, runs Nginx as reverse proxy. |
| `nginx.dev.conf` | Dev Nginx config that proxies `/` to Vite on `3000` and `/api` to backend on `3001`. |
| `docker-compose.dev.yml` | Development container workflow exposing `7777`, `3000`, and `3001`, with the repo mounted into `/app`. |

## Runtime details

### Production container behavior

The production image is built in three stages:

1. **Frontend builder**
   - runs `npm ci` in `fe/`
   - runs `npm run build`
   - outputs static assets into `fe/build`

2. **Backend builder**
   - runs `npm ci --only=production` in `be/`
   - prepares production Node dependencies

3. **Final runtime image**
   - based on `node:24-slim`
   - installs `nginx`, `chromium`, font packages, and `pm2`
   - copies the frontend build and backend app into `/app`
   - uses `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`
   - exposes port `7777`
   - includes a built-in Docker `HEALTHCHECK`

### Startup order in production

`entrypoint.production.sh` does this:

1. refreshes font cache with `fc-cache -fv`
2. starts **Nginx**
3. starts the backend with PM2

The backend itself listens on `3001`. Nginx is the only port that should normally be published externally.

## Ports, routes, and what they mean

| Port / Route | Served by | Purpose |
| --- | --- | --- |
| `7777` | Nginx | Main HTTP entry point for the app |
| `3001` | Express backend | Internal API service inside the container |
| `/` | Nginx | Static frontend app from `fe/build` |
| `/api/*` | Nginx → backend | API endpoints |
| `/history/*` | Nginx alias | Generated PDFs, screenshots, HTML artifacts |
| `/uploads/*` | Nginx alias | Original uploaded source files |
| `/health` | Nginx | Shallow health endpoint used for readiness/health checks |

### Important healthcheck note

`/health` is currently served by **Nginx**, not the Node backend.

That means:

- a `200 OK` from `/health` proves the container is reachable and Nginx is up
- it does **not** prove PDF generation works
- it does **not** fully prove the backend is healthy

For a deeper runtime check, also test:

- `GET /api/capabilities` → confirms the backend is reachable
- `GET /api/jobs` → confirms the backend can read job state
- an actual upload/generation flow → confirms Chromium/Puppeteer and file I/O are working

## Persistent data and why it matters

Production persistence currently lives in these paths:

- `/app/be/generated`
- `/app/be/uploads`

In `docker-compose.production.yml`, those are backed by named volumes:

- `mbm-generated`
- `mbm-uploads`

If you redeploy **without** preserving those paths, you lose:

- generated PDFs
- job metadata
- progress files
- uploaded source files
- preview screenshots
- generated HTML debug artifacts

### Files you will find in `/app/be/generated`

| Pattern | Meaning |
| --- | --- |
| `<id>.pdf` | Final generated PDF |
| `METADATA_<id>.json` | Job metadata, layout info, and screenshot metadata |
| `PROGRESS_<id>.json` | Structured progress record |
| `IN_PROGRESS_<id>.txt` | Legacy progress text file |
| `output_<id>.html` | HTML used to render the PDF; very useful for layout debugging |
| `screenshot_<id>_page1.png` | Preview image captured from the first page |

### Files you will find in `/app/be/uploads`

Uploaded `.txt`, `.md`, and `.markdown` source files are stored here and may be referenced from job metadata.

## Environment variables

These are the runtime variables that matter today:

| Variable | Default / Example | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `production` / `development` | Standard runtime mode flag |
| `PUPPETEER_EXECUTABLE_PATH` | `/usr/bin/chromium` in production image | Points Puppeteer at the installed Chromium binary |
| `MICROBOOK_RENDERER_BASE_URL` | `http://127.0.0.1:3001` by default in backend | Base URL used by the PDF renderer when it loads `page.html` |
| `JOB_QUEUE_CONCURRENCY` | `1` | Controls how many PDF jobs can run at once |

### Development note about `VITE_API_URL`

`docker-compose.dev.yml` sets `VITE_API_URL=http://localhost:3001`, but the current frontend service layer uses same-origin paths like `/api/upload` and `/api/jobs`.

So, in practice, the frontend depends on:

- the Vite dev proxy in `fe/vite.config.ts` during development
- the Nginx reverse proxy in production

Do not assume changing `VITE_API_URL` alone will rewire the app.

## How to run the app locally

### Development mode

Use the development compose file when you want hot reload:

```bash
docker compose -f docker-compose.dev.yml up --build
```

Exposed ports in dev:

- `7777` → Nginx reverse proxy
- `3000` → Vite dev server
- `3001` → backend API

Useful dev URLs:

- `http://localhost:7777/`
- `http://localhost:3000/`
- `http://localhost:3001/api/capabilities`

### Production-style local test

You can test the production image locally:

```bash
docker build -f Dockerfile.production -t dovieuu/microbook-maker:latest .
docker run --rm -p 7777:7777 dovieuu/microbook-maker:latest
```

Then check:

```bash
curl -i http://127.0.0.1:7777/health
curl -i http://127.0.0.1:7777/api/capabilities
```

### Compose-based production-style local run

```bash
docker compose -f docker-compose.production.yml up -d
```

This uses the published image and named volumes.

## TrueNAS SCALE deployment and upgrade runbook

This is the practical NAS-focused section: how it is deployed there, how it broke there before, and how to confirm the box is really using the image you think it is.

### What actually went wrong on TrueNAS before

The prior deployment/debug session found two separate readiness problems:

1. **Image-based TrueNAS deploys did not inherit the compose healthcheck**
   - the image originally had no built-in Docker `HEALTHCHECK`
   - so TrueNAS could see a running container but no image-native healthy signal

2. **The old NAS/compose probe used `wget`**
   - but the production image did not install `wget`
   - so the readiness probe could fail forever even while the app itself was up

The current fix is that the image now carries a built-in Docker `HEALTHCHECK` that uses Node `fetch()` against `http://127.0.0.1:7777/health`.

### Recommended TrueNAS settings

- Publish only port **`7777`** externally.
- Persist these container paths:
  - `/app/be/generated`
  - `/app/be/uploads`
- If you use `:latest`, set the pull policy to **Always** when possible.
- If TrueNAS has a **Disable Builtin Healthcheck** toggle, leave it **off**.
- If you configure an explicit readiness/liveness probe, use:
  - protocol: **HTTP**
  - internal port: **7777**
  - path: **`/health`**
- Do **not** point health checks at:
  - host-mapped random ports
  - external reverse-proxy URLs
  - public HTTPS URLs

### Hostnames observed in the real deployment session

From the prior conversation, the deployment was accessed in two ways:

- NAS shell prompt: `truenas_admin@truenas[~]`
- HTTP/API access from another machine: `http://truenas-scale:7777/`

That means I do have host information from the prior session; I just had not made it explicit enough in this doc.

For debugging:

- use `127.0.0.1:7777` from commands run **on the NAS itself**
- use `truenas-scale:7777` from **another machine on the network**, assuming that hostname still resolves

### How to tell what image the NAS is really running

On TrueNAS, `latest` can look current while the running container still came from an older digest.
The running digest is the thing that matters.

On many TrueNAS shells, you will want to run these with `sudo`.

Find the running container first:

```bash
sudo docker ps --filter name=microbook-maker --format 'table {{.Names}}\t{{.Image}}\t{{.ID}}'
```

Then inspect the exact image the container was created from:

```bash
CID=$(sudo docker ps --filter name=microbook-maker --format '{{.ID}}' | head -n1)
sudo docker inspect "$CID" --format 'Name={{.Name}} ImageRef={{.Config.Image}} ImageID={{.Image}}'
```

Now inspect the image object itself to get the repo digest:

```bash
IMGID=$(sudo docker inspect -f '{{.Image}}' "$CID")
sudo docker image inspect "$IMGID" --format 'RepoTags={{json .RepoTags}} RepoDigests={{json .RepoDigests}} Created={{.Created}}'
```

The `RepoDigests` field is the truth serum here. That tells you the immutable image digest actually backing the running container.

### How to compare the running digest with the current registry image

Pull the registry tag explicitly:

```bash
sudo docker pull dovieuu/microbook-maker:latest
sudo docker image inspect dovieuu/microbook-maker:latest --format 'ImageID={{.Id}} RepoDigests={{json .RepoDigests}}'
```

If the freshly pulled digest is different from the running container's digest, the NAS is still running an older image.

### How to force a real TrueNAS update

If your NAS deployment is effectively compose-backed, do:

```bash
sudo docker compose -f /path/to/docker-compose.production.yml pull
sudo docker compose -f /path/to/docker-compose.production.yml up -d --force-recreate
```

If you want the update command to always check for a newer image first:

```bash
sudo docker compose -f /path/to/docker-compose.production.yml up -d --pull always --force-recreate
```

If you are using the TrueNAS custom app UI instead of a shell-based compose flow, the equivalent action is:

- force a fresh image pull
- redeploy/update the app
- make sure the app is recreated, not merely restarted

### If the app stays in “Deploying”

The most likely causes are:

1. TrueNAS did not pull the fresh image
2. the built-in healthcheck is disabled or overridden incorrectly
3. your manual probe settings point to the wrong port/path
4. the container is healthy at the Docker level, but the probe is checking the wrong endpoint

Quick checks:

- confirm the container is running
- confirm `/health` returns `200`
- confirm the app pulled the image you expected
- confirm the probe is checking **internal port `7777`**, not some external mapped port
- confirm the running digest matches the digest of the image you just pulled

### Why “running” and “healthy” are not the same thing on the NAS

In this app, the previous NAS failure mode was:

- container process was up
- Nginx was serving traffic
- but TrueNAS still treated deployment as incomplete because readiness/health was not green

So when the NAS says **Deploying**, do not assume the app failed to start. It can also mean the readiness path is wrong or missing.

## Building and publishing images

### Manual build and push

The conversation log recorded manual image builds and pushes like this:

```bash
docker build -f Dockerfile.production -t dovieuu/microbook-maker:latest .
docker push dovieuu/microbook-maker:latest
```

### GitHub Actions build and push

`.github/workflows/docker-build.yml` currently:

- runs on tags matching `v*`
- also supports manual `workflow_dispatch`
- logs in to Docker Hub
- builds `linux/amd64` and `linux/arm64`
- pushes semver tags plus `latest`
- only proceeds if the tag is on `master`

### Recommendation for safer upgrades

The repo currently points production compose at `dovieuu/microbook-maker:latest`.
That is convenient, but not ideal for repeatable deploys.

Prefer one of these:

- a versioned tag such as `dovieuu/microbook-maker:v0.x.y`
- a dated tag such as `dovieuu/microbook-maker:2026-05-31`
- a pinned digest in deployment config

That makes it much easier to answer “what is actually running?” without divination.

## Upgrade checklist

When changing the deployment or shipping a new version, use this checklist.

### Before building

- confirm frontend changes are committed and production-ready
- confirm backend changes are committed and production-ready
- confirm `Dockerfile.production`, `entrypoint.production.sh`, and `nginx.production.conf` still agree on ports and paths
- if you changed health behavior, keep the Dockerfile `HEALTHCHECK` and any compose/TrueNAS probe settings in sync

### Before pushing

Run at least these checks locally:

```bash
cd fe && npm test
cd ../be && npm test
cd .. && docker build -f Dockerfile.production -t dovieuu/microbook-maker:latest .
```

Smoke-test the image:

```bash
docker run --rm -p 7777:7777 dovieuu/microbook-maker:latest
curl -i http://127.0.0.1:7777/health
curl -i http://127.0.0.1:7777/api/capabilities
```

### After deploying

- confirm the platform reports the app as healthy/running
- open the UI in a browser
- generate a small sample document
- confirm a PDF appears in `/history`
- confirm job history is still present if persistent storage was reused

## Useful API endpoints for debugging

| Endpoint | Why it matters |
| --- | --- |
| `GET /health` | Fast shallow check that Nginx is up |
| `GET /api/capabilities` | Backend sanity check |
| `GET /api/jobs` | Current job list and metadata |
| `GET /api/progress/:id` | Progress for one job |
| `GET /api/debug/running-jobs` | Shows running jobs plus queue snapshot |
| `GET /api/jobs/:id/screenshot` | Redirects to preview screenshot if present |
| `GET /api/download?id=<id>` | Download or generation status |
| `DELETE /api/jobs/:id` | Deletes a job and associated artifacts |
| `GET /history/<file>` | Direct access to generated artifacts |
| `GET /uploads/<file>` | Direct access to original uploads |

## Useful shell commands

### Container/process checks

```bash
docker ps --format 'table {{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}\t{{.Names}}'
docker inspect <container-id> --format '{{json .State.Health}}'
docker logs --tail 200 <container-id>
```

### HTTP checks

```bash
curl -i http://127.0.0.1:7777/health
curl -i http://127.0.0.1:7777/api/capabilities
curl -i http://127.0.0.1:7777/api/jobs
```

### Inspect generated artifacts inside the container

```bash
docker exec -it <container-id> sh
ls -lah /app/be/generated
ls -lah /app/be/uploads
```

## Debugging playbook

### Symptom: TrueNAS shows “Deploying” forever

Check:

- is the image fresh, or is TrueNAS still using an old cached `latest`?
- does `/health` return `200`?
- is the built-in Docker healthcheck enabled?
- if there is a manual probe, is it targeting internal port `7777` and `/health`?

Likely cause:

- readiness/health configuration issue, not necessarily app failure

### Symptom: UI loads, but generation controls fail or never update

Check:

- `GET /api/capabilities`
- backend logs
- `GET /api/debug/running-jobs`

Likely cause:

- backend is unavailable, proxying is broken, or the backend crashed

### Symptom: App is “healthy” but generation is broken

Check:

- `GET /api/capabilities`
- backend logs
- whether Chromium can launch
- whether files are being written under `/app/be/generated`

Likely cause:

- `/health` only proves Nginx is alive; backend or Puppeteer can still be failing

### Symptom: PDF generation fails with browser-related errors

Check:

- `PUPPETEER_EXECUTABLE_PATH`
- that `/usr/bin/chromium` exists inside the container
- backend logs for Chromium launch errors

Relevant code:

- `be/utils/browserUtils.js`
- `be/index.js`

### Symptom: Uploads fail

Check:

- allowed formats are `.txt`, `.md`, `.markdown`
- upload size limit is `10MB`
- Nginx `client_max_body_size` is `10M`

Likely cause:

- invalid extension or oversized input

### Symptom: Job history disappears after redeploy

Check:

- whether `/app/be/generated` and `/app/be/uploads` were actually persisted
- whether volumes/mounts were recreated or lost

Likely cause:

- storage was ephemeral or remounted incorrectly

### Symptom: Frontend changes are not visible after deploy

Check:

- was the production image rebuilt?
- was the new image pushed?
- did the host/TrueNAS actually pull the new tag?

Remember:

- production serves the built files from `fe/build`
- a development Vite server is **not** involved in production

## Known operational gotchas

- The deployment is simple, but it is **not** a single-process container; it relies on both Nginx and the backend.
- A green `/health` response does **not** guarantee the backend or Puppeteer are working.
- The app currently stores operational state on disk, not in a database.
- Using `latest` makes it easier to forget what version is really deployed.
- The dev setup can get confusing because there are three ports (`7777`, `3000`, `3001`) and both Nginx and Vite are in the picture.
- In dev, stale Vite processes can make the UI look wrong even when the source code is correct; restarting the frontend dev server can resolve that.

## Suggested future improvements

If you want this deployment to become more robust over time, the highest-value improvements would be:

1. add a backend-specific health endpoint such as `/api/health`
2. make the Docker healthcheck verify backend reachability, not just Nginx
3. stop deploying `latest` and use versioned tags or digests
4. optionally split Nginx and backend into separate containers if you want cleaner process boundaries
5. add a short runbook for restoring/purging the generated and uploads volumes

## Bottom line

Today, MicroBook Maker is deployed as a **single self-contained Docker image** with Nginx in front, Express/Chromium behind it, and filesystem-backed job persistence.

If you remember just five things, remember these:

- expose **`7777`**
- persist **`/app/be/generated`** and **`/app/be/uploads`**
- use **`/health`** for platform readiness
- use **`/api/capabilities`** when you need to confirm the backend is actually alive
- rebuild/push/pull the image whenever frontend or backend code changes
