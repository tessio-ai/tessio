// SPDX-License-Identifier: AGPL-3.0-only

import { loadEnv } from './load-env';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { createDbClient, aiSettingsRepo, ticketsRepo, usersRepo, ticketAiTriageRepo, ticketEmbeddingsRepo, recordActivity, emailSettingsRepo, slackSettingsRepo, notificationsRepo } from '@tessio/db';
import {
  createTessClient,
  triageTicket,
  embedText,
  decryptSecret,
  applyAiEnvFallback,
  DEFAULT_BOT_NAME,
  type AiSettings,
  type AiProvider,
  type TicketContext,
  type CandidateAgent,
} from '@tessio/ai';
import { EXAMPLE_QUEUE, processExampleJob, type ExampleJobData } from './jobs';
import { AI_TRIAGE_QUEUE, processTriageJob, type TriageJobData, type TriageDeps } from './triage';
import { AI_EMBED_QUEUE, processEmbedJob, type EmbedJobData, type EmbedDeps } from './embed';
import {
  WORKFLOW_EVENTS_QUEUE,
  WORKFLOW_RUNS_QUEUE,
  NOTIFICATIONS_QUEUE,
  EMAIL_SEND_QUEUE,
  EMAIL_POLL_QUEUE,
  SLACK_SEND_QUEUE,
  SCHEDULE_TICK_QUEUE,
  SLA_TICK_QUEUE,
  AGENT_OFFLINE_QUEUE,
  notificationPrefsSchema,
  DEFAULT_NOTIFICATION_PREFS,
  type WorkflowEventJobData,
  type WorkflowRunJobData,
  type NotificationEventJob,
  type EmailSendJob,
  type SlackSendJob,
} from '@tessio/shared';
import { Queue } from 'bullmq';
import { processWorkflowEvent } from './workflows/process-event';
import { buildProcessEventDeps, processRunJob } from './workflows/wire';
import { processNotificationEvent, type NotifyDeps } from './notifications/process';
import { processEmailSend, type SendDeps } from './email/send';
import { createMailer } from './email/mailer';
import { processSlackSend } from './slack/send';
import { buildSlackSendDeps } from './slack/wire';
import { diskStorage } from './storage';
import { listInboundOrgs, buildOrgPollDeps } from './email/wire';
import { pollOrgInbound } from './email/poll';
import { runScheduleTick } from './schedule/tick';
import { buildScheduleDeps } from './schedule/wire';
import { runSlaTick } from './sla/tick';
import { buildSlaDeps } from './sla/wire';
import { runAgentOfflineTick } from './agent/tick';
import { buildAgentOfflineDeps } from './agent/wire';

// Load a local .env (dev convenience) before reading any process.env value.
loadEnv();

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
const db = createDbClient(process.env.DATABASE_URL ?? 'postgres://tessio:tessio@localhost:5432/tessio');

function secretKey(): string {
  const k = process.env.TESSIO_SECRET_KEY;
  if (!k) throw new Error('TESSIO_SECRET_KEY is not set');
  return k;
}

async function loadSettings(orgId: string): Promise<AiSettings> {
  const row = await aiSettingsRepo(db).getOrCreate(orgId);
  return applyAiEnvFallback({
    enabled: row.enabled,
    provider: row.provider as AiProvider,
    baseUrl: row.baseUrl,
    model: row.model,
    embeddingModel: row.embeddingModel,
    apiKey: row.apiKeyCiphertext ? decryptSecret(row.apiKeyCiphertext, secretKey()) : null,
    botName: row.botName?.trim() || DEFAULT_BOT_NAME,
    features: row.features,
  });
}

