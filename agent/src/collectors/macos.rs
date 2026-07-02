//! macOS: hardware via `system_profiler -json`, machine id via `ioreg`,
//! installed apps by scanning /Applications bundles.

use super::SystemInfo;
use crate::model::Software;
use std::process::Command;

pub fn system_info() -> SystemInfo {
    let mut info = SystemInfo { manufacturer: Some("Apple".to_string()), ..Default::default() };
    if let Some(json) = run_json(&["SPHardwareDataType"]) {
        if let Some(item) = json.get("SPHardwareDataType").and_then(|a| a.get(0)) {
            info.model = item.get("machine_model").and_then(|v| v.as_str()).map(String::from);
            info.serial = item.get("serial_number").and_then(|v| v.as_str()).map(String::from);
            info.bios_version = item.get("boot_rom_version").and_then(|v| v.as_str()).map(String::from);
        }
    }
    info
}

pub fn os_build() -> Option<String> {
    let out = Command::new("sw_vers").arg("-buildVersion").output().ok()?;
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    (!s.is_empty()).then_some(s)
}

pub fn machine_id() -> Option<String> {
    let out = Command::new("ioreg").args(["-rd1", "-c", "IOPlatformExpertDevice"]).output().ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    for line in text.lines() {
        if line.contains("IOPlatformUUID") {
            // …"IOPlatformUUID" = "XXXX-…"
            if let Some(start) = line.rfind('"') {
                let rest = &line[..start];
                if let Some(open) = rest.rfind('"') {
                    return Some(line[open + 1..start].to_string());
                }
            }
        }
    }
    None
}

pub fn software() -> Vec<Software> {
    let mut out = Vec::new();
    let Ok(entries) = std::fs::read_dir("/Applications") else {
        return out;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("app") {
            continue;
        }
        let name = path.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string();
        if name.is_empty() {
            continue;
        }
        let version = plist_value(&path.join("Contents/Info"), "CFBundleShortVersionString");
        out.push(Software { name, version, publisher: None, installed_at: None });
    }
    out
}

/// Read a string key from an Info.plist via `defaults` (handles binary plists).
fn plist_value(info_plist_no_ext: &std::path::Path, key: &str) -> Option<String> {
    let out = Command::new("defaults")
        .arg("read")
        .arg(info_plist_no_ext)
        .arg(key)
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let v = String::from_utf8_lossy(&out.stdout).trim().to_string();
    (!v.is_empty()).then_some(v)
}

fn run_json(args: &[&str]) -> Option<serde_json::Value> {
    let mut cmd = Command::new("system_profiler");
    cmd.arg("-json");
    for a in args {
        cmd.arg(a);
    }
    let out = cmd.output().ok()?;
    if !out.status.success() {
        return None;
    }
    serde_json::from_slice(&out.stdout).ok()
}
