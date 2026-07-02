//! Tessio endpoint agent.
//!
//!   tessio-agent install --server <URL> --key <ENROLLMENT_KEY>   enroll + register service
//!   tessio-agent run                                             daemon loop (snapshot + heartbeat)
//!   tessio-agent once                                            send a single snapshot and exit

mod client;
mod collectors;
mod config;
mod enroll;
mod model;
mod scheduler;
mod service;

use anyhow::{bail, Context, Result};
use clap::{Parser, Subcommand};
use client::Client;
use config::State;

#[derive(Parser)]
#[command(name = "tessio-agent", version, about = "Collects CMDB inventory and reports it to a Tessio instance.")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Enroll this machine and register the background service.
    Install {
        #[arg(long)]
        server: String,
        #[arg(long)]
        key: String,
    },
    /// Run the reporting loop (used by the service).
    Run,
    /// Collect and send one snapshot, then exit.
    Once,
}

fn main() -> Result<()> {
    match Cli::parse().command {
        Command::Install { server, key } => install(&server, &key),
        Command::Run => run(),
        Command::Once => once(),
    }
}

fn install(server: &str, key: &str) -> Result<()> {
    let client = Client::new(server)?;
    let res = enroll::enroll(&client, key).context("enrollment failed")?;
    let state = State { server_url: server.to_string(), device_token: Some(res.token), device_id: Some(res.device_id.clone()) };
    state.save()?;
    println!("Enrolled as device {}.", res.device_id);
    service::install()?;
    Ok(())
}

fn run() -> Result<()> {
    let state = State::load()?;
    let token = require_token(&state)?;
    let client = Client::new(&state.server_url)?;
    scheduler::run(&client, &token)
}

fn once() -> Result<()> {
    let state = State::load()?;
    let token = require_token(&state)?;
    let client = Client::new(&state.server_url)?;
    client.report(&token, &collectors::collect())?;
    println!("Snapshot sent.");
    Ok(())
}

fn require_token(state: &State) -> Result<String> {
    match &state.device_token {
        Some(t) if !state.server_url.is_empty() => Ok(t.clone()),
        _ => bail!("not enrolled — run `tessio-agent install --server <URL> --key <KEY>` first"),
    }
}