const triageDeps: TriageDeps = {
  loadSettings,
  loadTicket: async (orgId, ticketId): Promise<TicketContext | undefined> => {
    const t = await ticketsRepo(db).getById(orgId, ticketId);
    if (!t) return undefined;
    const data = (t.data ?? {}) as Record<string, unknown>;
    return {
      number: t.number as number,
      title: (data.title as string) ?? '',
      description: (data.description as string) ?? '',
      category: (data.category as string) ?? null,
    };
  },
  loadCandidates: async (orgId): Promise<CandidateAgent[]> =>
    (await usersRepo(db).list(orgId)).filter((u) => u.role !== 'requester').map((u) => ({ id: u.id, name: u.name })),
  runTriage: (settings, ticket, candidates) =>
    triageTicket({ model: createTessClient(settings), ticket, candidateAgents: candidates, botName: settings.botName }),
  saveTriage: async (input) => { await ticketAiTriageRepo(db).upsert(input); },
  recordTriaged: async (orgId, ticketId) => {
    await recordActivity(db, { orgId, recordType: 'ticket', recordId: ticketId, eventType: 'tess.triaged' });
  },
};

const embedDeps: EmbedDeps = {
  loadSettings,
  loadTicketText: async (orgId, ticketId) => {
    const t = await ticketsRepo(db).getById(orgId, ticketId);
    if (!t) return undefined;
    const data = (t.data ?? {}) as Record<string, unknown>;
    return { title: (data.title as string) ?? '', description: (data.description as string) ?? '' };
  },
  getExistingHash: async (ticketId) => (await ticketEmbeddingsRepo(db).get(ticketId))?.contentHash ?? null,
  embed: (settings, text) => embedText({ apiKey: settings.apiKey as string, model: settings.embeddingModel, baseUrl: settings.baseUrl, text }),
  saveEmbedding: async (input) => { await ticketEmbeddingsRepo(db).upsert(input); },
};

const RUNNER_URL = process.env.RUNNER_URL ?? 'http://localhost:3100';

// Trigger matching enqueues runs onto the runs queue consumed below.
const workflowRunsQueue = new Queue<WorkflowRunJobData>(WORKFLOW_RUNS_QUEUE, { connection });
const workflowEventDeps = buildProcessEventDeps(db, async (orgId, runId) => {
  await workflowRunsQueue.add('run', { orgId, runId }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
});

const emailSendQueue = new Queue<EmailSendJob>(EMAIL_SEND_QUEUE, { connection, defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } } });
const slackSendQueue = new Queue<SlackSendJob>(SLACK_SEND_QUEUE, { connection, defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } } });

function buildNotifyDeps(emailQueue: Queue<EmailSendJob>, slackQueue: Queue<SlackSendJob>): NotifyDeps {
  return {
    loadTicket: async (orgId, ticketId) => {
      const t = await ticketsRepo(db).getById(orgId, ticketId);
      if (!t) return null;
      const data = (t.data ?? {}) as Record<string, unknown>;
      return {
        id: t.id as string,
        number: t.number as number,
        title: (data.title as string) ?? '',
        requesterId: (t.requesterId as string | null) ?? null,
        assigneeId: (t.assigneeId as string | null) ?? null,
      };
    },
    loadPrefs: async (orgId, userIds) => {
      const result: Record<string, import('@tessio/shared').NotificationPrefs> = {};
      await Promise.all(
        userIds.map(async (userId) => {
          const u = await usersRepo(db).findById(userId);
          if (!u) return;
          const parsed = notificationPrefsSchema.safeParse(u.notificationPrefs);
          result[userId] = parsed.success ? parsed.data : DEFAULT_NOTIFICATION_PREFS;
        }),
      );
      return result;
    },
    loadEmail: async (userId) => {
      const u = await usersRepo(db).findById(userId);
      return u?.email ?? null;
    },
    createNotifications: async (rows) => {
      await notificationsRepo(db).createMany(rows);
    },
    enqueueEmail: async (job) => {
      await emailQueue.add('send', job);
    },
    orgEmailEnabled: async (orgId) => {
      const row = await emailSettingsRepo(db).getOrCreate(orgId);
      return row?.enabled ?? false;
    },
    fromDomain: async (orgId) => {
      const row = await emailSettingsRepo(db).getOrCreate(orgId);
      const addr = row?.fromAddress;
      if (!addr) return 'localhost';
      const at = addr.indexOf('@');
      return at >= 0 ? addr.slice(at + 1) : 'localhost';
    },
    orgSlack: async (orgId) => {
      const row = await slackSettingsRepo(db).getOrCreate(orgId);
      if (!row?.enabled || !row.webhookUrlCiphertext) return null;
      return {
        created: row.notifyCreated,
        assigned: row.notifyAssigned,
        status: row.notifyStatus,
        commented: row.notifyCommented,
      };
    },
    enqueueSlack: async (job) => {
      await slackQueue.add('send', job);
    },
    siteUrl: process.env.TESSIO_SITE_URL ?? 'http://localhost',
  };
}

