// SPDX-License-Identifier: AGPL-3.0-only

export interface SlaCandidate {
  id: string; orgId: string; number: number | null; assigneeId: string | null; teamId: string | null;
  slaResponseDueAt: Date | null; firstRespondedAt: Date | null; slaResponseBreachedAt: Date | null;
  slaResolutionDueAt: Date | null; resolvedAt: Date | null; slaResolutionBreachedAt: Date | null;
}
export function computeBreaches(rows: SlaCandidate[], now: Date): { response: SlaCandidate[]; resolution: SlaCandidate[] } {
  const response = rows.filter((t) => t.slaResponseDueAt && t.slaResponseDueAt < now && !t.firstRespondedAt && !t.slaResponseBreachedAt);
  const resolution = rows.filter((t) => t.slaResolutionDueAt && t.slaResolutionDueAt < now && !t.resolvedAt && !t.slaResolutionBreachedAt);
  return { response, resolution };
}
