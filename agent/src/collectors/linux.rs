//! Linux: DMI from /sys/class/dmi/id, packages from dpkg or rpm, machine-id.

use super::SystemInfo;
use crate::model::Software;
use std::process::Command;

fn dmi(field: &str) -> Option<String> {
    std::fs::read_to_string(format!("/sys/class/dmi/id/{field}"))
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty() && s != "None" && s != "To be filled by O.E.M.")
}

pub fn system_info() -> SystemInfo {
    SystemInfo {
        manufacturer: dmi("sys_vendor"),
        model: dmi("product_name"),
        serial: dmi("product_serial"), // requires root
        bios_version: dmi("bios_version"),
    }
}

pub fn os_build() -> Option<String> {
    // PRETTY_NAME from os-release is the most human-meaningful build string.
    let text = std::fs::read_to_string("/etc/os-release").ok()?;
    for line in text.lines() {
        if let Some(v) = line.strip_prefix("VERSION_ID=") {
            return Some(v.trim_matches('"').to_string());
        }
    }
    None
}

pub fn machine_id() -> Option<String> {
    for path in ["/etc/machine-id", "/var/lib/dbus/machine-id"] {
        if let Ok(id) = std::fs::read_to_string(path) {
            let id = id.trim().to_string();
            if !id.is_empty() {
                return Some(id);
            }
        }
    }
    None
}

pub fn software() -> Vec<Software> {
    if let Some(list) = dpkg() {
        return list;
    }
    rpm().unwrap_or_default()
}

fn dpkg() -> Option<Vec<Software>> {
    let out = Command::new("dpkg-query")
        .args(["-W", "-f=${Package}\\t${Version}\\t${Maintainer}\\n"])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    Some(parse_tsv(&String::from_utf8_lossy(&out.stdout)))
}

fn rpm() -> Option<Vec<Software>> {
    let out = Command::new("rpm")
        .args(["-qa", "--qf", "%{NAME}\\t%{VERSION}\\t%{VENDOR}\\n"])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    Some(parse_tsv(&String::from_utf8_lossy(&out.stdout)))
}

fn parse_tsv(text: &str) -> Vec<Software> {
    text.lines()
        .filter_map(|line| {
            let mut cols = line.splitn(3, '\t');
            let name = cols.next()?.trim();
            if name.is_empty() {
                return None;
            }
            Some(Software {
                name: name.to_string(),
                version: cols.next().map(str::trim).filter(|s| !s.is_empty()).map(String::from),
                publisher: cols.next().map(str::trim).filter(|s| !s.is_empty()).map(String::from),
                installed_at: None,
            })
        })
        .collect()
}
