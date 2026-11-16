# Preserve the exact Chromium 148 / Arimo engine for the x86 Classic golden PDFs.
ARG ENGINE_IMAGE=dovieuu/microbook-maker@sha256:ca89556eff3b41ae67bfd2e1a3f1cf8ad10afe8c7f1d0d3085cd21d673e9c389
ARG ARM_ENGINE_IMAGE=node:24-trixie-slim@sha256:af02d57b57719b9657a45199a79264a9437940cd55b3c7b3fc99615654f124a0
ARG TARGETARCH

FROM ${ENGINE_IMAGE} AS engine-amd64
USER root
WORKDIR /
# Clear the legacy app from the inherited engine image.
RUN rm -rf /app /etc/nginx /root/.cache/puppeteer && npm uninstall -g pm2

FROM ${ARM_ENGINE_IMAGE} AS engine-arm64
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates chromium fontconfig fonts-croscore fonts-dejavu-core fonts-dejavu-mono \
    && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

FROM engine-${TARGETARCH} AS engine

FROM engine AS build
WORKDIR /workspace
ENV PUPPETEER_SKIP_DOWNLOAD=true
# Cache the verification tools separately from application edits.
USER root
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils python3 python3-pil && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/renderer/package.json packages/renderer/package.json
RUN npm ci --ignore-scripts
COPY apps apps
COPY packages packages
COPY tools tools
COPY resources resources
COPY tests tests
COPY tsconfig.json vitest.config.ts playwright.config.ts ./
RUN npm run build

FROM build AS verify
USER root
ENV MICROBOOK_ROOT=/workspace
ENTRYPOINT ["node", "tools/run.mjs"]
CMD ["doctor"]

FROM engine AS runtime
USER root
WORKDIR /app
RUN mkdir -p /app/be/uploads /app/be/generated
ENV NODE_ENV=production PUPPETEER_SKIP_DOWNLOAD=true MICROBOOK_ROOT=/app UPLOADS_DIR=/app/be/uploads GENERATED_DIR=/app/be/generated PORT=7777
COPY --from=build /workspace/package*.json ./
COPY --from=build /workspace/apps/server/package.json apps/server/package.json
COPY --from=build /workspace/apps/web/package.json apps/web/package.json
COPY --from=build /workspace/packages packages
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /workspace/resources resources
COPY --from=build /workspace/dist dist
COPY --from=build /workspace/apps/web/dist apps/web/dist
# pdfinfo is also needed when reading historical exports.
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils && rm -rf /var/lib/apt/lists/*
EXPOSE 7777
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:7777/api/health').then(r=>r.json()).then(h=>process.exit(h.rendererReady?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["node", "dist/server.js"]
