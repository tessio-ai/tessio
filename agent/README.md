# Tessio endpoint agent

A small cross-platform (Windows / macOS / Linux) binary that collects CMDB inventory —
hardware, OS/identity, network, and installed software — and reports it to a Tessio
instance. Devices appear under **Devices** in the console.

It is a standalone Rust crate, intentionally **outside** the pnpm/Turbo workspace
(`apps/*`, `packages/*`); build it with Cargo, not pnpm.

## How it works

1. An admin creates an **enrollment key** in *Settings → Endpoint agents*.
2. `tessio-agent install --server <URL> --key <KEY>` enrolls the machine once. The server
   issues a **per-device token** (stored locally; the enrollment key is discarded) and the
   agent registers a background service.
3. The service runs `tessio-agent run`: a full snapshot on startup and every 6h, plus a
   heartbeat every 5m. The server marks a device offline if no heartbeat arrives within 15m.

The wire format mirrors `packages/shared/src/agent.ts` exactly (see `src/model.rs`). If you
change the contract on the server, update the structs here to match.

## Commands

```
tessio-agent install --server https://help.example.com --key <ENROLLMENT_KEY>
tessio-agent run     # daemon loop (used by the service)
tessio-agent once    # send a single snapshot, then exit (handy for cron/testing)
```

State (server URL + device token) lives in:
`%ProgramData%\tessio-agent\agent.json` · `/Library/Application Support/tessio-agent/agent.json` · `/var/lib/tessio-agent/agent.json`.

Intervals are overridable via `TESSIO_REPORT_INTERVAL_SECS` and
`TESSIO_HEARTBEAT_INTERVAL_SECS`. If the device token is rejected (revoked/decommissioned)
the agent stops; re-run `install` to re-enroll.

## Build

```
cargo build --release            # current host
cargo test                       # unit tests
```

Cross-compilation per target uses the standard Rust toolchain (e.g. `cross` or
`cargo build --target x86_64-pc-windows-msvc`). Per-OS collectors are compiled selectively
via `#[cfg(target_os = ...)]`, so each build only pulls in its platform's code (WMI/registry
on Windows; `system_profiler`/`ioreg` on macOS; `/sys/class/dmi` + `dpkg`/`rpm` on Linux).

Some collectors (serial numbers, system DMI) require elevation — run the installer with
`sudo` / an elevated prompt.
