#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f compose.aio.yaml --env-file .env.aio-smoke"

cat > .env.aio-smoke <<EOF
TESSIO_VERSION=smoke
COMPOSE_PROFILES=bundled
POSTGRES_PASSWORD=tessio
SESSION_SECRET=smoke-session-secret-not-for-prod
TESSIO_SECRET_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
TESSIO_ADMIN_EMAIL=admin@example.com
TESSIO_ADMIN_PASSWORD=changeme-smoke
TESSIO_SITE_ADDRESS=:80
TESSIO_HTTP_PORT=8090
EOF

cleanup() {
  echo "[aio-smoke] tearing down..."
  $COMPOSE down -v --remove-orphans || true
  rm -f .env.aio-smoke
}
trap cleanup EXIT

echo "[aio-smoke] building + starting..."
$COMPOSE build
$COMPOSE up -d

echo "[aio-smoke] waiting for the app to serve (migrations run on start)..."
ok=""
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8090/ || true)
  if [ "$code" = "200" ]; then ok=1; echo "[aio-smoke] web served (HTTP 200)"; break; fi
  sleep 3
done
if [ -z "$ok" ]; then echo "[aio-smoke] FAIL: web never served"; $COMPOSE logs app; exit 1; fi

echo "[aio-smoke] checking SPA index..."
spa_html=$(curl -fsS http://localhost:8090/ 2>&1)
echo "$spa_html" | grep -qi "<!doctype html" && echo "[aio-smoke] SPA OK" || { echo "[aio-smoke] FAIL: no SPA"; $COMPOSE logs app 2>&1; exit 1; }

echo "[aio-smoke] checking /api proxy (expect 401)..."
code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8090/api/v1/tickets || true)
if [ "$code" = "401" ] || [ "$code" = "403" ]; then
  echo "[aio-smoke] /api proxy OK (HTTP $code)"
else
  echo "[aio-smoke] FAIL: /api proxy returned $code (expected 401/403)"; $COMPOSE logs app; exit 1
fi

echo "[aio-smoke] confirming migrate ran in app logs..."
app_logs=$($COMPOSE logs app 2>&1)
echo "$app_logs" | grep -q "\[aio\] migrate done." && echo "[aio-smoke] migrate ran" || { echo "[aio-smoke] FAIL: no migrate completion in logs"; echo "$app_logs"; exit 1; }

echo "[aio-smoke] PASS"
