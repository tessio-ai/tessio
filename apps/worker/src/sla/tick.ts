// SPDX-License-Identifier: AGPL-3.0-only

import { computeBreaches, type SlaCandidate } from './breaches';

export interface SlaNotice {
  orgId: string;
  ticketId: string;
  number: number | null;
  kind: 'response' | 'resolution';
  assigneeId: string | null;
  teamId: string | null;
}

export interface SlaDeps {
  now(): Date;
  loadCandidates(): Promise<SlaCandidate[]>;
  stampBreach(ticketId: string, kind: 'response' | 'resolution', at: Date): Promise<void>;
  notify(n: SlaNotice): Promise<void>;
}

export async function runSlaTick(deps: SlaDeps): Promise<void> {
  const now = deps.now();
  const { response, resolution } = computeBreaches(await deps.loadCandidates(), now);

  for (const t of response) {
    try {
      await deps.stampBreach(t.id, 'response', now);
      await deps.notify({ orgId: t.orgId, ticketId: t.id, number: t.number, kind: 'response', assigneeId: t.assigneeId, teamId: t.teamId });
    } catch (err) {
      console.error('sla tick failed', t.id, err);
    }
  }

  for (const t of resolution) {
    try {
      await deps.stampBreach(t.id, 'resolution', now);
      await deps.notify({ orgId: t.orgId, ticketId: t.id, number: t.number, kind: 'resolution', assigneeId: t.assigneeId, teamId: t.teamId });
    } catch (err) {
      console.error('sla tick failed', t.id, err);
    }
  }
}
