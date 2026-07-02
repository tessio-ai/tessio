//! Windows: hardware via WMI, machine id + OS build + installed software via the registry.

use super::SystemInfo;
use crate::model::Software;
use serde::Deserialize;
use winreg::enums::*;
use winreg::RegKey;
use wmi::{COMLibrary, WMIConnection};

#[derive(Deserialize)]
#[serde(rename = "Win32_BIOS")]
#[serde(rename_all = "PascalCase")]
struct Bios {
    serial_number: Option<String>,
    #[serde(rename = "SMBIOSBIOSVersion")]
    smbios_bios_version: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename = "Win32_ComputerSystem")]
#[serde(rename_all = "PascalCase")]
struct ComputerSystem {
    manufacturer: Option<String>,
    model: Option<String>,
}

pub fn system_info() -> SystemInfo {
    let mut info = SystemInfo::default();
    let Ok(com) = COMLibrary::new() else {
        return info;
    };
    let Ok(wmi) = WMIConnection::new(com) else {
        return info;
    };

    if let Ok(rows) = wmi.query::<ComputerSystem>() {
        if let Some(cs) = rows.into_iter().next() {
            info.manufacturer = cs.manufacturer.filter(|s| !s.trim().is_empty());
            info.model = cs.model.filter(|s| !s.trim().is_empty());
        }
    }
    if let Ok(rows) = wmi.query::<Bios>() {
        if let Some(b) = rows.into_iter().next() {
            info.serial = b.serial_number.filter(|s| !s.trim().is_empty());
            info.bios_version = b.smbios_bios_version.filter(|s| !s.trim().is_empty());
        }
    }
    info
}

pub fn os_build() -> Option<String> {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let key = hklm.open_subkey(r"SOFTWARE\Microsoft\Windows NT\CurrentVersion").ok()?;
    let build: String = key.get_value("CurrentBuildNumber").ok()?;
    let ubr: Option<u32> = key.get_value("UBR").ok();
    Some(match ubr {
        Some(ubr) => format!("{build}.{ubr}"),
        None => build,
    })
}

pub fn machine_id() -> Option<String> {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let key = hklm.open_subkey(r"SOFTWARE\Microsoft\Cryptography").ok()?;
    key.get_value("MachineGuid").ok()
}

pub fn software() -> Vec<Software> {
    let mut out = Vec::new();
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    // 64-bit and 32-bit (WOW6432Node) uninstall hives.
    for path in [
        r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
    ] {
        let Ok(root) = hklm.open_subkey(path) else {
            continue;
        };
        for sub in root.enum_keys().flatten() {
            let Ok(app) = root.open_subkey(&sub) else {
                continue;
            };
            let Ok(name) = app.get_value::<String, _>("DisplayName") else {
                continue; // entries without a display name are updates/components
            };
            if name.trim().is_empty() {
                continue;
            }
            out.push(Software {
                name,
                version: app.get_value::<String, _>("DisplayVersion").ok(),
                publisher: app.get_value::<String, _>("Publisher").ok(),
                installed_at: app.get_value::<String, _>("InstallDate").ok().and_then(parse_install_date),
            });
        }
    }
    out
}

/// Registry InstallDate is "YYYYMMDD"; expand to an ISO-8601 instant.
fn parse_install_date(raw: String) -> Option<String> {
    if raw.len() != 8 || !raw.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }
    Some(format!("{}-{}-{}T00:00:00.000Z", &raw[0..4], &raw[4..6], &raw[6..8]))
}
