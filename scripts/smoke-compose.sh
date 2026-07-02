#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f compose.yaml --env-file .env.smoke"

cat > .env.smoke <<EOF
TESSIO_VERSION=smoke
POSTGRES_PASSWORD=tessio
DATABASE_URL=postgres://tessio:tessio@postgres:5432/tessio
REDIS_URL=redis://redis:6379
SESSION_SECRET=smoke-session-secret-not-for-prod
TESSIO_SECRET_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
TESSIO_ADMIN_EMAIL=admin@example.com
TESSIO_ADMIN_PASSWORD=changeme-smoke
TESSIO_SITE_ADDRESS=:80
TESSIO_HTTP_PORT=8080
TESSIO_HTTPS_PORT=8443
EOF

cleanup() {
  echo "[smoke] tearing down..."
  $COMPOSE down -v --remove-orphans || true
  rm -f .env.smoke
}
trap cleanup EXIT

echo "[smoke] building images..."
$COMPOSE build

echo "[smoke] starting stack (migrate runs before api/worker)..."
$COMPOSE up -d

echo "[smoke] waiting for migrate to finish..."
# docker compose wait is unreliable once the container has already exited (Compose v5+).
# Poll until migrate is no longer running, then read its exit code via docker inspect.
migrate_cid=$($COMPOSE ps -q migrate 2>/dev/null || true)
if [ -z "$migrate_cid" ]; then
  migrate_cid=$(docker ps -aq --filter "label=com.docker.compose.project=tessio" --filter "label=com.docker.compose.service=migrate" | head -1)
fi
for i in $(seq 1 60); do
  status=$(docker inspect --format='{{.State.Status}}' "$migrate_cid" 2>/dev/null || echo "unknown")
  if [ "$status" = "exited" ] || [ "$status" = "dead" ]; then
    break
  fi
  if [ "$i" = "60" ]; then
    echo "[smoke] FAIL: migrate never exited"
    $COMPOSE logs migrate
    exit 1
  fi
  sleep 2
done
migrate_code=$(docker inspect --format='{{.State.ExitCode}}' "$migrate_cid" 2>/dev/null || echo "1")
if [ "$migrate_code" != "0" ]; then
  echo "[smoke] FAIL: migrate exited $migrate_code"
  $COMPOSE logs migrate
  exit 1
fi
echo "[smoke] migrate OK"

echo "[smoke] waiting for api to become healthy..."
for i in $(seq 1 30); do
  if $COMPOSE exec -T api node -e "fetch('http://localhost:3000/health').then(r=>r.json()).then(j=>process.exit(j.status==='ok'?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    echo "[smoke] api health OK"
    break
  fi
  if [ "$i" = "30" ]; then
    echo "[smoke] FAIL: api never became healthy"
    $COMPOSE logs api
    exit 1
  fi
  sleep 2
done

echo "[smoke] checking web SPA via the edge..."
if curl -fsS http://localhost:8080/ | grep -qi "<!doctype html"; then
  echo "[smoke] web index OK"
else
  echo "[smoke] FAIL: edge did not serve the SPA"
  $COMPOSE logs web
  exit 1
fi

echo "[smoke] checking /api proxy via the edge (expect a JSON 401, not a 502)..."
code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/api/v1/tickets || true)
if [ "$code" = "401" ] || [ "$code" = "403" ]; then
  echo "[smoke] /api proxy OK (HTTP $code — auth required, proxy reached api)"
else
  echo "[smoke] FAIL: /api proxy returned HTTP $code (expected 401/403)"
  $COMPOSE logs web api
  exit 1
fi

echo "[smoke] PASS"