function buildSendDeps(): SendDeps {
  return {
    loadMailer: async (orgId) => {
      const row = await emailSettingsRepo(db).getOrCreate(orgId);
      if (!row?.enabled || !row.smtpHost || !row.fromAddress) return null;
      const secretKey = process.env.TESSIO_SECRET_KEY;
      const pass = row.smtpPasswordCiphertext && secretKey
        ? decryptSecret(row.smtpPasswordCiphertext, secretKey)
        : undefined;
      return createMailer({
        host: row.smtpHost,
        port: row.smtpPort ?? 587,
        secure: row.smtpSecure ?? true,
        user: row.smtpUser ?? undefined,
        pass,
        fromName: row.fromName ?? undefined,
        fromAddress: row.fromAddress,
        replyTo: row.replyTo ?? undefined,
      });
    },
  };
}

const exampleWorker = new Worker<ExampleJobData>(EXAMPLE_QUEUE, async (job) => processExampleJob(job.data), { connection });
const triageWorker = new Worker<TriageJobData>(AI_TRIAGE_QUEUE, async (job) => processTriageJob(job.data, triageDeps), { connection });
const embedWorker = new Worker<EmbedJobData>(AI_EMBED_QUEUE, async (job) => processEmbedJob(job.data, embedDeps), { connection });
const workflowEventsWorker = new Worker<WorkflowEventJobData>(
  WORKFLOW_EVENTS_QUEUE,
  async (job) => void (await processWorkflowEvent(job.data, workflowEventDeps)),
  { connection },
);
const workflowRunsWorker = new Worker<WorkflowRunJobData>(
  WORKFLOW_RUNS_QUEUE,
  async (job) => processRunJob(db, job.data, RUNNER_URL),
  { connection },
);
const notificationsWorker = new Worker<NotificationEventJob>(
  NOTIFICATIONS_QUEUE,
  async (job) => processNotificationEvent(job.data, buildNotifyDeps(emailSendQueue, slackSendQueue)),
  { connection },
);
const emailSendWorker = new Worker<EmailSendJob>(
  EMAIL_SEND_QUEUE,
  async (job) => processEmailSend(job.data, buildSendDeps()),
  { connection },
);
const slackSendWorker = new Worker<SlackSendJob>(
  SLACK_SEND_QUEUE,
  async (job) => processSlackSend(job.data, buildSlackSendDeps(db)),
  { connection },
);

// IMAP inbound poll — runs on a repeatable schedule.
const storage = diskStorage(process.env.TESSIO_STORAGE_DIR ?? './.storage');
const emailPollQueue = new Queue(EMAIL_POLL_QUEUE, { connection });

const emailPollWorker = new Worker(
  EMAIL_POLL_QUEUE,
  async () => {
    const orgIds = await listInboundOrgs(db);
    await Promise.allSettled(
      orgIds.map(async (orgId) => {
        try {
          const deps = await buildOrgPollDeps(db, storage, connection, orgId);
          if (!deps) return;
          await pollOrgInbound(orgId, deps);
        } catch (err) {
          console.error(`email poll failed for org ${orgId}`, err);
        }
      }),
    );
  },
  { connection },
);

