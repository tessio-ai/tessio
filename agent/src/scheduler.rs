//! Daemon loop: a full snapshot every `report_interval`, a heartbeat every
//! `heartbeat_interval`. A rejected token (device revoked/decommissioned) stops
//! the agent — re-running `install` re-enrolls it.

use crate::client::{is_unauthorized, Client};
use crate::collectors;
use anyhow::Result;
use std::time::{Duration, Instant};

fn env_secs(key: &str, default: u64) -> Duration {
    Duration::from_secs(std::env::var(key).ok().and_then(|v| v.parse().ok()).unwrap_or(default))
}

pub fn run(client: &Client, token: &str) -> Result<()> {
    let heartbeat_interval = env_secs("TESSIO_HEARTBEAT_INTERVAL_SECS", 5 * 60);
    let report_interval = env_secs("TESSIO_REPORT_INTERVAL_SECS", 6 * 60 * 60);

    // Report once on startup so a freshly-enrolled device shows full inventory immediately.
    report(client, token)?;
    let mut last_report = Instant::now();

    loop {
        std::thread::sleep(heartbeat_interval);

        if last_report.elapsed() >= report_interval {
            report(client, token)?;
            last_report = Instant::now();
        } else if let Err(err) = client.heartbeat(token) {
            if is_unauthorized(&err) {
                return Err(err);
            }
            eprintln!("heartbeat failed (will retry): {err:#}");
        }
    }
}

/// Collect and send a full snapshot. Propagates auth errors; logs transient ones.
fn report(client: &Client, token: &str) -> Result<()> {
    let snapshot = collectors::collect();
    match client.report(token, &snapshot) {
        Ok(()) => Ok(()),
        Err(err) if is_unauthorized(&err) => Err(err),
        Err(err) => {
            eprintln!("report failed (will retry): {err:#}");
            Ok(())
        }
    }
}
