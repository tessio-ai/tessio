// SPDX-License-Identifier: AGPL-3.0-only

import { request } from './client';
import type { Page } from './types';

export type AgentOsType = 'windows' | 'macos' | 'linux';

export interface DeviceRow {
  id: string;
  hostname: string;
  osType: AgentOsType;
  osVersion: string | null;
  osBuild: string | null;
  manufacturer: string | null;
  model: string | null;
  serial: string | null;
  cpu: string | null;
  cpuCores: number | null;
  ramBytes: number | null;
  lastUser: string | null;
  lastBootAt: string | null;
  agentVersion: string | null;
  status: 'online' | 'offline';
  machineId: string;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  lastReportAt: string | null;
  linkedAssetId: string | null;
  data: Record<string, unknown>;
}

export interface SoftwareItem {
  name: string;
  version: string | null;
  publisher: string | null;
  installedAt: string | null;
}

export interface DeviceDetail extends DeviceRow {
  software: SoftwareItem[];
}

export interface DeviceQuery {
  filter?: unknown;
  sort?: { field: string; dir: 'asc' | 'desc' };
  limit?: number;
  cursor?: string;
}

export const queryDevices = (q: DeviceQuery = {}): Promise<Page<DeviceRow>> =>
  request<Page<DeviceRow>>('/agent/devices/query', { method: 'POST', body: JSON.stringify(q) });

export const getDevice = (id: string): Promise<DeviceDetail> => request<DeviceDetail>(`/agent/devices/${id}`);

export const linkDevice = (id: string, assetId: string): Promise<DeviceRow> =>
  request<DeviceRow>(`/agent/devices/${id}/link`, { method: 'POST', body: JSON.stringify({ assetId }) });

export const unlinkDevice = (id: string): Promise<DeviceRow> =>
  request<DeviceRow>(`/agent/devices/${id}/unlink`, { method: 'POST', body: JSON.stringify({}) });

export const deleteDevice = (id: string) => request<void>(`/agent/devices/${id}`, { method: 'DELETE' });
