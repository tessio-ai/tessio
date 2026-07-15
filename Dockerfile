# syntax=docker/dockerfile:1

# ---------- base: install workspace deps ----------
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app
# Copy only manifests first so dependency install is cached across source edits.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/
COPY apps/runner/package.json ./apps/runner/
COPY packages/ai/package.json ./packages/ai/
COPY packages/db/package.json ./packages/db/
COPY packages/forms/package.json ./packages/forms/
# @tessio/license is bundled into apps/api by tsup, which must resolve its
# workspace dep (@tessio/entitlements) from within it — so it has to be installed.
COPY packages/license/package.json ./packages/license/
# @tessio/entitlements depends on @tessio/shared (billable-role list); without
# its manifest here pnpm never links that dep and every app build fails to
# resolve "@tessio/shared" from within entitlements.
COPY packages/entitlements/package.json ./packages/entitlements/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/
RUN pnpm install --frozen-lockfile

# ---------- build: compile the shipped apps ----------
# Two workspaces are deployed separately and are NOT part of any product image,
# so exclude them from the build (their devDeps aren't installed here either):
#   - apps/landing            — the standalone marketing site
#   - ee/license-server       — vendor-hosted licensing infrastructure (commercial)
FROM base AS build
# The web app bundles Monaco (~5MB of JS); minifying it under QEMU arm64 emulation
# blows V8's default old-space limit (exit 137 / "heap out of memory"). Give it room.
ENV NODE_OPTIONS=--max-old-space-size=6144
COPY . .
RUN pnpm exec turbo run build --filter='!@tessio/landing' --filter='!@tessio/ee-license-server'

# ---------- pruned production deploys (one per app) ----------
FROM build AS deploy-api
RUN pnpm deploy --legacy --filter=@tessio/api --prod /out

FROM build AS deploy-worker
RUN pnpm deploy --legacy --filter=@tessio/worker --prod /out

FROM build AS deploy-runner
RUN pnpm deploy --legacy --filter=@tessio/runner --prod /out

# ---------- runtime: api ----------
FROM node:22-alpine AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deploy-api --chown=node:node /out/dist ./dist
COPY --from=deploy-api --chown=node:node /out/node_modules ./node_modules
COPY --from=deploy-api --chown=node:node /out/package.json ./package.json
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]

# ---------- runtime: worker ----------
FROM node:22-alpine AS worker
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deploy-worker --chown=node:node /out/dist ./dist
COPY --from=deploy-worker --chown=node:node /out/node_modules ./node_modules
COPY --from=deploy-worker --chown=node:node /out/package.json ./package.json
USER node
CMD ["node", "dist/index.js"]

# ---------- runtime: runner ----------
FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deploy-runner --chown=node:node /out/dist ./dist
COPY --from=deploy-runner --chown=node:node /out/node_modules ./node_modules
COPY --from=deploy-runner --chown=node:node /out/package.json ./package.json
USER node
EXPOSE 3100
CMD ["node", "dist/index.js"]

# ---------- runtime: web / edge (Caddy serves the SPA + proxies /api) ----------
FROM caddy:2-alpine AS web
COPY --from=build /app/apps/web/dist /srv
COPY apps/web/Caddyfile /etc/caddy/Caddyfile

# ---------- db deploy WITH dev deps (drizzle-kit + tsx for migrate/seed) ----------
FROM build AS deploy-db
RUN pnpm deploy --legacy --filter=@tessio/db /out

# ---------- runtime: migrate (one-shot) ----------
FROM node:22-alpine AS migrate
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deploy-db /out ./
COPY scripts/migrate-entrypoint.sh /migrate-entrypoint.sh
RUN chmod +x /migrate-entrypoint.sh
ENTRYPOINT ["/migrate-entrypoint.sh"]

# ---------- runtime: all-in-one (s6-overlay supervises migrate+api+worker+runner+caddy) ----------
FROM node:22-alpine AS aio
ARG TARGETARCH
ARG S6_OVERLAY_VERSION=3.2.3.0
ENV NODE_ENV=production \
    TESSIO_SITE_ADDRESS=:80 \
    TESSIO_STORAGE_DIR=/data/storage \
    PORT=3000 \
    HOST=0.0.0.0 \
    RUNNER_PORT=3100 \
    S6_BEHAVIOUR_IF_STAGE2_FAILS=2 \
    S6_CMD_WAIT_FOR_SERVICES_MAXTIME=0
RUN apk add --no-cache caddy xz ca-certificates
# Install s6-overlay v3 (arch tarball chosen from TARGETARCH).
RUN set -eux; \
    case "$TARGETARCH" in \
      amd64) S6_ARCH=x86_64 ;; \
      arm64) S6_ARCH=aarch64 ;; \
      *) echo "unsupported arch: $TARGETARCH" >&2; exit 1 ;; \
    esac; \
    cd /tmp; \
    wget -qO s6-noarch.tar.xz "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz"; \
    wget -qO s6-arch.tar.xz   "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-${S6_ARCH}.tar.xz"; \
    tar -C / -Jxpf s6-noarch.tar.xz; \
    tar -C / -Jxpf s6-arch.tar.xz; \
    rm -f s6-noarch.tar.xz s6-arch.tar.xz
# App payloads from the shared deploy stages.
COPY --from=deploy-api    /out /app/api
COPY --from=deploy-worker /out /app/worker
COPY --from=deploy-runner /out /app/runner
COPY --from=deploy-db     /out /app/migrate
COPY --from=build /app/apps/web/dist /srv
# s6 service tree + caddy config + migrate script.
COPY deploy/aio/s6-rc.d /etc/s6-overlay/s6-rc.d
COPY deploy/aio/Caddyfile /etc/caddy/Caddyfile
COPY deploy/aio/tessio-migrate /usr/local/bin/tessio-migrate
RUN chmod +x /usr/local/bin/tessio-migrate \
    && find /etc/s6-overlay/s6-rc.d -name run -exec chmod +x {} + \
    && mkdir -p /data/storage && chown -R node:node /data
EXPOSE 80
ENTRYPOINT ["/init"]
