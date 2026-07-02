//! Persisted agent state: the server URL and the per-device token issued at enrollment.
//! The enrollment key itself is never persisted — it is used once then discarded.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Default)]
pub struct State {
    pub server_url: String,
    /// Present once the agent has enrolled.
    pub device_token: Option<String>,
    pub device_id: Option<String>,
}

/// OS-appropriate directory for agent state, locked down to the service account.
/// `TESSIO_AGENT_STATE_DIR` overrides it (useful for testing and custom deployments).
pub fn state_dir() -> PathBuf {
    if let Some(dir) = std::env::var_os("TESSIO_AGENT_STATE_DIR") {
        return PathBuf::from(dir);
    }
    #[cfg(target_os = "windows")]
    {
        let base = std::env::var("ProgramData").unwrap_or_else(|_| r"C:\ProgramData".into());
        PathBuf::from(base).join("tessio-agent")
    }
    #[cfg(target_os = "macos")]
    {
        PathBuf::from("/Library/Application Support/tessio-agent")
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        PathBuf::from("/var/lib/tessio-agent")
    }
}

fn state_path() -> PathBuf {
    state_dir().join("agent.json")
}

impl State {
    pub fn load() -> Result<Self> {
        let path = state_path();
        if !path.exists() {
            return Ok(State::default());
        }
        let raw = std::fs::read_to_string(&path).with_context(|| format!("reading {}", path.display()))?;
        Ok(serde_json::from_str(&raw)?)
    }

    pub fn save(&self) -> Result<()> {
        let dir = state_dir();
        std::fs::create_dir_all(&dir).with_context(|| format!("creating {}", dir.display()))?;
        let path = state_path();
        std::fs::write(&path, serde_json::to_vec_pretty(self)?)?;
        // Best-effort: restrict to owner on unix (state holds the device token).
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
        }
        Ok(())
    }
}
