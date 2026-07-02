// SPDX-License-Identifier: AGPL-3.0-only

import type { TicketRow } from '../api/types';

export function TicketList({ rows }: { rows: TicketRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-accent-foreground">No tickets yet</p>;
  }
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-input">
          <th scope="col" className="py-2 pr-4 font-medium">#</th>
          <th scope="col" className="py-2 pr-4 font-medium">Title</th>
          <th scope="col" className="py-2 pr-4 font-medium">Status</th>
          <th scope="col" className="py-2 pr-4 font-medium">Priority</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((t) => (
          <tr key={t.id} className="border-b border-input">
            <td className="py-2 pr-4">{t.number ?? '—'}</td>
            <td className="py-2 pr-4">{typeof t.data.title === 'string' ? t.data.title : '—'}</td>
            <td className="py-2 pr-4">{t.status ?? '—'}</td>
            <td className="py-2 pr-4">{t.priority ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
