// SPDX-License-Identifier: AGPL-3.0-only

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FormRenderer } from '@tessio/forms';
import { listSchemas } from '../api/schemas';
import { createTicket } from '../api/tickets';

export function NewTicketForm({ onCreated }: { onCreated: () => void }) {
  const queryClient = useQueryClient();
  const { data: schemas, isLoading, isError } = useQuery({
    queryKey: ['schemas', 'ticket'],
    queryFn: () => listSchemas({ kind: 'ticket', status: 'published' }),
  });

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof createTicket>[0]) => createTicket(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tickets'] });
      onCreated();
    },
  });

  if (isLoading) return <p className="text-sm">Loading form…</p>;
  if (isError) return <p className="text-sm text-red-500">Failed to load ticket types.</p>;

  const schema = schemas?.[0];
  if (!schema) {
    return <p className="text-sm text-accent-foreground">No ticket types defined yet.</p>;
  }

  return (
    <div className="rounded-md border border-input p-4">
      <FormRenderer
        definition={schema.definition}
        onSubmit={(values) =>
          mutation.mutate({ schemaId: schema.id, schemaVersion: schema.version, data: values })
        }
      />
      {mutation.isError ? <p className="mt-2 text-sm text-red-500">Failed to create ticket</p> : null}
    </div>
  );
}
