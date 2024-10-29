#!/bin/bash
set -euo pipefail

fc-cache -fv

cd /app/fe
npm install
npm run build

cd /app/be
npm install

cp /app/nginx.conf /etc/nginx/nginx.conf
nginx

pm2 start /app/be/index.js --name mbm

pm2 logs mbm
