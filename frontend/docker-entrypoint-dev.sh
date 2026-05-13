#!/bin/sh
set -e
cd /app
if [ ! -x node_modules/.bin/vite ]; then
  echo "Installing npm dependencies..."
  npm ci
fi
exec "$@"
