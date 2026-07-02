// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, resetDb, seedOrgAndSchema } from '../testing/test-db';
import { orgs, schemas } from '../schema';
import { schemasRepo } from './schemas';

const db = createTestDb();
const repo = schemasRepo(db);

describe('schemasRepo', () => {
  beforeEach(async () => {
    await resetDb(db);
  });
  afterAll(async () => {
    await db.$client.end();
  });

  it('lists schemas for an org, filtered by kind', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    await seedOrgAndSchema(db, 'asset'); // a different org + kind
    const ticketSchemas = await repo.list(orgId, { kind: 'ticket' });
    expect(ticketSchemas).toHaveLength(1);
    expect(ticketSchemas[0].kind).toBe('ticket');
  });

  it('filters by status', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket'); // seeded as published
    expect(await repo.list(orgId, { status: 'published' })).toHaveLength(1);
    expect(await repo.list(orgId, { status: 'draft' })).toHaveLength(0);
  });

  it('gets a schema by id within the org', async () => {
    const { orgId, schemaId } = await seedOrgAndSchema(db, 'ticket');
    const found = await repo.getById(orgId, schemaId);
    expect(found?.id).toBe(schemaId);
    expect(found?.definition).toEqual({ fields: [] });
  });

  it('does not return a schema from another org', async () => {
    const a = await seedOrgAndSchema(db, 'ticket');
    const b = await seedOrgAndSchema(db, 'ticket');
    expect(await repo.getById(b.orgId, a.schemaId)).toBeUndefined();
  });

  it('updateDefinition replaces the definition and bumps the version', async () => {
    const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
    const [schema] = await db.insert(schemas).values({
      orgId: org.id, kind: 'ticket', key: `t-${crypto.randomUUID()}`, name: 'Incident', version: 1, status: 'published',
      definition: { fields: [{ key: 'title', label: 'Title', type: 'text', required: true, order: 0, width: 'full' }] },
    }).returning();

    const updated = await schemasRepo(db).updateDefinition(org.id, schema.id, {
      fields: [
        { key: 'title', label: 'Title', type: 'text', required: true, order: 0, width: 'full' },
        { key: 'urgency', label: 'Urgency', type: 'select', required: false, order: 1, width: 'full' },
      ],
    });
    expect(updated?.version).toBe(2);
    expect(updated?.definition.fields.length).toBe(2);
  });
});
