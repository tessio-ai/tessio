// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import type { Db } from '@tessio/db';
import { emailSettingsRepo } from '@tessio/db';
import { encryptSecret, decryptSecret } from '@tessio/ai';
import { emailSettingsInput } from '@tessio/shared';
import { requireSecretKey } from '../ai/secret';
import { ApiError } from '../errors';
import { recordAudit, safeMeta } from '../audit';

/** Connect/greeting/socket timeout for the SMTP & IMAP "test" buttons, so a bad host
 *  fails in seconds instead of hanging on the library defaults (~2 min). */
const SMTP_TEST_TIMEOUT_MS = Number(process.env.EMAIL_TEST_TIMEOUT_MS ?? 12000);

const settingsResponse = z.object({
  orgId: z.string(),
  enabled: z.boolean(),
  smtpHost: z.string().nullable(),
  smtpPort: z.number().nullable(),
  smtpSecure: z.boolean(),
  smtpUser: z.string().nullable(),
  smtpConfigured: z.boolean(),
  fromName: z.string().nullable(),
  fromAddress: z.string().nullable(),
  replyTo: z.string().nullable(),
  inboundEnabled: z.boolean(),
  imapHost: z.string().nullable(),
  imapPort: z.number().nullable(),
  imapSecure: z.boolean(),
  imapUser: z.string().nullable(),
  imapConfigured: z.boolean(),
  mailbox: z.string(),
  acceptNewSenders: z.boolean(),
  defaultSchemaId: z.string().nullable(),
  defaultTeamId: z.string().nullable(),
});

type EmailSettingsRow = Awaited<ReturnType<ReturnType<typeof emailSettingsRepo>['getOrCreate']>>;

function present(row: NonNullable<EmailSettingsRow>) {
  return {
    orgId: row.orgId,
    enabled: row.enabled,
    smtpHost: row.smtpHost ?? null,
    smtpPort: row.smtpPort ?? null,
    smtpSecure: row.smtpSecure,
    smtpUser: row.smtpUser ?? null,
    smtpConfigured: !!row.smtpPasswordCiphertext,
    fromName: row.fromName ?? null,
    fromAddress: row.fromAddress ?? null,
    replyTo: row.replyTo ?? null,
    inboundEnabled: row.inboundEnabled,
    imapHost: row.imapHost ?? null,
    imapPort: row.imapPort ?? null,
    imapSecure: row.imapSecure,
    imapUser: row.imapUser ?? null,
    imapConfigured: !!row.imapPasswordCiphertext,
    mailbox: row.mailbox,
    acceptNewSenders: row.acceptNewSenders,
    defaultSchemaId: row.defaultSchemaId ?? null,
    defaultTeamId: row.defaultTeamId ?? null,
  };
}

