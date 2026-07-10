#!/bin/sh
# Tessio one-line installer — https://github.com/tessio-ai/tessio
#
#   curl -fsSL https://raw.githubusercontent.com/tessio-ai/tessio/main/install.sh | sh
#
# Fetches the all-in-one Compose file, generates every required secret for you,
# writes a .env, and starts the stack — no repo clone, no hand-editing.
#
# Datastores:
#   • Bundled (default) — runs PostgreSQL (pgvector) + Redis as containers.
#   • Managed/external  — point at your own with --external (or DATABASE_URL /
#                         REDIS_URL in the environment).
#
# Flags / environment overrides:
#   --bundled | --external      datastore mode (env: TESSIO_DB_MODE=bundled|external)
#   --dir PATH                   install directory        (env: TESSIO_DIR, default ./tessio)
#   --admin-email EMAIL          first-admin login        (env: TESSIO_ADMIN_EMAIL)
#   --site-url URL               public URL for email links (env: TESSIO_SITE_URL)
#   --http-port PORT             host port to publish     (env: TESSIO_HTTP_PORT, default 80)
#   --ref REF                    git ref to fetch files from (env: TESSIO_REF, default main)
#   -h, --help
# External mode reads DATABASE_URL and REDIS_URL from the environment (or prompts).
set -eu

REPO_RAW="https://raw.githubusercontent.com/tessio-ai/tessio"
REF="${TESSIO_REF:-main}"

DIR="${TESSIO_DIR:-tessio}"
MODE="${TESSIO_DB_MODE:-}"
ADMIN_EMAIL="${TESSIO_ADMIN_EMAIL:-}"
SITE_URL="${TESSIO_SITE_URL:-http://localhost}"
HTTP_PORT="${TESSIO_HTTP_PORT:-80}"
DB_URL="${DATABASE_URL:-}"
RD_URL="${REDIS_URL:-}"

c_cyan='\033[36m'; c_yellow='\033[33m'; c_red='\033[31m'; c_green='\033[32m'; c_off='\033[0m'
log()  { printf "${c_cyan}[tessio]${c_off} %s\n" "$1" >&2; }
warn() { printf "${c_yellow}[tessio]${c_off} %s\n" "$1" >&2; }
ok()   { printf "${c_green}[tessio]${c_off} %s\n" "$1" >&2; }
die()  { printf "${c_red}[tessio] error:${c_off} %s\n" "$1" >&2; exit 1; }

usage() { sed -n '2,26p' "$0" 2>/dev/null | sed 's/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --bundled)        MODE=bundled ;;
    --external)       MODE=external ;;
    --dir)            DIR="${2:?}"; shift ;;
    --dir=*)          DIR="${1#*=}" ;;
    --admin-email)    ADMIN_EMAIL="${2:?}"; shift ;;
    --admin-email=*)  ADMIN_EMAIL="${1#*=}" ;;
    --site-url)       SITE_URL="${2:?}"; shift ;;
    --site-url=*)     SITE_URL="${1#*=}" ;;
    --http-port)      HTTP_PORT="${2:?}"; shift ;;
    --http-port=*)    HTTP_PORT="${1#*=}" ;;
    --ref)            REF="${2:?}"; shift ;;
    --ref=*)          REF="${1#*=}" ;;
    -h|--help)        usage; exit 0 ;;
    *)                die "unknown option: $1 (try --help)" ;;
  esac
  shift
done

# ── Preflight ────────────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || die "Docker is required. Install it: https://docs.docker.com/get-docker/"
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
else
  die "Docker Compose v2 is required (this script uses profiles + optional dependencies). Update Docker."
fi
command -v curl >/dev/null 2>&1 || die "curl is required."

# Prefer openssl for secrets; fall back to /dev/urandom.
rand_b64() { # $1 = bytes
  if command -v openssl >/dev/null 2>&1; then openssl rand -base64 "$1"; else head -c "$1" /dev/urandom | base64; fi | tr -d '\n'
}
rand_hex() { # $1 = bytes
  if command -v openssl >/dev/null 2>&1; then openssl rand -hex "$1"; else head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; fi
}

# ── Datastore mode ───────────────────────────────────────────────────────────
if [ -z "$MODE" ]; then
  if [ -n "$DB_URL" ] && [ -n "$RD_URL" ]; then
    MODE=external
  elif [ -r /dev/tty ]; then
    printf "Datastores:\n  1) Bundled PostgreSQL + Redis containers  (default)\n  2) My own managed DATABASE_URL / REDIS_URL\n" >&2
    printf "Choose 1 or 2 [1]: " >&2
    read ans </dev/tty || ans=1
    case "$ans" in 2) MODE=external ;; *) MODE=bundled ;; esac
  else
    MODE=bundled
  fi
