// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, resetDb } from '../testing/test-db';
import { orgs } from '../schema';
import { reportsRepo } from './reports';
import type { ReportDefinition } from '@tessio/shared';

const db = createTestDb();
const repo = reportsRepo(db);

afterAll(async () => { await db.$client.end(); });

const minimalDefinition: ReportDefinition = {
  source: 'tickets',
  measure: { id: 'count' },
  visualization: 'table',
};

describe('reportsRepo', () => {
  beforeEach(async () => { await resetDb(db); });

  it('creates a report and list/get return it', async () => {
    const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();

    const created = await repo.create({
      orgId: org.id,
      name: 'My Report',
      description: 'A test report',
      definition: minimalDefinition,
    });

    expect(created).toMatchObject({
      name: 'My Report',
      description: 'A test report',
      definition: minimalDefinition,
    });
    expect(created.id).toBeTruthy();

    const list = await repo.list(org.id);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: created.id,
      name: 'My Report',
      description: 'A test report',
      definition: minimalDefinition,
    });

    const got = await repo.get(org.id, created.id);
    expect(got).toMatchObject({ id: created.id, name: 'My Report' });
  });

  it('update changes name and definition, sets updatedAt', async () => {
    const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();

    const created = await repo.create({
      orgId: org.id,
      name: 'Original',
      definition: minimalDefinition,
    });

    const updatedDefinition: ReportDefinition = {
      source: 'tickets',
      measure: { id: 'count' },
      groupBy: { field: 'status' },
      visualization: 'bar',
    };

    const updated = await repo.update(org.id, created.id, {
      name: 'Renamed',
      definition: updatedDefinition,
    });

    expect(updated).toMatchObject({ name: 'Renamed', definition: updatedDefinition });
    expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());

    const got = await repo.get(org.id, created.id);
    expect(got).toMatchObject({ name: 'Renamed', definition: updatedDefinition });
  });

  it('remove deletes the report', async () => {
    const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();

    const created = await repo.create({
      orgId: org.id,
      name: 'To Delete',
      definition: minimalDefinition,
    });

    await repo.remove(org.id, created.id);

    expect(await repo.list(org.id)).toEqual([]);
    expect(await repo.get(org.id, created.id)).toBeUndefined();
  });

  it('org isolation: org A reports not visible to org B', async () => {
    const [orgA] = await db.insert(orgs).values({ name: 'OrgA', slug: `oa-${crypto.randomUUID()}` }).returning();
    const [orgB] = await db.insert(orgs).values({ name: 'OrgB', slug: `ob-${crypto.randomUUID()}` }).returning();

    const created = await repo.create({
      orgId: orgA.id,
      name: 'OrgA Report',
      definition: minimalDefinition,
    });

    // Org B should not see org A's reports
    expect(await repo.list(orgB.id)).toEqual([]);
    expect(await repo.get(orgB.id, created.id)).toBeUndefined();

    // Org A should still see its own report
    expect(await repo.list(orgA.id)).toHaveLength(1);
  });

  it('scopes update and remove to the owning org', async () => {
    const [orgA] = await db.insert(orgs).values({ name: 'OrgA', slug: `oa-${crypto.randomUUID()}` }).returning();
    const [orgB] = await db.insert(orgs).values({ name: 'OrgB', slug: `ob-${crypto.randomUUID()}` }).returning();

    const reportA = await repo.create({
      orgId: orgA.id,
      name: 'OrgA Report',
      definition: minimalDefinition,
    });

    // Cross-org update is a no-op: returns undefined and leaves the record unchanged
    const updateResult = await repo.update(orgB.id, reportA.id, { name: 'hacked' });
    expect(updateResult).toBeUndefined();

    const afterUpdate = await repo.get(orgA.id, reportA.id);
    expect(afterUpdate).toBeDefined();
    expect(afterUpdate!.name).toBe('OrgA Report');

    // Cross-org remove is a no-op: the report still exists in org A
    await repo.remove(orgB.id, reportA.id);

    const afterRemove = await repo.get(orgA.id, reportA.id);
    expect(afterRemove).toBeDefined();
    expect(afterRemove!.id).toBe(reportA.id);
  });

  it('definition round-trips correctly as JSONB', async () => {
    const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();

    const richDefinition: ReportDefinition = {
      source: 'tickets',
      measure: { id: 'count' },
      groupBy: { field: 'status', limit: 10 },
      dateRange: { field: 'createdAt', preset: '30d' },
      visualization: 'bar',
    };

    const created = await repo.create({
      orgId: org.id,
      name: 'Rich Report',
      definition: richDefinition,
    });

    const got = await repo.get(org.id, created.id);
    expect(got!.definition).toEqual(richDefinition);
  });
});
