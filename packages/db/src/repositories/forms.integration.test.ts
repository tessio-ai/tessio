// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, resetDb } from '../testing/test-db';
import { orgs, schemas } from '../schema';
import { formsRepo } from './forms';
import type { PortalTheme, FormDefinition } from '@tessio/shared';

const db = createTestDb();
const theme: PortalTheme = { accent: '#4f46e5', layout: 'single', bg: 'plain', font: 'sans', showTess: true, headline: 'Report an issue' };
const def: FormDefinition = { sections: [{ id: 's1', title: 'About', order: 0, fields: [{ fieldKey: 'title', width: 'full' }] }] };

async function ctx() {
  const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
  const [schema] = await db.insert(schemas).values({
    orgId: org.id, kind: 'ticket', key: `t-${crypto.randomUUID()}`, name: 'Incident', status: 'published',
    definition: { fields: [{ key: 'title', label: 'Title', type: 'text', required: true, order: 0, width: 'full' }] },
  }).returning();
  return { orgId: org.id, schemaId: schema.id };
}

describe('formsRepo', () => {
  beforeEach(async () => { await resetDb(db); });
  afterAll(async () => { await db.$client.end(); });

  it('creates, finds by id and key, and lists', async () => {
    const { orgId, schemaId } = await ctx();
    const created = await formsRepo(db).create({ orgId, key: 'report', name: 'Report an issue', categoryKey: 'IT', targetSchemaId: schemaId, theme, definition: def, status: 'published' });
    expect((await formsRepo(db).findById(orgId, created.id))?.name).toBe('Report an issue');
    expect((await formsRepo(db).findByKey(orgId, 'report'))?.id).toBe(created.id);
    expect((await formsRepo(db).list(orgId)).length).toBe(1);
  });

  it('listPublished returns only published forms', async () => {
    const { orgId, schemaId } = await ctx();
    await formsRepo(db).create({ orgId, key: 'a', name: 'A', categoryKey: 'IT', targetSchemaId: schemaId, theme, definition: def, status: 'published' });
    await formsRepo(db).create({ orgId, key: 'b', name: 'B', categoryKey: 'IT', targetSchemaId: schemaId, theme, definition: def, status: 'draft' });
    const pub = await formsRepo(db).listPublished(orgId);
    expect(pub.map((f) => f.key)).toEqual(['a']);
  });

  it('updates and archives', async () => {
    const { orgId, schemaId } = await ctx();
    const f = await formsRepo(db).create({ orgId, key: 'c', name: 'C', categoryKey: 'IT', targetSchemaId: schemaId, theme, definition: def, status: 'draft' });
    expect((await formsRepo(db).update(orgId, f.id, { name: 'C2' }))?.name).toBe('C2');
    expect((await formsRepo(db).archive(orgId, f.id))?.status).toBe('archived');
  });

  it('fieldReferencedByForm finds a non-archived form referencing a field', async () => {
    const { orgId, schemaId } = await ctx();
    await formsRepo(db).create({ orgId, key: 'd', name: 'Uses Title', categoryKey: 'IT', targetSchemaId: schemaId, theme, definition: def, status: 'published' });
    expect(await formsRepo(db).fieldReferencedByForm(orgId, schemaId, 'title')).toBe('Uses Title');
    expect(await formsRepo(db).fieldReferencedByForm(orgId, schemaId, 'absent')).toBeNull();
  });
});
