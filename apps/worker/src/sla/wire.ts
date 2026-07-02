// SPDX-License-Identifier: AGPL-3.0-only

import { ticketsRepo, notificationsRepo, teamMembersRepo } from '@tessio/db';
import type { Db } from '@tessio/db';
import type { SlaDeps, SlaNotice } from './tick';

export function buildSlaDeps(db: Db): SlaDeps {
  return {
    now: () => new Date(),

    loadCandidates: () => ticketsRepo(db).listSlaBreachCandidates(new Date()),

    stampBreach: (id, kind, at) => ticketsRepo(db).stampSlaBreach(id, kind, at),

    async notify(n: SlaNotice): Promise<void> {
      // Collect team member userIds (if teamId is set).
      let teamMemberUserIds: string[] = [];
      if (n.teamId) {
        const members = await teamMembersRepo(db).listByTeam(n.teamId);
        teamMemberUserIds = members.map((m) => m.userId);
      }

      // Build deduped recipient list, dropping nulls/undefineds.
      const seen = new Set<string>();
      const recipients: string[] = [];
      for (const id of [n.assigneeId, ...teamMemberUserIds]) {
        if (id && !seen.has(id)) {
          seen.add(id);
          recipients.push(id);
        }
      }

      if (recipients.length === 0) return;

      await notificationsRepo(db).createMany(
        recipients.map((userId) => ({
          orgId: n.orgId,
          userId,
          ticketId: n.ticketId,
          type: 'sla',
          title: `#${n.number ?? '?'} SLA breached`,
          snippet: n.kind === 'response' ? 'Response SLA breached.' : 'Resolution SLA breached.',
        })),
      );
    },
  };
}
