#!/bin/sh
set -e

echo "Starting MicroBook Maker in production mode..."

fc-cache -fv

echo "Starting nginx..."
nginx

echo "Starting backend..."
cd /app/be
pm2 start index.js --name backend --no-daemon

pm2 logs backend
