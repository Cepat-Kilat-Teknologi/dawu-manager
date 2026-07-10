#!/bin/sh
set -e

echo "==> Running database migrations..."
node migrate.mjs

echo "==> Starting dawu-manager..."
exec node server.js
