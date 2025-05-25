#!/bin/bash
set -euo pipefail

fc-cache -fv

cd /app/fe
echo -e "\n\e[34mnpm install Frontend...\e[0m"
npm install
echo -e "\n\e[34mBuilding Frontend...\e[0m"
npm run build

cd /app/be
echo -e "\n\e[34mnpm install Backend...\e[0m"
npm install

echo -e "\n\e[34mStarting nginx...\e[0m"
cp /app/nginx.conf /etc/nginx/nginx.conf
nginx

pm2 start /app/be/index.js --name mbm

pm2 logs mbm
