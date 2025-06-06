#!/bin/bash
set -euo pipefail

echo "Starting MicroBook Maker in development mode with hot reload..."

# Make this script executable (in case it wasn't already)
chmod +x /app/entrypoint.dev.sh

fc-cache -fv

# Install frontend dependencies
cd /app/fe
echo -e "\n\e[34mInstalling Frontend dependencies...\e[0m"
npm install

# Install backend dependencies
cd /app/be
echo -e "\n\e[34mInstalling Backend dependencies...\e[0m"
npm install

# Start backend with PM2 in watch mode for hot reload
echo -e "\n\e[34mStarting backend with hot reload...\e[0m"
pm2 start /app/be/index.js --name mbm --watch --ignore-watch="node_modules generated uploads output.html *.pdf"

# Start frontend dev server with hot reload
echo -e "\n\e[34mStarting frontend dev server with hot reload...\e[0m"
cd /app/fe
pm2 start "npm run dev" --name frontend

# Start nginx with development config (proxies to Vite dev server)
echo -e "\n\e[34mStarting nginx with development config...\e[0m"
# Copy nginx config from mount to nginx config location
cp /app/nginx.dev.conf /etc/nginx/nginx.conf
nginx

# Show logs from all services
pm2 logs
