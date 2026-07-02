// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db, RecordKind } from '@tessio/db';
import { attachmentsRepo, ticketsRepo } from '@tessio/db';
import { notFound, badRequest, payloadTooLarge, unsupportedMediaType } from '../errors';
import type { Storage } from '../storage/storage';
import { requireRole } from '../auth/require-role';

const BLOCKED_MIME = new Set([
  'application/x-msdownload', 'application/x-msdos-program', 'application/x-executable',
  'application/x-sh', 'application/x-bat', 'application/x-msi', 'application/vnd.microsoft.portable-executable',
]);
const idParam = z.object({ id: z.string().uuid() });
const attachmentOut = z.object({
  id: z.string(), filename: z.string(), size: z.number(), mime: z.string(),
  uploadedBy: z.string().nullable(), createdAt: z.coerce.string(),
});
type Row = { id: string; filename: string; size: number; mime: string; uploadedBy: string | null; createdAt: Date | string; recordType?: string; recordId?: string; storageKey?: string };
const safe = (a: Row) => ({ id: a.id, filename: a.filename, size: a.size, mime: a.mime, uploadedBy: a.uploadedBy, createdAt: String(a.createdAt) });

async function assertTicketAccess(db: Db, ticketScoped: boolean, orgId: string, recordId: string, user: { id: string; role: string }) {
  if (!ticketScoped || user.role !== 'requester') return;
  const row = await ticketsRepo(db).getById(orgId, recordId);
  if (!row || row.requesterId !== user.id) throw notFound(`tickets ${recordId} not found`);
}

/** POST/GET /:segment/:id/attachments for one record kind. Multipart upload + list. */
export function registerAttachmentRoutes(app: FastifyInstance, db: Db, storage: Storage, segment: string, kind: RecordKind): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const ticketScoped = kind === 'ticket';

  r.post(`/${segment}/:id/attachments`, { schema: { params: idParam } }, async (req, reply) => {
    const { id } = req.params as z.infer<typeof idParam>;
    await assertTicketAccess(db, ticketScoped, req.orgId, id, req.user);
    const data = await (req as unknown as { file: () => Promise<{ filename: string; mimetype: string; toBuffer: () => Promise<Buffer>; file: { truncated: boolean } } | undefined> }).file();
    if (!data) throw badRequest('No file uploaded');
    if (BLOCKED_MIME.has(data.mimetype)) throw unsupportedMediaType(`File type ${data.mimetype} is not allowed`);
    let buf: Buffer;
    try { buf = await data.toBuffer(); } catch { throw payloadTooLarge('File exceeds the 10 MB limit'); }
    if (data.file.truncated) throw payloadTooLarge('File exceeds the 10 MB limit');
    const attachmentId = crypto.randomUUID();
    const storageKey = `${req.orgId}/${attachmentId}`;
    await storage.put(storageKey, buf);
    const row = await attachmentsRepo(db).create({
      id: attachmentId, orgId: req.orgId, recordType: kind, recordId: id,
      filename: data.filename, size: buf.length, mime: data.mimetype, storageKey, uploadedBy: req.user.id,
    });
    reply.code(201);
    return safe(row as Row);
  });

  r.get(`/${segment}/:id/attachments`, { schema: { params: idParam, response: { 200: z.array(attachmentOut) } } }, async (req) => {
    const { id } = req.params as z.infer<typeof idParam>;
    await assertTicketAccess(db, ticketScoped, req.orgId, id, req.user);
    const rows = await attachmentsRepo(db).list(req.orgId, kind, id);
    return rows.map((a) => safe(a as Row));
  });
}

/** GET/DELETE /attachments/:id — download (access-checked) + delete (staff). */
export function registerAttachmentByIdRoutes(app: FastifyInstance, db: Db, storage: Storage): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(`/attachments/:id`, { schema: { params: idParam } }, async (req, reply) => {
    const { id } = req.params as z.infer<typeof idParam>;
    const row = await attachmentsRepo(db).findById(req.orgId, id);
    if (!row) throw notFound(`attachments ${id} not found`);
    await assertTicketAccess(db, row.recordType === 'ticket', req.orgId, row.recordId as string, req.user);
    let buf: Buffer;
    try {
      buf = await storage.get(row.storageKey as string);
    } catch {
      // The metadata row exists but the bytes are gone (ops incident or a partial delete).
      throw notFound(`attachments ${id} file is missing`);
    }
    reply.header('content-type', row.mime as string);
    reply.header('content-disposition', `attachment; filename="${(row.filename as string).replace(/["\\]/g, '')}"`);
    return reply.send(buf);
  });

  r.delete(`/attachments/:id`, { preHandler: requireRole('agent', 'admin'), schema: { params: idParam, response: { 204: z.null() } } }, async (req, reply) => {
    const { id } = req.params as z.infer<typeof idParam>;
    const row = await attachmentsRepo(db).findById(req.orgId, id);
    if (!row) throw notFound(`attachments ${id} not found`);
    // Remove the metadata row first: an orphaned blob is cheaper to reconcile than a row pointing at missing bytes.
    await attachmentsRepo(db).remove(req.orgId, id);
    await storage.delete(row.storageKey as string);
    reply.code(204);
    return null;
  });
}
