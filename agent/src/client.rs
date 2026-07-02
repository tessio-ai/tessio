//! Thin HTTP client for the three agent endpoints.

use crate::model::{EnrollRequest, EnrollResponse, Snapshot};
use anyhow::{anyhow, Result};
use std::time::Duration;

pub struct Client {
    http: reqwest::blocking::Client,
    base: String,
}

/// 401 from an authenticated call → our device token is no longer valid; caller re-enrolls.
#[derive(Debug)]
pub struct Unauthorized;

impl Client {
    pub fn new(server_url: &str) -> Result<Self> {
        let http = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent(concat!("tessio-agent/", env!("CARGO_PKG_VERSION")))
            .build()?;
        Ok(Self { http, base: server_url.trim_end_matches('/').to_string() })
    }

    pub fn enroll(&self, req: &EnrollRequest) -> Result<EnrollResponse> {
        let res = self.http.post(format!("{}/api/v1/agent/enroll", self.base)).json(req).send()?;
        if !res.status().is_success() {
            return Err(anyhow!("enroll failed: HTTP {}", res.status()));
        }
        Ok(res.json()?)
    }

    pub fn report(&self, token: &str, snapshot: &Snapshot) -> Result<()> {
        self.authed_post("/api/v1/agent/report", token, snapshot)
    }

    pub fn heartbeat(&self, token: &str) -> Result<()> {
        self.authed_post("/api/v1/agent/heartbeat", token, &serde_json::json!({}))
    }

    fn authed_post<T: serde::Serialize>(&self, path: &str, token: &str, body: &T) -> Result<()> {
        let res = self
            .http
            .post(format!("{}{}", self.base, path))
            .bearer_auth(token)
            .json(body)
            .send()?;
        if res.status() == reqwest::StatusCode::UNAUTHORIZED {
            // Construct from the typed marker (not a message) so `is_unauthorized` can downcast it.
            return Err(anyhow::Error::new(Unauthorized));
        }
        if !res.status().is_success() {
            return Err(anyhow!("POST {} failed: HTTP {}", path, res.status()));
        }
        Ok(())
    }
}

/// True when the error chain contains an `Unauthorized` marker.
pub fn is_unauthorized(err: &anyhow::Error) -> bool {
    err.chain().any(|c| c.downcast_ref::<Unauthorized>().is_some())
}

impl std::fmt::Display for Unauthorized {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "unauthorized")
    }
}
impl std::error::Error for Unauthorized {}