// Schedule the repeatable poll job on startup.
void emailPollQueue.add('poll', {}, { repeat: { every: Number(process.env.EMAIL_POLL_INTERVAL_MS ?? 60000) } });

// Schedule tick — fires scheduled workflow runs.
const scheduleTickQueue = new Queue(SCHEDULE_TICK_QUEUE, { connection });
const scheduleTickWorker = new Worker(
  SCHEDULE_TICK_QUEUE,
  async () => runScheduleTick(buildScheduleDeps(db, workflowRunsQueue)),
  { connection },
);
void scheduleTickQueue.add('tick', {}, { repeat: { every: Number(process.env.SCHEDULE_TICK_INTERVAL_MS ?? 60000) } });

// SLA tick — stamps breaches and sends notifications.
const slaTickQueue = new Queue(SLA_TICK_QUEUE, { connection });
const slaTickWorker = new Worker(
  SLA_TICK_QUEUE,
  async () => runSlaTick(buildSlaDeps(db, {
    enqueue: async (job) => { await slackSendQueue.add('send', job); },
    siteUrl: process.env.TESSIO_SITE_URL ?? 'http://localhost',
  })),
  { connection },
);
void slaTickQueue.add('tick', {}, { repeat: { every: Number(process.env.SLA_TICK_INTERVAL_MS ?? 60000) } });

// Agent offline tick — flips devices with no recent heartbeat to offline.
const agentOfflineQueue = new Queue(AGENT_OFFLINE_QUEUE, { connection });
const agentOfflineWorker = new Worker(AGENT_OFFLINE_QUEUE, async () => runAgentOfflineTick(buildAgentOfflineDeps(db)), { connection });
void agentOfflineQueue.add('tick', {}, { repeat: { every: Number(process.env.AGENT_OFFLINE_TICK_INTERVAL_MS ?? 60000) } });

exampleWorker.on('ready', () => console.log(`worker listening on queue "${EXAMPLE_QUEUE}"`));
triageWorker.on('ready', () => console.log(`worker listening on queue "${AI_TRIAGE_QUEUE}"`));
embedWorker.on('ready', () => console.log(`worker listening on queue "${AI_EMBED_QUEUE}"`));
workflowEventsWorker.on('ready', () => console.log(`worker listening on queue "${WORKFLOW_EVENTS_QUEUE}"`));
workflowRunsWorker.on('ready', () => console.log(`worker listening on queue "${WORKFLOW_RUNS_QUEUE}"`));
notificationsWorker.on('ready', () => console.log(`worker listening on queue "${NOTIFICATIONS_QUEUE}"`));
emailSendWorker.on('ready', () => console.log(`worker listening on queue "${EMAIL_SEND_QUEUE}"`));
slackSendWorker.on('ready', () => console.log(`worker listening on queue "${SLACK_SEND_QUEUE}"`));
emailPollWorker.on('ready', () => console.log(`worker listening on queue "${EMAIL_POLL_QUEUE}"`));
scheduleTickWorker.on('ready', () => console.log(`worker listening on queue "${SCHEDULE_TICK_QUEUE}"`));
slaTickWorker.on('ready', () => console.log(`worker listening on queue "${SLA_TICK_QUEUE}"`));
agentOfflineWorker.on('ready', () => console.log(`worker listening on queue "${AGENT_OFFLINE_QUEUE}"`));
for (const w of [exampleWorker, triageWorker, embedWorker, workflowEventsWorker, workflowRunsWorker, notificationsWorker, emailSendWorker, slackSendWorker, emailPollWorker, scheduleTickWorker, slaTickWorker, agentOfflineWorker]) {
  w.on('failed', (job, err) => console.error(`job ${job?.id} failed`, err));
  w.on('error', (err) => console.error('worker error', err));
}
