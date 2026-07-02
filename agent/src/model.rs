//! Wire structs mirroring the server's zod contract in `packages/shared/src/agent.ts`.
//! Field names are camelCase to match the API exactly.

use serde::{Deserialize, Serialize};

/// The OS this binary was compiled for. Sent as the `osType` enum value.
pub const OS_TYPE: &str = if cfg!(target_os = "windows") {
    "windows"
} else if cfg!(target_os = "macos") {
    "macos"
} else {
    "linux"
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrollRequest {
    pub enrollment_key: String,
    pub machine_id: String,
    pub hostname: String,
    pub os_type: String,
    pub agent_version: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrollResponse {
    pub device_id: String,
    pub token: String,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Disk {
    pub name: String,
    pub fs_type: Option<String>,
    pub total_bytes: u64,
    pub available_bytes: Option<u64>,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Hardware {
    pub cpu: Option<String>,
    pub cpu_cores: Option<u32>,
    pub ram_bytes: Option<u64>,
    pub disks: Vec<Disk>,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub serial: Option<String>,
    pub bios_version: Option<String>,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Identity {
    pub hostname: String,
    pub os_type: String,
    pub os_version: Option<String>,
    pub os_build: Option<String>,
    pub last_user: Option<String>,
    /// ISO-8601 (RFC 3339, UTC) — e.g. "2026-06-13T09:00:00.000Z".
    pub last_boot_at: Option<String>,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct NetIface {
    pub name: String,
    pub mac: Option<String>,
    pub ipv4: Vec<String>,
    pub ipv6: Vec<String>,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Network {
    pub interfaces: Vec<NetIface>,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Software {
    pub name: String,
    pub version: Option<String>,
    pub publisher: Option<String>,
    pub installed_at: Option<String>,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub hardware: Hardware,
    pub identity: Identity,
    pub network: Network,
    pub software: Vec<Software>,
    pub agent_version: String,
}
