//! First-run enrollment: exchange the org enrollment key for a per-device token.

use crate::client::Client;
use crate::collectors;
use crate::model::{EnrollRequest, EnrollResponse, OS_TYPE};
use anyhow::Result;
use sysinfo::System;

pub fn enroll(client: &Client, enrollment_key: &str) -> Result<EnrollResponse> {
    let req = EnrollRequest {
        enrollment_key: enrollment_key.to_string(),
        machine_id: collectors::machine_id(),
        hostname: System::host_name().unwrap_or_else(|| "unknown".to_string()),
        os_type: OS_TYPE.to_string(),
        agent_version: env!("CARGO_PKG_VERSION").to_string(),
    };
    client.enroll(&req)
}
