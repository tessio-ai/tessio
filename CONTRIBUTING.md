# Contributing to Tessio

Thanks for your interest in contributing! This guide covers the workflow, the open-core
boundary, and the Contributor License Agreement.

By participating you agree to our [Code of Conduct](CODE_OF_CONDUCT.md).

## Contributor License Agreement (CLA)

Tessio is **dual-licensed** — the open core under AGPL-3.0 and the `ee/` directory commercially
(see [LICENSING.md](LICENSING.md)). To sell commercial licenses and offer a hosted edition, we
need the right to relicense contributions. We therefore require a **CLA**, signed once per
contributor.

When you open your first pull request, the **CLA Assistant** bot comments with a link; sign by
replying as instructed. The PR can't be merged until the CLA is signed.

> A DCO sign-off (`git commit -s`) is a lighter alternative but does **not** grant relicensing
> rights, so it is insufficient here — we default to the CLA. <!-- LEGAL REVIEW -->

## Development setup

Prerequisites: **Node 22+** (`nvm use`), **pnpm 10+** (`corepack enable`), **Docker**.

```bash
pnpm install
docker compose -f docker-compose.yml up -d   # dev Postgres + Redis (+ test mail)
cp .env.example .env
pnpm --filter @tessio/db db:migrate
TESSIO_ADMIN_EMAIL=admin@acme.io TESSIO_ADMIN_PASSWORD=changeme pnpm --filter @tessio/db db:seed
pnpm dev
```

## The open-core import boundary

This is the most important rule in the repo:

- **Core code (`apps/*`, `packages/*`) must NOT import from the commercial `ee/` packages**
  (`@tessio/ee-server`, `@tessio/ee-web`). The boundary is **one-directional** — `ee/` may
  import core, never the reverse.
- It is enforced by ESLint (`pnpm lint` fails on a violation). The only place that loads `ee/`
  is the composition root, via a guarded dynamic import.
- Gate enterprise features on **entitlements** (`@tessio/entitlements` / `isFeatureEnabled`).
  Seat limits are enforced ONLY through the central seat-limit layer
  (`getSeatLimit` / `withSeatGuard`) — never hand-roll a seat check, and never gate
  a core *feature* on seats. Any write that occupies a new admin/agent seat must run
  *inside* `withSeatGuard` (it is transactional for a reason). Requesters are always
  free and unlimited.

See [LICENSING.md](LICENSING.md) for the full model.

## Before you open a PR

Run the full check suite locally — CI runs the same:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Integration tests need Postgres (pgvector): `pnpm --filter @tessio/db test:integration` and
`pnpm --filter @tessio/api test:integration` (and `@tessio/ee-server`).

Checklist:

- [ ] Commits follow **[Conventional Commits](https://www.conventionalcommits.org/)**
      (`feat:`, `fix:`, `chore:`, `docs:`, …).
- [ ] `lint`, `typecheck`, `test`, `build` all pass.
- [ ] No secrets, API keys, or real `.env` files committed.
- [ ] Core does not import from `ee/`.
- [ ] New enterprise features are gated by edition; any new path that activates an
      admin/agent goes through the seat-limit check.
- [ ] Docs / `CHANGELOG.md` updated when behavior changes.
- [ ] New source files carry the right SPDX header
      (`AGPL-3.0-only` in core; `LicenseRef-Tessio-Commercial` in `ee/`).

## Commit & branch conventions

- Branch off `main`; keep PRs focused and reviewable.
- Use Conventional Commit messages; squash-merge keeps history tidy.
- Reference issues with `Fixes #123` where applicable.

## Reporting bugs & requesting features

Use the GitHub issue templates. **Security issues must NOT be filed as issues** — follow
[SECURITY.md](SECURITY.md).

## Questions

Open a GitHub Discussion. Thanks for contributing to Tessio! 🧡
