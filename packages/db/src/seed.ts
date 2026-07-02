// SPDX-License-Identifier: AGPL-3.0-only

import { and, eq } from 'drizzle-orm';
import type { Db } from './client';
import { orgs, schemas } from './schema';
import { usersRepo, schemasRepo, teamsRepo, formsRepo } from './repositories';
import { hashPassword } from './auth/password';
import type { PortalTheme, FormDefinition } from '@tessio/shared';

const DEFAULT_ORG = { name: 'Acme Corp', slug: 'default' };

const HARDWARE_ASSET_DEFINITION = {
  fields: [
    { key: 'name', label: 'Name', type: 'text' as const, required: true, order: 0, width: 'full' as const },
    { key: 'category', label: 'Category', type: 'select' as const, required: false, order: 1, width: 'half' as const,
      config: { options: ['Laptop', 'Desktop', 'Monitor', 'Phone', 'Peripheral', 'Server', 'Other'] } },
    { key: 'manufacturer', label: 'Manufacturer', type: 'text' as const, required: false, order: 2, width: 'half' as const },
    { key: 'model', label: 'Model', type: 'text' as const, required: false, order: 3, width: 'half' as const },
    { key: 'notes', label: 'Notes', type: 'long-text' as const, required: false, order: 4, width: 'full' as const },
  ],
};

const TICKET_TYPES = [
  { key: 'incident', name: 'Incident', fields: [
    { key: 'title', label: 'Title', type: 'text' as const, required: true, order: 0, width: 'full' as const },
    { key: 'description', label: 'Description', type: 'long-text' as const, required: true, order: 1, width: 'full' as const },
    { key: 'category', label: 'Category', type: 'select' as const, required: false, order: 2, width: 'half' as const,
      config: { options: ['Hardware', 'Software', 'Network', 'Email', 'Access', 'Storage', 'Facilities', 'Other'] } },
    { key: 'affected_service', label: 'Affected service', type: 'text' as const, required: false, order: 3, width: 'half' as const },
  ] },
  { key: 'service_request', name: 'Service request', fields: [
    { key: 'title', label: 'Title', type: 'text' as const, required: true, order: 0, width: 'full' as const },
    { key: 'description', label: 'Details', type: 'long-text' as const, required: true, order: 1, width: 'full' as const },
    { key: 'category', label: 'Category', type: 'select' as const, required: false, order: 2, width: 'half' as const,
      config: { options: ['Hardware', 'Software', 'Access', 'Email', 'Other'] } },
    { key: 'cost_center', label: 'Cost center', type: 'text' as const, required: false, order: 3, width: 'half' as const },
  ] },
  { key: 'problem', name: 'Problem', fields: [
    { key: 'title', label: 'Title', type: 'text' as const, required: true, order: 0, width: 'full' as const },
    { key: 'description', label: 'Description', type: 'long-text' as const, required: true, order: 1, width: 'full' as const },
    { key: 'category', label: 'Category', type: 'select' as const, required: false, order: 2, width: 'half' as const,
      config: { options: ['Hardware', 'Software', 'Network', 'Email', 'Access', 'Storage', 'Other'] } },
    { key: 'root_cause', label: 'Root cause', type: 'long-text' as const, required: false, order: 3, width: 'full' as const },
  ] },
  { key: 'change', name: 'Change', fields: [
    { key: 'title', label: 'Title', type: 'text' as const, required: true, order: 0, width: 'full' as const },
    { key: 'description', label: 'Description', type: 'long-text' as const, required: true, order: 1, width: 'full' as const },
    { key: 'risk', label: 'Risk', type: 'select' as const, required: false, order: 2, width: 'half' as const,
      config: { options: ['Low', 'Medium', 'High'] } },
    { key: 'rollback_plan', label: 'Rollback plan', type: 'long-text' as const, required: false, order: 3, width: 'full' as const },
  ] },
];

const ARTICLE_DEFINITION = {
  fields: [
    { key: 'body', label: 'Body', type: 'long-text' as const, required: false, order: 0, width: 'full' as const },
    { key: 'category', label: 'Category', type: 'select' as const, required: false, order: 1, width: 'half' as const,
      config: { options: ['Getting started', 'How-to', 'Troubleshooting', 'Policy', 'FAQ', 'Reference'] } },
    { key: 'tags', label: 'Tags', type: 'multiselect' as const, required: false, order: 2, width: 'half' as const },
  ],
};

/** Idempotently ensure the org has a default published Hardware Asset schema. */
export async function seedAssetSchema(db: Db, orgId: string): Promise<void> {
  const existing = await schemasRepo(db).list(orgId, { kind: 'asset' });
  if (existing.length > 0) return;
  await schemasRepo(db).create({
    orgId,
    kind: 'asset',
    key: 'hardware',
    name: 'Hardware Asset',
    status: 'published',
    definition: HARDWARE_ASSET_DEFINITION,
  });
}

