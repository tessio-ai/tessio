// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';

/** Operating systems the endpoint agent supports. */
export const agentOsType = z.enum(['windows', 'macos', 'linux']);
export type AgentOsType = z.infer<typeof agentOsType>;

/**
 * First-run enrollment: the agent presents the org enrollment key plus a stable
 * machine identity. The server issues a per-device token used for all later calls.
 */
export const enrollRequest = z.object({
  enrollmentKey: z.string().min(1),
  /** Stable hardware identifier (e.g. SMBIOS UUID); unique per device within an org. */
  machineId: z.string().min(1).max(256),
  hostname: z.string().min(1).max(256),
  osType: agentOsType,
  agentVersion: z.string().min(1).max(64),
});
export type EnrollRequest = z.infer<typeof enrollRequest>;

export const enrollResponse = z.object({
  deviceId: z.string().uuid(),
  /** Per-device bearer token — returned exactly once, never recoverable afterwards. */
  token: z.string(),
});
export type EnrollResponse = z.infer<typeof enrollResponse>;

const networkInterface = z.object({
  name: z.string(),
  mac: z.string().nullable().optional(),
  ipv4: z.array(z.string()).default([]),
  ipv6: z.array(z.string()).default([]),
});

const disk = z.object({
  name: z.string(),
  fsType: z.string().nullable().optional(),
  totalBytes: z.number().nonnegative(),
  availableBytes: z.number().nonnegative().nullable().optional(),
});

const software = z.object({
  name: z.string().min(1).max(512),
  version: z.string().max(128).nullable().optional(),
  publisher: z.string().max(256).nullable().optional(),
  /** ISO-8601 install date when the OS records one. */
  installedAt: z.string().datetime().nullable().optional(),
});
export type AgentSoftwareItem = z.infer<typeof software>;

/**
 * Full inventory snapshot sent periodically (default every 6h). Replaces the
 * device's hardware/OS/network fields and its entire software list.
 */
export const snapshotReport = z.object({
  hardware: z.object({
    cpu: z.string().nullable().optional(),
    cpuCores: z.number().int().nonnegative().nullable().optional(),
    ramBytes: z.number().nonnegative().nullable().optional(),
    disks: z.array(disk).default([]),
    manufacturer: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    serial: z.string().nullable().optional(),
    biosVersion: z.string().nullable().optional(),
  }),
  identity: z.object({
    hostname: z.string().min(1).max(256),
    osType: agentOsType,
    osVersion: z.string().nullable().optional(),
    osBuild: z.string().nullable().optional(),
    lastUser: z.string().nullable().optional(),
    lastBootAt: z.string().datetime().nullable().optional(),
  }),
  network: z.object({
    interfaces: z.array(networkInterface).default([]),
  }),
  software: z.array(software).max(10_000).default([]),
  agentVersion: z.string().min(1).max(64),
});
export type SnapshotReport = z.infer<typeof snapshotReport>;

/** Lightweight liveness ping (default every 5m). The token identifies the device. */
export const heartbeatRequest = z.object({}).strict();
export type HeartbeatRequest = z.infer<typeof heartbeatRequest>;

/** BullMQ queue that flips stale devices to offline. */
export const AGENT_OFFLINE_QUEUE = 'agent-offline';

/** A device with no heartbeat within this window is considered offline (3× the 5m heartbeat). */
export const AGENT_OFFLINE_AFTER_MS = 15 * 60_000;
