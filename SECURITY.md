# Security Policy

Tessio handles sensitive IT and organizational data, so we take security seriously and
appreciate responsible disclosure.

## Reporting a vulnerability

**Please do not open a public GitHub issue, pull request, or discussion for security reports.**

Report privately by either:

- **GitHub Security Advisories** — preferred: open a draft advisory via the repository's
  **Security → Report a vulnerability** tab (GitHub Private Vulnerability Reporting), or
- **Email** — <!-- PLACEHOLDER: confirm this address before launch --> **security@tessio.dev**.
  Encrypt with our PGP key if you handle a working exploit.

Please include:

- the affected component (api / web / worker / runner / `ee/` / Helm chart / container image)
  and version or commit,
- a description and impact assessment,
- reproduction steps or a proof of concept,
- any relevant logs or configuration (with secrets redacted).

## What to expect

- **Acknowledgement** within **3 business days**.
- A triage assessment and severity (CVSS) within **10 business days**.
- Coordinated disclosure: we'll agree on a timeline with you, fix in a private branch, release a
  patched version, and credit you in the advisory (unless you prefer to remain anonymous).

## Supported versions

Until the first stable (`1.0`) release, only the latest release / `main` receives security
fixes. After `1.0`, this section will list the supported version range.

## Scope

In scope: the Tessio application code (this repository), official container images
(`ghcr.io/tessio-ai/tessio-*`), and the Helm chart.

Out of scope: third-party dependencies (report upstream, but tell us so we can pin/patch),
issues requiring a compromised host or privileged local access, and findings against
self-managed deployments' own misconfiguration (e.g. a publicly exposed Postgres).

## Hardening notes for self-hosters

- Set strong, unique `SESSION_SECRET`, `TESSIO_SECRET_KEY`, and `RUNNER_TOKEN` (see
  `.env.production.example`). Never commit your filled-in `.env`.
- Only the web edge should be published; keep Postgres, Redis, the API, worker, and runner on
  an internal network.
- Terminate TLS at the edge (set `TESSIO_SITE_ADDRESS` to a domain for automatic HTTPS).
- Keep images up to date; subscribe to releases for security patches.

Thank you for helping keep Tessio and its users safe.
