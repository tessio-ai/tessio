// SPDX-License-Identifier: AGPL-3.0-only

export interface TicketContext {
  number: number;
  title: string;
  description: string;
  category: string | null;
}
export interface CommentContext {
  author: string;
  internal: boolean;
  body: string;
}

function renderComments(comments: CommentContext[], includeInternal: boolean): string {
  return comments
    .filter((c) => includeInternal || !c.internal)
    .map((c) => `- ${c.author}${c.internal ? ' (internal)' : ''}: ${c.body}`)
    .join('\n');
}

export function buildSummarizePrompt(input: { ticket: TicketContext; comments: CommentContext[] }): {
  system: string;
  prompt: string;
} {
  const { ticket, comments } = input;
  const system =
    'You are Tess, a concise IT service-desk assistant. Summarize a support ticket for an agent in 2–4 short bullet points. Be factual; do not invent details.';
  const prompt = [
    `Ticket #${ticket.number}: ${ticket.title}`,
    `Category: ${ticket.category ?? 'uncategorized'}`,
    `Description: ${ticket.description || '(none)'}`,
    comments.length ? `Thread:\n${renderComments(comments, true)}` : 'Thread: (no comments yet)',
    '',
    'Write 2–4 bullet points, one per line, each starting with "- ".',
  ].join('\n');
  return { system, prompt };
}
