// SPDX-License-Identifier: AGPL-3.0-only

import type { AgentOsType } from '../../api/devices';

export const osLabel: Record<AgentOsType, string> = { windows: 'Windows', macos: 'macOS', linux: 'Linux' };

export function fmtBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n >= 10 || i === 0 ? Math.round(n) : n.toFixed(1)} ${units[i]}`;
}

export const statusTone = (status: 'online' | 'offline') => (status === 'online' ? 'success' : 'neutral');
