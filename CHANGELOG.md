# Changelog

All notable changes to Tessio are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) from `1.0.0` onward.

## [Unreleased]

_Nothing yet._

## [0.1.0] - 2026-07-15

First tagged release — the baseline for versioned deploys (`ghcr.io/tessio-ai/*:v0.1.0`)
and controlled upgrades.

### Added

- **Password reset.** Self-serve "Forgot password?" on the sign-in screen: an emailed
  single-use link (SHA-256-hashed token, 1-hour expiry, each new request invalidates the
  previous link) sets a new password and revokes all existing sessions. Admins can also
  reset any member's password from Settings → Members (`POST /api/v1/users/:id/reset-password`),
  which generates a one-time-shown password — works even before SMTP is configured.
- **Security headers on the API itself.** Every API response now carries
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, a strict `Referrer-Policy`,
  and a deny-all `Content-Security-Policy` — defense in depth behind Caddy, which already
  sets the full set (CSP/HSTS) at the front door. Attachment download filenames are
  sanitized against header injection.

### Changed

- **New pricing model: free for 5 admin/agent seats, then per-user/month.** Every edition
  (including Community) now includes 5 free billable seats — active users with the `admin` or
  `agent` role. Requesters remain free and unlimited. A paid per-seat license (verified via the
  signed license key) raises the limit to the purchased seat count; the Stripe subscription
  quantity is the seat total. The API returns `402 Payment Required`
  (`code: seat_limit_reached`) when creating, importing, promoting, or re-activating an
  admin/agent would exceed the limit, and `GET /api/v1/me/entitlements` now reports
  `seatLimit`/`seatsUsed` (replacing the always-null `maxAgents`). This replaces the previous
  "unlimited agents in every edition" policy.

- **Relicensed the open core to AGPL-3.0-only** (previously Elastic License 2.0). The `ee/`
  directory is now under a separate commercial license. See `LICENSING.md`.

### Added

- **Open-core structure.** Commercial features live in `ee/` (`@tessio/ee-server`,
  `@tessio/ee-web`) under a one-directional import boundary enforced by ESLint — core never
  imports `ee/`.
- **Entitlements layer** (`@tessio/entitlements`): edition (`TESSIO_EDITION`, default
  `community`), per-feature flags, and the billable-seat limit. New
  `GET /api/v1/me/entitlements` endpoint.
- **SSO / OIDC** and the **audit-log viewer** are now Enterprise features (extracted to `ee/`);
  the Community edition runs without them, and the audit *writer* stays in core so events are
  still recorded.
- **Provider-agnostic LLM access** with bring-your-own-key support via environment
  (`TESSIO_AI_PROVIDER`, `TESSIO_AI_API_KEY`/`OPENAI_API_KEY`, `TESSIO_AI_BASE_URL`,
  `TESSIO_AI_MODEL`, `TESSIO_AI_EMBEDDING_MODEL`). `openai-compatible` + a base URL points Tess
  at Azure OpenAI, Ollama, LM Studio, vLLM, or a local model for **zero outbound egress**. A
  usage-metering seam is in place (no-op in self-host).
- Community health files: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`,
  issue/PR templates, and a CLA Assistant workflow.

### Database

- Migration `0027`: adds `provider` and `base_url` columns to `ai_settings`.
- Migration `0033`: partial index `users_org_billable_idx` backing the billable-seat count.
- Migration `0034`: new `password_reset_tokens` table.

---

<!--
Release sections will be added here as versions are tagged, e.g.:

## [1.0.0] - YYYY-MM-DD
### Added / Changed / Fixed / Security
-->
