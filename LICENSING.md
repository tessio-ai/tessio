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
| **Open core**               | everything **outside** `ee/` | **AGPL-3.0-only** (`LICENSE`) | The full self-hostable ITSM product: tickets, knowledge base, forms/intake, dashboards & reports, workflows, basic SLA, email, scheduled triggers, devices/CMDB, the Tess AI features, and all of the core platform. Free for up to **5 admin/agent seats**. |
| **Enterprise Edition (EE)** | the **`ee/`** directory      | **Commercial** (`ee/LICENSE`) | Paid add-on features for larger organizations (e.g. SSO/OIDC, the audit-log viewer, and — reserved for future work — SCIM, custom roles/advanced RBAC, advanced SLA).                                                                            |

A **Community / self-host build does not include `ee/`** and never requires it. The
Community edition ships the complete core ITSM feature set.

## Pricing: 5 free seats, then per-user/month

Tessio is priced on **billable seats** — active users with the `admin` or `agent` role.
**Requesters (end users) are always free and unlimited**, in every edition.

- **Free tier.** Every edition, including Community, includes **5 billable seats free**. No
  license key needed, nothing phones home.
- **Paid.** Beyond 5 seats, a subscription is billed **per user per month**. The purchased
  seat total (Stripe subscription quantity) is carried inside the signed license key; the
  monthly price itself is configured in Stripe (a graduated-tier price: the first 5 units at
  $0, each further unit at the per-user price), so pricing changes never require a code
  change. A paid license also enables the `ee/` feature set for its edition.

Enforcement is central and server-side: the seat limit is computed by
`@tessio/entitlements` (`getSeatLimit`) from the **verified** license, and every API path
that can activate an admin/agent (create, bulk import, role promotion, re-activation)
checks it and answers `402 Payment Required` when the limit is reached. Core *features*
are never gated on seats.

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

`TESSIO_EDITION` alone does **not** unlock a paid edition — and no env var unlocks extra
seats. At boot the API composition root (`apps/api/src/index.ts`) resolves the *effective*
edition **and the licensed seat count** from a cryptographically-signed token before
anything reads the env vars. Any missing, malformed, forged, or expired token **fails
closed to `community`** (5 free seats) — the ee/ loader and every `requireFeature` guard
then see `community` and stay dark, and the seat limit collapses to the free allotment.
The token's `seats` claim is the only way to raise the limit (a hand-set
`TESSIO_LICENSED_SEATS` is overwritten at boot, after verification). **Community** needs
no token and is never downgraded.

All the licensing primitives live in one shared package, `@tessio/license`, so the vendor's
signer and each instance's verifier agree on a single token format:
`tessio-lic.v1.<payload>.<sig>` (Ed25519; verified with only the **public** key, which is
baked into `verify.ts`).

There are two ways a customer supplies entitlement — a **hosted** path (default) and an
**offline** path (air-gap):

**Hosted (recommended).** The customer sets one stable, opaque `TESSIO_LICENSE_KEY` and
never changes it again. On boot and then once a day, the instance checks in to the vendor
license server (`ee/license-server`, `TESSIO_LICENSE_SERVER_URL`) and exchanges that opaque
key for a short-TTL (default 14-day) **signed entitlement token**, which it caches to disk.
Stripe is the source of truth: subscription webhooks update the server's store, so a renewal
is automatic (the customer's key is unchanged; the server just keeps answering) and a lapse
takes effect on the next check-in. If the license server is briefly unreachable, the cached
token keeps the instance running until its TTL lapses — the **TTL is the offline grace
window**. This is the *only* thing an instance ever sends to the vendor, and it sends a
token, never usage data (see "AI and data" below).

**Offline (air-gap).** For customers who can't or won't reach the license server, the
maintainers mint a long-lived signed token with the CLI
(`pnpm --filter @tessio/license exec tsx src/cli.ts issue …`) and hand it over directly. If
`TESSIO_LICENSE_KEY` is itself a signed token, the instance uses it as-is and **never phones
home**. Renewal here does mean re-issuing a token.

The private signing key is never in this repo; it lives only in the license server's secret
store (a vault). The baked-in public key in `verify.ts` is a placeholder to swap for the real
one before shipping paid builds. Because Tessio is open source, a determined self-hoster
could patch the seat check out of the AGPL core and rebuild — the signed token moves the bar
from "set an env var" to "modify and rebuild the source", which is the line that matters:
honest customers get a smooth per-seat subscription, and bypassing it requires deliberately
shipping a modified build (for `ee/` code, that is also a breach of `ee/LICENSE`). This is
licensing, not DRM — the same trade-off Metabase, GitLab, and every open-core vendor makes.

## AI and data

Self-host uses **bring-your-own LLM key** (configured in-app or via env). By default **no
data leaves your infrastructure**: there is no telemetry, analytics, or usage reporting in
the open core. The **one** exception is the hosted-license check-in described above — when a
customer configures a paid edition with `TESSIO_LICENSE_SERVER_URL`, the instance sends its
license token (and nothing else — no usage, no customer data) to validate the subscription.
Community installs never do this, and air-gapped paid installs using an offline token never
do either. The hosted ("cloud") build additionally attaches usage metering at a dedicated
seam; that seam is a no-op in Community/self-host.

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