fi

if [ "$MODE" = external ]; then
  if [ -z "$DB_URL" ]; then
    [ -r /dev/tty ] || die "external mode needs DATABASE_URL (Postgres must have the pgvector extension)."
    printf "DATABASE_URL (postgres://user:pass@host:5432/db, needs pgvector): " >&2; read DB_URL </dev/tty
  fi
  if [ -z "$RD_URL" ]; then
    [ -r /dev/tty ] || die "external mode needs REDIS_URL."
    printf "REDIS_URL (redis://[:pass@]host:6379): " >&2; read RD_URL </dev/tty
  fi
  [ -n "$DB_URL" ] || die "DATABASE_URL is empty."
  [ -n "$RD_URL" ] || die "REDIS_URL is empty."
fi

[ -n "$ADMIN_EMAIL" ] || ADMIN_EMAIL="admin@example.com"

# ── Fetch compose + write .env ───────────────────────────────────────────────
mkdir -p "$DIR"
cd "$DIR"
log "Installing into $(pwd)"

log "Fetching compose.aio.yaml ($REF)…"
curl -fsSL "$REPO_RAW/$REF/compose.aio.yaml" -o compose.aio.yaml || die "could not download compose.aio.yaml"

ADMIN_PW=""
if [ -f .env ]; then
  warn ".env already exists — keeping it (delete it to regenerate secrets)."
else
  SESSION_SECRET="$(rand_b64 48)"
  SECRET_KEY="$(rand_b64 32)"
  RUNNER_TOKEN="$(rand_hex 32)"
  ADMIN_PW="$(rand_b64 18)"

  {
    echo "# Generated by install.sh — keep this file secret and back it up."
    echo "TESSIO_VERSION=latest"
    echo "TESSIO_EDITION=community"
    echo
    if [ "$MODE" = bundled ]; then
      PG_PW="$(rand_hex 24)"; RD_PW="$(rand_hex 24)"
      echo "COMPOSE_PROFILES=bundled"
      echo "POSTGRES_PASSWORD=$PG_PW"
      echo "REDIS_PASSWORD=$RD_PW"
      echo "DATABASE_URL=postgres://tessio:$PG_PW@postgres:5432/tessio"
      echo "REDIS_URL=redis://:$RD_PW@redis:6379"
    else
      echo "# Managed datastores (bundled Postgres/Redis containers stay off)."
      echo "DATABASE_URL=$DB_URL"
      echo "REDIS_URL=$RD_URL"
    fi
    echo
    echo "SESSION_SECRET=$SESSION_SECRET"
    echo "TESSIO_SECRET_KEY=$SECRET_KEY"
    echo "RUNNER_TOKEN=$RUNNER_TOKEN"
    echo
    echo "TESSIO_ADMIN_EMAIL=$ADMIN_EMAIL"
    echo "TESSIO_ADMIN_PASSWORD=$ADMIN_PW"
    echo
    echo "TESSIO_SITE_ADDRESS=:80"
    echo "TESSIO_HTTP_PORT=$HTTP_PORT"
    echo "TESSIO_SITE_URL=$SITE_URL"
  } > .env
  chmod 600 .env 2>/dev/null || true
  ok "Wrote .env with freshly generated secrets."
fi

# ── Launch ───────────────────────────────────────────────────────────────────
log "Starting Tessio ($MODE datastores)…"
$COMPOSE -f compose.aio.yaml up -d

echo >&2
ok "Tessio is starting up."
printf "  URL:      http://localhost:%s\n" "$HTTP_PORT" >&2
if [ -n "$ADMIN_PW" ]; then
  printf "  Sign in:  %s\n  Password: %s\n" "$ADMIN_EMAIL" "$ADMIN_PW" >&2
  warn "Save that admin password now — it is only shown here."
else
  printf "  Sign in:  see TESSIO_ADMIN_* in %s/.env\n" "$(pwd)" >&2
fi
printf "  Logs:     (cd %s && %s -f compose.aio.yaml logs -f)\n" "$(pwd)" "$COMPOSE" >&2
printf "  Turn on Tess AI in Settings → Tess AI, or set TESSIO_AI_* in .env.\n" >&2
