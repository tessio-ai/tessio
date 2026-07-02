//! Best-effort OS service registration so the agent runs persistently after install.
//! Falls back to printing instructions when it can't write the unit (e.g. not root).

use anyhow::Result;
use std::path::PathBuf;

pub fn install() -> Result<()> {
    let exe = std::env::current_exe().unwrap_or_else(|_| PathBuf::from("tessio-agent"));
    let exe = exe.display().to_string();

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let unit = format!(
            "[Unit]\nDescription=Tessio endpoint agent\nAfter=network-online.target\n\n\
             [Service]\nType=simple\nExecStart={exe} run\nRestart=always\nRestartSec=30\n\n\
             [Install]\nWantedBy=multi-user.target\n"
        );
        let path = "/etc/systemd/system/tessio-agent.service";
        if std::fs::write(path, unit).is_ok() {
            println!("Installed systemd unit at {path}.");
            println!("Enable it with:  sudo systemctl enable --now tessio-agent");
        } else {
            println!("Could not write {path} (need root). To run persistently, create a systemd unit running: {exe} run");
        }
    }

    #[cfg(target_os = "macos")]
    {
        let plist = format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
             <!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n\
             <plist version=\"1.0\"><dict>\n\
             <key>Label</key><string>io.tessio.agent</string>\n\
             <key>ProgramArguments</key><array><string>{exe}</string><string>run</string></array>\n\
             <key>RunAtLoad</key><true/>\n<key>KeepAlive</key><true/>\n\
             </dict></plist>\n"
        );
        let path = "/Library/LaunchDaemons/io.tessio.agent.plist";
        if std::fs::write(path, plist).is_ok() {
            println!("Installed launchd daemon at {path}.");
            println!("Load it with:  sudo launchctl load -w {path}");
        } else {
            println!("Could not write {path} (need root). To run persistently, create a launchd daemon running: {exe} run");
        }
    }

    #[cfg(target_os = "windows")]
    {
        println!("To run persistently as a Windows service:");
        println!("  sc.exe create TessioAgent binPath= \"{exe} run\" start= auto");
        println!("  sc.exe start TessioAgent");
    }

    Ok(())
}