/** Admin-only email settings. Caller must be guarded by requireRole('admin'). */
export function registerEmailSettingsRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const repo = emailSettingsRepo(db);

  r.get('/email-settings', { schema: { response: { 200: settingsResponse } } }, async (req) => {
    return present(await repo.getOrCreate(req.orgId));
  });

  r.put('/email-settings', { schema: { body: emailSettingsInput, response: { 200: settingsResponse } } }, async (req) => {
    const existing = await repo.getOrCreate(req.orgId);
    const body = req.body;
    const secretKey = requireSecretKey();
    const patch: Record<string, unknown> = { updatedBy: req.user.id };

    if (body.enabled !== undefined) patch.enabled = body.enabled;
    if (body.smtpHost !== undefined) patch.smtpHost = body.smtpHost;
    if (body.smtpPort !== undefined) patch.smtpPort = body.smtpPort;
    if (body.smtpSecure !== undefined) patch.smtpSecure = body.smtpSecure;
    if (body.smtpUser !== undefined) patch.smtpUser = body.smtpUser;
    if (body.smtpPassword) {
      patch.smtpPasswordCiphertext = encryptSecret(body.smtpPassword, secretKey);
    }
    if (body.fromName !== undefined) patch.fromName = body.fromName;
    if (body.fromAddress !== undefined) patch.fromAddress = body.fromAddress;
    if (body.replyTo !== undefined) patch.replyTo = body.replyTo;
    if (body.inboundEnabled !== undefined) patch.inboundEnabled = body.inboundEnabled;
    if (body.imapHost !== undefined) patch.imapHost = body.imapHost;
    if (body.imapPort !== undefined) patch.imapPort = body.imapPort;
    if (body.imapSecure !== undefined) patch.imapSecure = body.imapSecure;
    if (body.imapUser !== undefined) patch.imapUser = body.imapUser;
    if (body.imapPassword) {
      patch.imapPasswordCiphertext = encryptSecret(body.imapPassword, secretKey);
    }
    if (body.mailbox !== undefined) patch.mailbox = body.mailbox;
    if (body.acceptNewSenders !== undefined) patch.acceptNewSenders = body.acceptNewSenders;
    if (body.defaultSchemaId !== undefined) patch.defaultSchemaId = body.defaultSchemaId;
    if (body.defaultTeamId !== undefined) patch.defaultTeamId = body.defaultTeamId;

    // Guard: inbound cannot be enabled without a default ticket type.
    const effectiveInboundEnabled = patch.inboundEnabled !== undefined ? patch.inboundEnabled : existing.inboundEnabled;
    const effectiveDefaultSchemaId = patch.defaultSchemaId !== undefined ? patch.defaultSchemaId : existing.defaultSchemaId;
    if (effectiveInboundEnabled && !effectiveDefaultSchemaId) {
      throw new ApiError(400, 'Missing Default Ticket Type', 'A default ticket type (defaultSchemaId) is required when inbound email is enabled.');
    }

    const updated = await repo.update(req.orgId, patch);
    void recordAudit(db, { orgId: req.orgId, actorId: req.user.id, actorEmail: req.user.email, action: 'settings.email.updated', metadata: safeMeta(req.body as Record<string, unknown>, ['enabled', 'inboundEnabled', 'autoCreateUsers', 'acceptNewSenders']), ip: req.ip });
    return present(updated);
  });

  r.post('/email-settings/test-smtp', { schema: { response: { 200: z.object({ ok: z.boolean() }) } } }, async (req) => {
    const row = await repo.getOrCreate(req.orgId);
    if (!row.smtpHost || !row.smtpPasswordCiphertext) {
      throw new ApiError(400, 'SMTP Not Configured', 'Configure SMTP host and password before testing.');
    }
    const password = decryptSecret(row.smtpPasswordCiphertext, requireSecretKey());
    const transporter = nodemailer.createTransport({
      host: row.smtpHost,
      port: row.smtpPort ?? 587,
      secure: row.smtpSecure,
      auth: row.smtpUser ? { user: row.smtpUser, pass: password } : undefined,
      // Fail fast instead of hanging on nodemailer's ~2-minute defaults when the host is unreachable.
      connectionTimeout: SMTP_TEST_TIMEOUT_MS,
      greetingTimeout: SMTP_TEST_TIMEOUT_MS,
      socketTimeout: SMTP_TEST_TIMEOUT_MS,
    });
    try {
      await transporter.sendMail({
        from: row.fromAddress ? `${row.fromName ?? ''} <${row.fromAddress}>`.trim() : undefined,
        to: req.user.email,
        subject: 'Tessio SMTP test',
        text: 'Your SMTP configuration is working correctly.',
      });
      return { ok: true };
    } catch (err) {
      throw new ApiError(400, 'SMTP Test Failed', (err as Error).message);
    }
  });

  r.post(
    '/email-settings/test-imap',
    { schema: { response: { 200: z.object({ ok: z.boolean(), messageCount: z.number() }) } } },
    async (req) => {
      const row = await repo.getOrCreate(req.orgId);
      if (!row.imapHost || !row.imapPasswordCiphertext) {
        throw new ApiError(400, 'IMAP Not Configured', 'Configure IMAP host and password before testing.');
      }
      const password = decryptSecret(row.imapPasswordCiphertext, requireSecretKey());
      const client = new ImapFlow({
        host: row.imapHost,
        port: row.imapPort ?? 993,
        secure: row.imapSecure ?? true,
        auth: { user: row.imapUser ?? '', pass: password },
        logger: false,
        // Fail fast instead of hanging when the host is unreachable.
        connectionTimeout: SMTP_TEST_TIMEOUT_MS,
        greetingTimeout: SMTP_TEST_TIMEOUT_MS,
        socketTimeout: SMTP_TEST_TIMEOUT_MS,
      });
      try {
        await client.connect();
        let messageCount = 0;
        const lock = await client.getMailboxLock(row.mailbox);
        try {
          const mbox = client.mailbox;
          messageCount = mbox !== false ? (mbox.exists ?? 0) : 0;
        } finally {
          lock.release();
        }
        await client.logout();
        return { ok: true, messageCount };
      } catch (err) {
        try { await client.logout(); } catch { /* ignore */ }
        throw new ApiError(400, 'IMAP Test Failed', (err as Error).message);
      }
    },
  );
}
