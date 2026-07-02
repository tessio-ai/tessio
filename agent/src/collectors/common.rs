//! Cross-platform basics via sysinfo + if-addrs + mac_address.

use crate::model::{Disk, NetIface};
use chrono::{SecondsFormat, TimeZone, Utc};
use std::collections::BTreeMap;
use sysinfo::{Disks, System};

pub struct Base {
    pub hostname: String,
    pub os_version: Option<String>,
    pub last_boot_at: Option<String>,
    pub last_user: Option<String>,
    pub cpu: Option<String>,
    pub cpu_cores: Option<u32>,
    pub ram_bytes: Option<u64>,
    pub disks: Vec<Disk>,
    pub interfaces: Vec<NetIface>,
}

pub fn collect() -> Base {
    let mut sys = System::new();
    sys.refresh_cpu_all();
    sys.refresh_memory();

    let cpu = sys.cpus().first().map(|c| c.brand().trim().to_string()).filter(|s| !s.is_empty());
    let cpu_cores = sys.physical_core_count().map(|n| n as u32).or(Some(sys.cpus().len() as u32));

    let boot = System::boot_time();
    let last_boot_at = if boot > 0 {
        Utc.timestamp_opt(boot as i64, 0).single().map(|dt| dt.to_rfc3339_opts(SecondsFormat::Millis, true))
    } else {
        None
    };

    Base {
        hostname: System::host_name().unwrap_or_default(),
        os_version: System::os_version().or_else(System::kernel_version),
        last_boot_at,
        last_user: current_user(),
        cpu,
        cpu_cores,
        ram_bytes: Some(sys.total_memory()),
        disks: collect_disks(),
        interfaces: collect_interfaces(),
    }
}

fn collect_disks() -> Vec<Disk> {
    let disks = Disks::new_with_refreshed_list();
    disks
        .list()
        .iter()
        .map(|d| Disk {
            name: d.mount_point().to_string_lossy().to_string(),
            fs_type: Some(d.file_system().to_string_lossy().to_string()).filter(|s| !s.is_empty()),
            total_bytes: d.total_space(),
            available_bytes: Some(d.available_space()),
        })
        .collect()
}

fn collect_interfaces() -> Vec<NetIface> {
    let mut by_name: BTreeMap<String, NetIface> = BTreeMap::new();
    if let Ok(addrs) = if_addrs::get_if_addrs() {
        for iface in addrs {
            if iface.is_loopback() {
                continue;
            }
            let entry = by_name.entry(iface.name.clone()).or_insert_with(|| NetIface {
                name: iface.name.clone(),
                mac: mac_for(&iface.name),
                ipv4: Vec::new(),
                ipv6: Vec::new(),
            });
            match iface.addr.ip() {
                std::net::IpAddr::V4(v4) => entry.ipv4.push(v4.to_string()),
                std::net::IpAddr::V6(v6) => entry.ipv6.push(v6.to_string()),
            }
        }
    }
    by_name.into_values().collect()
}

fn mac_for(name: &str) -> Option<String> {
    mac_address::mac_address_by_name(name).ok().flatten().map(|m| m.to_string())
}

fn current_user() -> Option<String> {
    // A service may run as root/SYSTEM; prefer the invoking user when available.
    std::env::var("SUDO_USER")
        .ok()
        .or_else(|| std::env::var("USER").ok())
        .or_else(|| std::env::var("USERNAME").ok())
        .filter(|s| !s.is_empty())
}
