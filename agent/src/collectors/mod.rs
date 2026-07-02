//! Inventory collection. `common` gathers the cross-platform basics via sysinfo;
//! the per-OS modules fill in serial/model/firmware, installed software, the OS
//! build string, and the stable machine id.

mod common;

#[cfg(target_os = "windows")]
#[path = "windows.rs"]
mod platform;
#[cfg(target_os = "macos")]
#[path = "macos.rs"]
mod platform;
#[cfg(all(unix, not(target_os = "macos")))]
#[path = "linux.rs"]
mod platform;

use crate::model::{Hardware, Identity, Network, Snapshot, OS_TYPE};

/// A stable per-machine identifier used to de-duplicate the device server-side.
pub fn machine_id() -> String {
    platform::machine_id()
        .or_else(|| sysinfo::System::host_name())
        .unwrap_or_else(|| "unknown".to_string())
}

/// Build a full inventory snapshot. Best-effort: a failing source yields None/empty.
pub fn collect() -> Snapshot {
    let base = common::collect();
    let sys = platform::system_info();

    Snapshot {
        hardware: Hardware {
            cpu: base.cpu,
            cpu_cores: base.cpu_cores,
            ram_bytes: base.ram_bytes,
            disks: base.disks,
            manufacturer: sys.manufacturer,
            model: sys.model,
            serial: sys.serial,
            bios_version: sys.bios_version,
        },
        identity: Identity {
            hostname: base.hostname,
            os_type: OS_TYPE.to_string(),
            os_version: base.os_version,
            os_build: platform::os_build(),
            last_user: base.last_user,
            last_boot_at: base.last_boot_at,
        },
        network: Network { interfaces: base.interfaces },
        software: platform::software(),
        agent_version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

/// What the per-OS modules return for hardware identity.
#[derive(Default)]
pub struct SystemInfo {
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub serial: Option<String>,
    pub bios_version: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn machine_id_is_non_empty() {
        assert!(!machine_id().is_empty());
    }

    #[test]
    fn collect_runs_and_serializes_with_camelcase_keys() {
        let snap = collect();
        assert!(!snap.identity.hostname.is_empty());
        assert_eq!(snap.identity.os_type, OS_TYPE);
        assert_eq!(snap.agent_version, env!("CARGO_PKG_VERSION"));

        // Wire format must use camelCase to match the server's zod contract.
        let json = serde_json::to_string(&snap).expect("snapshot serializes");
        assert!(json.contains("\"osType\""));
        assert!(json.contains("\"agentVersion\""));
        assert!(json.contains("\"ramBytes\""));
    }
}
