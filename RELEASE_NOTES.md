# MicroBook 2.5.1

The self-hosted Docker image now supports Linux ARM64, including Oracle Ampere. The same `dovieuu/microbook-maker:2.5.1` tag works on ARM64 and x86-64. Docker chooses the right image for your server.

ARM64 uses Debian Chromium. Line breaks may differ slightly from x86-64, which keeps the existing pinned engine. Existing PDFs and saved data stay as they are.

For a new install or an upgrade, see [deployment instructions](DEPLOYMENT.md).
