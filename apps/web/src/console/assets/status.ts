// SPDX-License-Identifier: AGPL-3.0-only

export type PillTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

const MAP: Record<string, { tone: PillTone; label: string }> = {
  in_use: { tone: 'success', label: 'In use' },
  in_stock: { tone: 'info', label: 'In stock' },
  retired: { tone: 'neutral', label: 'Retired' },
};

export function assetStatusMeta(status: string | null): { tone: PillTone; label: string } {
  if (!status) return { tone: 'neutral', label: '—' };
  return MAP[status] ?? { tone: 'neutral', label: status };
}
