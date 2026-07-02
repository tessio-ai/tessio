// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { orgs, schemas, users, sessions, userRole, forms, portalSettings, formStatus } from './schema';

describe('db schema', () => {
  it('orgs has the expected columns', () => {
    const cols = getTableConfig(orgs).columns.map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(['id', 'name', 'slug', 'created_at']));
  });

  it('schemas pins a type with unique(org_id, kind, key, version)', () => {
    const { uniqueConstraints } = getTableConfig(schemas);
    const cols = uniqueConstraints[0].columns.map((c) => c.name);
    expect(cols).toEqual(['org_id', 'kind', 'key', 'version']);
  });

  it('schemas carries the JSONB definition column', () => {
    const cols = getTableConfig(schemas).columns.map((c) => c.name);
    expect(cols).toContain('definition');
  });
});

describe('auth schema', () => {
  it('defines the users table with a role enum', () => {
    expect(users).toBeDefined();
    expect(userRole.enumValues).toEqual(['admin', 'agent', 'requester']);
  });
  it('defines the sessions table', () => {
    expect(sessions).toBeDefined();
  });
});

describe('forms schema', () => {
  it('defines the forms table with a status enum', () => {
    expect(forms).toBeDefined();
    expect(formStatus.enumValues).toEqual(['draft', 'published', 'archived']);
  });
  it('defines the portal_settings table', () => {
    expect(portalSettings).toBeDefined();
  });
});
