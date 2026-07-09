# Licensing

> **Note.** These documents (this file, [`LICENSE`](LICENSE), [`ee/LICENSE`](ee/LICENSE),
> and [`docs/legal/CLA.md`](docs/legal/CLA.md)) are complete and built on established
> templates — the GNU AGPL-3.0, a standard commercial software license, and the Apache
> Individual CLA v2.0. Before a public release, have counsel confirm the
> jurisdiction-specific details (governing law and venue in `ee/LICENSE`) and whether a
> separate Corporate CLA is needed.

Tessio is **open core**. The product is split into two parts that live in the same
repository under two different licenses.

## The split

| Part                        | Location                     | License                       | What it is                                                                                                                                                                                                                                       |
| --------------------------- | ---------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Open core**               | everything **outside** `ee/` | **AGPL-3.0-only** (`LICENSE`) | The full self-hostable ITSM product: tickets, knowledge base, forms/intake, dashboards & reports, workflows, basic SLA, email, scheduled triggers, devices/CMDB, the Tess AI features, and all of the core platform. Free, with **no seat cap**. |
| **Enterprise Edition (EE)** | the **`ee/`** directory      | **Commercial** (`ee/LICENSE`) | Paid add-on features for larger organizations (e.g. SSO/OIDC, the audit-log viewer, and — reserved for future work — SCIM, custom roles/advanced RBAC, advanced SLA).                                                                            |

A **Community / self-host build does not include `ee/`** and never requires it. The
Community edition ships the complete core ITSM feature set with **unlimited agents** — we
never gate on seat count, only on _features_.

## The import boundary (one-directional, enforced)

This is the standard GitLab / PostHog / Sentry open-core convention:

- **Core code (`apps/*`, `packages/*`) must NOT import from `ee/`.**
- **`ee/` may import from core (`@tessio/*`).**

The boundary is enforced mechanically by an ESLint rule, so CI fails if core ever reaches
into `ee/`. The only place that loads `ee/` is the application _composition root_
(`apps/api`), and it does so through a guarded dynamic import that is simply absent in a
Community build.

## How an edition is selected

The active edition is chosen at runtime by the `TESSIO_EDITION` environment variable:

- `community` (default) — core only; all EE feature flags off.
- `enterprise` — self-hosted paid build; EE features enabled per the license.
- `cloud` — the future hosted build; EE features enabled and AI usage metered.

Entitlements are reported by the central `@tessio/entitlements` package and enforced by a
`requireFeature(...)` guard on the server and an `/api/v1/me/entitlements` response on the
client.

### Signed license keys

`TESSIO_EDITION` alone no longer unlocks a paid edition. At boot the API composition root
(`apps/api/src/index.ts`) resolves the *effective* edition through
`apps/api/src/license/` before anything reads the env var:

- A **paid** edition (`enterprise`/`cloud`) requires a matching `TESSIO_LICENSE_KEY` — a
  compact, Ed25519-signed token (`tessio-lic.v1.<payload>.<sig>`) the maintainers mint
  offline with `apps/api/src/license/sign.ts`. Verification (`verify.ts`) uses only the
  baked-in **public** key, checks the signature and expiry, and trusts the license's own
  edition over the requested one.
- Any missing, malformed, forged, or expired key **fails closed to `community`** — the ee/
  loader and every `requireFeature` guard then see `community` and stay dark.
- **Community** needs no key and is never downgraded.

The private signing key is never in this repo; the baked-in public key in `verify.ts` is a
placeholder to swap for the real one before shipping paid builds. Because Tessio is open
source, a self-hoster with the `ee/` code could patch the check out — the signed key moves
the bar from "set an env var" to "modify and rebuild the licensed source", which is the
line that matters both technically and under `ee/LICENSE`. This is licensing, not DRM; seat
counts are still never checked anywhere.

## AI and data

Self-host uses **bring-your-own LLM key** (configured in-app or via env). By default **no
data leaves your infrastructure** and Tessio does **not** phone home — there is no
telemetry, analytics, or usage reporting in the open core. The hosted ("cloud") build
attaches usage metering at a dedicated seam; that seam is a no-op in Community/self-host.

## Contributing & the CLA

Because Tessio is dual-licensed (AGPL core + a commercial license we offer to customers),
contributors must grant us the rights to relicense their contributions. We therefore
require a **Contributor License Agreement (CLA)** — see [`docs/legal/CLA.md`](docs/legal/CLA.md)
— collected automatically by the CLA Assistant GitHub Action on each pull request.

> A Developer Certificate of Origin (DCO) sign-off is a lighter-weight alternative, but it
> does **not** grant relicensing rights, so it is insufficient for dual-licensing. We
> default to the CLA.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the workflow.

## Questions

For commercial licensing, an exception to the AGPL, or anything unclear here, contact the
maintainers (see [`SECURITY.md`](SECURITY.md) and the repository contacts).
