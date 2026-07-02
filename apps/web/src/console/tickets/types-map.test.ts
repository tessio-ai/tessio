// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { ticketTypeKeyById } from './types-map';
import type { SchemaRow } from '../../api/types';

const mk = (id: string, key: string, name: string): SchemaRow =>
  ({ id, kind: 'ticket', key, name, version: 1, status: 'published', definition: { fields: [] } }) as SchemaRow;

describe('ticketTypeKeyById', () => {
  it('resolves the four standard ticket-type keys', () => {
    const map = ticketTypeKeyById([
      mk('a', 'incident', 'Incident'),
      mk('b', 'service_request', 'Service request'),
      mk('c', 'problem', 'Problem'),
      mk('d', 'change', 'Change'),
    ]);
    expect(map).toEqual({ a: 'incident', b: 'request', c: 'problem', d: 'change' });
  });
  it('defaults unknown schemas to request', () => {
    const map = ticketTypeKeyById([mk('x', 'it_ticket', 'IT Ticket')]);
    expect(map.x).toBe('request');
  });
});