/** Idempotently ensure the org has the standard published ticket types (one row per key). */
export async function seedTicketSchema(db: Db, orgId: string): Promise<void> {
  const existing = await schemasRepo(db).list(orgId, { kind: 'ticket' });
  const haveKeys = new Set(existing.map((s) => s.key));
  for (const t of TICKET_TYPES) {
    if (haveKeys.has(t.key)) continue;
    await schemasRepo(db).create({
      orgId, kind: 'ticket', key: t.key, name: t.name, status: 'published',
      definition: { fields: t.fields },
    });
  }
}

const DEFAULT_FORM_THEME: PortalTheme = {
  accent: '#4f46e5', layout: 'single', bg: 'plain', font: 'sans', showTess: true,
  headline: 'New request', intro: '', success: 'Thanks — your request was received.',
};

const FORM_DEFS: Record<string, { name: string; headline: string; intro: string; categoryKey: string; icon: string }> = {
  change: { name: 'Change', headline: 'Request a change', intro: 'Submit a change request for review and approval.', categoryKey: 'IT', icon: 'refresh' },
  incident: { name: 'Incident', headline: 'Report an incident', intro: 'Tell us what happened so we can resolve it quickly.', categoryKey: 'IT', icon: 'alert' },
  problem: { name: 'Problem', headline: 'Report a problem', intro: 'Help us identify and address the root cause.', categoryKey: 'IT', icon: 'x' },
  service_request: { name: 'Service request', headline: 'Submit a request', intro: 'Request hardware, software, access, or other services.', categoryKey: 'IT', icon: 'ticket' },
};

/** Idempotently ensure the org has default forms for each ticket type. */
export async function seedForms(db: Db, orgId: string): Promise<void> {
  const repo = formsRepo(db);
  const existing = await repo.list(orgId);
  const haveKeys = new Set(existing.map((f) => f.key));
  const schemas = await schemasRepo(db).list(orgId, { kind: 'ticket' });
  const schemaByKey = new Map(schemas.map((s) => [s.key, s]));

  for (const [key, def] of Object.entries(FORM_DEFS)) {
    if (haveKeys.has(key)) continue;
    const schema = schemaByKey.get(key);
    if (!schema) continue;
    const fields = (schema.definition as { fields: { key: string }[] }).fields
      .map((f) => ({ fieldKey: f.key, width: 'full' as const }));
    const definition: FormDefinition = {
      sections: [{ id: 'sec_main', title: 'Details', order: 0, fields }],
    };
    await repo.create({
      orgId, key, name: def.name, categoryKey: def.categoryKey, icon: def.icon,
      targetSchemaId: schema.id, status: 'published',
      theme: { ...DEFAULT_FORM_THEME, headline: def.headline, intro: def.intro },
      definition,
    });
  }
}

/** Remove forms and schemas whose name/key starts with 'Untitled' or 'untitled_form'. */
export async function cleanupUntitled(db: Db, orgId: string): Promise<{ forms: number; schemas: number }> {
  const fRepo = formsRepo(db);
  const allForms = await fRepo.list(orgId);
  let formCount = 0;
  for (const f of allForms) {
    if (f.name.startsWith('Untitled form') || f.key.startsWith('untitled_form')) {
      await fRepo.archive(orgId, f.id);
      formCount++;
    }
  }
  const sRepo = schemasRepo(db);
  const allSchemas = await sRepo.list(orgId, { kind: 'ticket' });
  let schemaCount = 0;
  for (const s of allSchemas) {
    if (s.key.startsWith('untitled_form')) {
      await db.update(schemas).set({ status: 'archived' }).where(and(eq(schemas.orgId, orgId), eq(schemas.id, s.id)));
      schemaCount++;
    }
  }
  return { forms: formCount, schemas: schemaCount };
}

const DEFAULT_TEAMS = ['IT Ops', 'Network', 'Security', 'Facilities', 'Onboarding'];

/** Idempotently ensure the org has the default teams (one row per name). */
export async function seedTeams(db: Db, orgId: string): Promise<void> {
  const existing = await teamsRepo(db).list(orgId);
  const have = new Set(existing.map((t) => t.name));
  for (const name of DEFAULT_TEAMS) {
    if (!have.has(name)) await teamsRepo(db).create({ orgId, name });
  }
}

/** Idempotently ensure the org has a default published Article (kb_article) schema. */
export async function seedKbSchema(db: Db, orgId: string): Promise<void> {
  const existing = await schemasRepo(db).list(orgId, { kind: 'kb_article' });
  if (existing.length > 0) return;
  await schemasRepo(db).create({
    orgId, kind: 'kb_article', key: 'article', name: 'Article',
    status: 'published', definition: ARTICLE_DEFINITION,
  });
}

/** Idempotently ensure the default org and a first admin exist. */
export async function seedAdmin(db: Db, opts: { email: string; password: string; name?: string }) {
  let [org] = await db.select().from(orgs).where(eq(orgs.slug, DEFAULT_ORG.slug));
  if (!org) [org] = await db.insert(orgs).values(DEFAULT_ORG).returning();

  const repo = usersRepo(db);
  const existing = await repo.findByEmail(org.id, opts.email);
  if (existing) return existing;

  return repo.create({
    orgId: org.id,
    email: opts.email,
    name: opts.name ?? 'Admin',
    role: 'admin',
    passwordHash: await hashPassword(opts.password),
  });
}
