// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@tessio/ui';
import { queryTickets } from '../api/tickets';
import { TicketList } from './TicketList';
import { NewTicketForm } from './NewTicketForm';

export function TicketsPage() {
  const [creating, setCreating] = useState(false);
  const { data, isLoading, isError } = useQuery({ queryKey: ['tickets'], queryFn: () => queryTickets() });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Tickets</h2>
        <Button onClick={() => setCreating((c) => !c)}>{creating ? 'Close' : 'New ticket'}</Button>
      </div>

      {creating ? <NewTicketForm onCreated={() => setCreating(false)} /> : null}

      {isLoading ? <p className="text-sm">Loading…</p> : null}
      {isError ? <p className="text-sm text-red-500">Failed to load tickets</p> : null}
      {data && !isError ? <TicketList rows={data.rows} /> : null}
    </div>
  );
}
