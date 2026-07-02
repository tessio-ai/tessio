# Tessio community landing site

Standalone static marketing/download page for the self-hosted community edition.
It is **not** the app — it ships no API, database, or auth, and is deployed
separately from any Tessio instance.

## Build

    pnpm --filter @tessio/landing build

Output is static files in `apps/landing/dist/`.

## Deploy

Drag-and-drop `apps/landing/dist/` onto any static host (Netlify, Cloudflare
Pages, Vercel, S3 + CDN). No server, no credentials, no CI required.

## Links

Outbound links live in `DOCS_URL` / `GITHUB_URL` constants at the top of
`src/LandingPage.tsx`. The marketing domain is TBD (pending the project rename),
so set DNS at your host once chosen.
