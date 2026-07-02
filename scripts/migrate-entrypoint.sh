#!/bin/sh
set -e

echo "[migrate] applying database migrations..."
./node_modules/.bin/drizzle-kit migrate

if [ -n "$TESSIO_ADMIN_EMAIL" ] && [ -n "$TESSIO_ADMIN_PASSWORD" ]; then
  echo "[migrate] seeding initial admin + org defaults..."
  ./node_modules/.bin/tsx src/seed-cli.ts
else
  echo "[migrate] TESSIO_ADMIN_EMAIL/PASSWORD not set — skipping seed."
fi

echo "[migrate] done."
