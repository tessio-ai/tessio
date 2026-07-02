// SPDX-License-Identifier: AGPL-3.0-only

export interface CompactTicket {
  number: number | null;
  title: string;
  status: string | null;
  priority: string | null;
  assigned: boolean;
  dueAt: string | null;
  category: string | null;
}

/** Precomputed ISO date boundaries so the model never has to do date math itself. */
export interface DateAnchors {
  now: string;
  startOfToday: string;
  startOfWeek: string; // Monday 00:00 UTC
  startOfMonth: string;
  sevenDaysAgo: string;
  thirtyDaysAgo: string;
}

/** Pure: derive the date anchors (UTC) from the current ISO timestamp. */
export function dateAnchors(nowIso: string): DateAnchors {
  const now = new Date(nowIso);
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = now.getUTCDay(); // 0=Sun..6=Sat
  const sinceMonday = dow === 0 ? 6 : dow - 1;
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setUTCDate(startOfToday.getUTCDate() - sinceMonday);
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return {
    now: nowIso,
    startOfToday: startOfToday.toISOString(),
    startOfWeek: startOfWeek.toISOString(),
    startOfMonth: startOfMonth.toISOString(),
    sevenDaysAgo: new Date(now.getTime() - 7 * 86_400_000).toISOString(),
    thirtyDaysAgo: new Date(now.getTime() - 30 * 86_400_000).toISOString(),
  };
}

const FIELD_GUIDE = `Allowed fields (use these names exactly):
- status — one of EXACTLY: open, new, in_progress, pending, on_hold, resolved, closed. Nothing else is a status.
- priority — one of EXACTLY: low, medium, high, urgent.
- data.category — the ticket's category/type. Words describing the KIND of ticket ("hardware", "software", "access", "network", "vpn", "printer", "billing", etc.) go HERE, never in status. Match it with "contains" (case-insensitive) — do not assume exact casing.
- assigneeId, teamId, requesterId (uuid), number (integer)
- createdAt, updatedAt, dueAt (timestamps; ALWAYS set — use these for "recent / this week / today / overdue")
- resolvedAt, closedAt (timestamps; OFTEN EMPTY — do NOT filter on these. For "resolved this week" / "closed today", filter on status PLUS updatedAt instead.)
- data.<key> for any other custom field
- the special field "unassigned" means "has no assignee" (use op "eq" with empty value)
Operators: eq, ne, lt, lte, gt, gte, in, contains, startsWith, isNull.
For free-text fields like data.category, prefer "contains" (case-insensitive) over "eq".
"in" takes multiple values; scalar ops take one; isNull takes none.`;

/** Plan prompt: translate a request into a flat AskPlan. */
export function buildPlanPrompt(input: { query: string; now: string }): { system: string; prompt: string } {
  const a = dateAnchors(input.now);
  const system =
    'You are Tess, an IT service-desk assistant. Translate the agent\'s request into a JSON query plan over their tickets. ' +
    'Use ONLY the allowed fields and operators. Put every value in the string array `value` (dates as ISO-8601 — use the provided date anchors verbatim for relative phrases like "this week", "today", "last 7 days"). ' +
    'Set answerable=false ONLY if the request is not a search/summary over tickets. Keep `title` a short restatement. Default limit 20.';

  const examples = [
    'Examples (request -> conditions):',
    '- "unassigned hardware tickets" -> combine=and, [{field:"unassigned",op:"eq",value:[""]}, {field:"data.category",op:"contains",value:["hardware"]}]',
    '- "open high priority tickets" -> combine=and, [{field:"status",op:"eq",value:["open"]}, {field:"priority",op:"eq",value:["high"]}]',
    `- "resolved tickets from this week" -> combine=and, [{field:"status",op:"eq",value:["resolved"]}, {field:"updatedAt",op:"gte",value:["${a.startOfWeek}"]}]`,
    `- "tickets created today" -> combine=and, [{field:"createdAt",op:"gte",value:["${a.startOfToday}"]}]`,
    `- "overdue tickets" / "breaching SLA" -> combine=and, [{field:"dueAt",op:"lt",value:["${a.now}"]}, {field:"status",op:"ne",value:["closed"]}]`,
    `- "vpn tickets opened in the last 7 days" -> combine=and, [{field:"data.category",op:"contains",value:["vpn"]}, {field:"createdAt",op:"gte",value:["${a.sevenDaysAgo}"]}]`,
  ].join('\n');

  const prompt = [
    'Date anchors (use these EXACT values for relative ranges):',
    `- now: ${a.now}`,
    `- start of today: ${a.startOfToday}`,
    `- start of this week (Monday): ${a.startOfWeek}`,
    `- start of this month: ${a.startOfMonth}`,
    `- 7 days ago: ${a.sevenDaysAgo}`,
    `- 30 days ago: ${a.thirtyDaysAgo}`,
    '',
    FIELD_GUIDE,
    '',
    examples,
    '',
    `Request: ${input.query}`,
  ].join('\n');
  return { system, prompt };
}

/** Answer prompt: write a grounded answer over the fetched rows. */
export function buildAnswerPrompt(input: { query: string; tickets: CompactTicket[] }): { system: string; prompt: string } {
  const system =
    'You are Tess. Answer the agent\'s question concisely using ONLY the tickets provided below — do not invent tickets or facts. ' +
    'Reference tickets by their #number. If the list is empty, say nothing matched. Keep it to a few sentences.';
  const rows = input.tickets
    .map((t) => `#${t.number ?? '?'} "${t.title}" — status ${t.status ?? '—'}, priority ${t.priority ?? '—'}, ${t.assigned ? 'assigned' : 'unassigned'}${t.dueAt ? `, due ${t.dueAt}` : ''}${t.category ? `, category ${t.category}` : ''}`)
    .join('\n');
  const prompt = [`Question: ${input.query}`, '', `Tickets (${input.tickets.length}):`, rows || '(none)'].join('\n');
  return { system, prompt };
}
