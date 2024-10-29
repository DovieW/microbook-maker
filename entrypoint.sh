#!/bin/bash
set -euo pipefail

fc-cache -fv

cp /app/nginx.conf /etc/nginx/nginx.conf
nginx

cd /app
git fetch
git reset --hard @{upstream}

cd /app/fe
npm install
npm run build

cd /app/be
npm install

pm2 start /app/be/index.js --name mbm

pm2 logs mbm
