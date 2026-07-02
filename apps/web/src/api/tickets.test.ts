// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, afterEach } from 'vitest';
import { queryTickets, createTicket, updateTicket } from './tickets';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('tickets api', () => {
  it('queryTickets POSTs the query to /tickets/query', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ rows: [], nextCursor: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await queryTickets({ filter: { field: 'status', op: 'eq', value: 'open' }, sort: { field: 'updatedAt', dir: 'desc' } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/tickets/query');
    expect(init.method).toBe('POST');
  });

  it('updateTicket PATCHes /tickets/:id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await updateTicket('t1', { status: 'closed' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/tickets/t1');
    expect(init.method).toBe('PATCH');
  });

  it('createTicket POSTs the body and returns the row', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 't2', number: 1 }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const row = await createTicket({ schemaId: 's1', schemaVersion: 1, data: { title: 'x' } });
    expect(row.number).toBe(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/tickets');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ schemaId: 's1', schemaVersion: 1, data: { title: 'x' } });
  });
});
