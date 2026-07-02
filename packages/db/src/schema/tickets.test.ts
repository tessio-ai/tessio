// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { tickets } from './tickets';

describe('tickets table', () => {
  it('includes the shared foundation columns', () => {
    const cols = getTableConfig(tickets).columns.map((c) => c.name);
    expect(cols).toEqual(
      expect.arrayContaining([
        'id',
        'org_id',
        'schema_id',
        'schema_version',
        'data',
        'created_at',
        'updated_at',
        'deleted_at',
      ]),
    );
  });

  it('includes ticket-specific system columns from spec 4.4', () => {
    const cols = getTableConfig(tickets).columns.map((c) => c.name);
    expect(cols).toEqual(
      expect.arrayContaining([
        'number',
        'status',
        'priority',
        'requester_id',
        'assignee_id',
        'team_id',
        'due_at',
        'resolved_at',
        'closed_at',
        'parent_id',
      ]),
    );
  });
});
