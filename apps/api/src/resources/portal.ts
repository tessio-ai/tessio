// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { formsRepo, schemasRepo, portalSettingsRepo, ticketsRepo, kbArticlesRepo } from '@tessio/db';
import type { SchemaDefinition, FormDefinition } from '@tessio/shared';
import { compileFieldSchema } from '@tessio/shared';
import { notFound, badRequest } from '../errors';

const keyParam = z.object({ key: z.string().min(1) });
const kbIdParam = z.object({ id: z.string().uuid() });
const anyResponse = z.record(z.unknown());
const submitBody = z.object({ values: z.record(z.unknown()) });

type KbRow = { id: string; title: string | null; slug: string | null; updatedAt: Date | string; data: Record<string, unknown>; status?: string };

/** Derive a plain-text preview from a markdown body when no explicit excerpt is stored. */
const bodyExcerpt = (body: unknown, max = 200): string => {
  if (typeof body !== 'string') return '';
  const text = body
    .replace(/^#{1,6}\s+.*$/gm, '') // drop heading lines
    .replace(/[*_`>#~-]/g, '') // strip common markdown punctuation
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim();
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text;
};

const toSummary = (a: KbRow) => ({
  id: a.id, title: a.title ?? 'Untitled', slug: a.slug ?? '',
  category: (a.data.category as string) ?? '',
  categoryGroup: (a.data.categoryGroup as string) ?? 'IT',
  tags: (a.data.tags as string[]) ?? [],
  excerpt: (a.data.excerpt as string) || bodyExcerpt(a.data.body),
  readMin: (a.data.readMin as number) ?? 0,
  updatedAt: String(a.updatedAt),
});
const toFull = (a: KbRow) => ({
  id: a.id, title: a.title ?? 'Untitled', slug: a.slug ?? '',
  category: (a.data.category as string) ?? '',
  categoryGroup: (a.data.categoryGroup as string) ?? 'IT',
  tags: (a.data.tags as string[]) ?? [],
  body: (a.data.body as unknown[]) ?? [],
  tldr: (a.data.tldr as string[]) ?? [],
  relatedArticles: (a.data.relatedArticles as string[]) ?? [],
  linkedForm: (a.data.linkedForm as string) ?? '',
  readMin: (a.data.readMin as number) ?? 0,
  authorId: null,
  updatedAt: String(a.updatedAt),
});

type SubmissionResult = { ok: true; values: Record<string, unknown> } | { ok: false; errors: string[] };

function validateSubmission(values: Record<string, unknown>, schemaDef: SchemaDefinition, formDef: FormDefinition): SubmissionResult {
  const refs = formDef.sections.flatMap((s) => s.fields);
  const exposedKeys = refs.map((r) => r.fieldKey);
  const fieldByKey = new Map(schemaDef.fields.map((f) => [f.key, f]));

  const narrowed: Record<string, unknown> = {};
  for (const key of exposedKeys) if (values[key] !== undefined) narrowed[key] = values[key];

  const shape: Record<string, z.ZodTypeAny> = {};
  for (const key of exposedKeys) {
    const f = fieldByKey.get(key);
    if (f) shape[key] = compileFieldSchema(f);
  }
  const parsed = z.object(shape).safeParse(narrowed);

  const errors: string[] = [];
  if (!parsed.success) for (const issue of parsed.error.issues) errors.push(`${issue.path.join('.') || 'field'}: ${issue.message}`);
  for (const ref of refs) {
    if (ref.requiredAtIntake) {
      const v = narrowed[ref.fieldKey];
      const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
      if (empty) errors.push(`${ref.fieldKey}: required`);
    }
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, values: parsed.success ? (parsed.data as Record<string, unknown>) : narrowed };
}

type PortalForm = { theme: unknown; definition: FormDefinition; name: string; key: string; categoryKey: string; icon: string | null };

/** Resolve each form field ref against the target schema field (type/label/options/validation). */
function resolveForm(form: PortalForm, schemaDef: SchemaDefinition) {
  const byKey = new Map(schemaDef.fields.map((f) => [f.key, f]));
  const sections = form.definition.sections
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      id: s.id,
      title: s.title,
      fields: s.fields
        .map((ref) => {
          const sf = byKey.get(ref.fieldKey);
          if (!sf) return null;
          const config = (sf.config ?? {}) as Record<string, unknown>;
          return {
            key: sf.key,
            label: sf.label,
            type: sf.type,
            options: config.options,
            config,
            validation: sf.validation ?? {},
            required: sf.required || ref.requiredAtIntake === true,
            width: ref.width,
            placeholder: ref.placeholder,
            help: ref.help,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    }));
  return { key: form.key, name: form.name, categoryKey: form.categoryKey, icon: form.icon, theme: form.theme, sections };
}

/** Public (any authenticated role) portal reads. */
export function registerPortalRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/portal/settings', { schema: { response: { 200: anyResponse } } }, async (req) => {
    return portalSettingsRepo(db).getOrCreate(req.orgId);
  });

  r.get('/portal/forms', { schema: { response: { 200: z.array(anyResponse) } } }, async (req) => {
    const published = await formsRepo(db).listPublished(req.orgId);
    return published.map((f) => ({ key: f.key, name: f.name, description: f.description, categoryKey: f.categoryKey, icon: f.icon, theme: f.theme }));
  });

  r.get('/portal/forms/:key', { schema: { params: keyParam, response: { 200: anyResponse } } }, async (req) => {
    const { key } = req.params as z.infer<typeof keyParam>;
    const form = await formsRepo(db).findByKey(req.orgId, key);
    if (!form || form.status !== 'published') throw notFound(`form ${key} not found`);
    const schema = await schemasRepo(db).getById(req.orgId, form.targetSchemaId);
    if (!schema) throw notFound(`form ${key} not found`);
    return resolveForm(form as PortalForm, schema.definition as SchemaDefinition);
  });

  r.post('/portal/forms/:key/submit', { schema: { params: keyParam, body: submitBody, response: { 201: anyResponse } } }, async (req, reply) => {
    const { key } = req.params as z.infer<typeof keyParam>;
    const form = await formsRepo(db).findByKey(req.orgId, key);
    if (!form || form.status !== 'published') throw notFound(`form ${key} not found`);
    const schema = await schemasRepo(db).getById(req.orgId, form.targetSchemaId);
    if (!schema) throw notFound(`form ${key} not found`);

    const result = validateSubmission((req.body as z.infer<typeof submitBody>).values, schema.definition as SchemaDefinition, form.definition as FormDefinition);
    if (!result.ok) throw badRequest(result.errors.join('; '));

    const ticket = await ticketsRepo(db).create({
      orgId: req.orgId,
      schemaId: form.targetSchemaId,
      schemaVersion: schema.version,
      requesterId: req.user.id,
      formId: form.id,
      data: result.values,
      status: 'open',
    });
    reply.code(201);
    return { id: ticket.id, number: ticket.number };
  });

  r.get('/portal/kb', { schema: { response: { 200: z.array(anyResponse) } } }, async (req) => {
    const { rows } = await kbArticlesRepo(db).query(req.orgId, {
      filter: { field: 'status', op: 'eq', value: 'published' },
      sort: { field: 'updatedAt', dir: 'desc', type: 'date' }, limit: 200,
    });
    return rows.map((a) => toSummary(a as KbRow));
  });

  r.get('/portal/kb/:id', { schema: { params: kbIdParam, response: { 200: anyResponse } } }, async (req) => {
    const { id } = req.params as z.infer<typeof kbIdParam>;
    const row = await kbArticlesRepo(db).getById(req.orgId, id);
    if (!row || (row as KbRow).status !== 'published') throw notFound(`article ${id} not found`);
    return toFull(row as KbRow);
  });
}
