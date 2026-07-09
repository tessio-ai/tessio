// SPDX-License-Identifier: AGPL-3.0-only

import type { TicketContext, CommentContext } from './summarize';

export function buildDraftPrompt(input: {
  ticket: TicketContext;
  comments: CommentContext[];
  requesterName: string | null;
  botName?: string;
}): { system: string; prompt: string } {
  const { ticket, comments, requesterName } = input;
  const first = (requesterName ?? 'there').split(' ')[0];
  const system =
    `You are ${input.botName || 'Tess'}, a friendly, professional IT service-desk agent. Draft a reply to the requester. Be warm and specific, acknowledge the issue, and state the next step. Do not promise timelines you cannot keep. Output only the reply body — no subject line, no signature placeholder.`;
  const publicThread = comments
    .filter((c) => !c.internal)
    .map((c) => `- ${c.author}: ${c.body}`)
    .join('\n');
  const prompt = [
    `Requester first name: ${first}`,
    `Ticket #${ticket.number}: ${ticket.title}`,
    `Category: ${ticket.category ?? 'uncategorized'}`,
    `Description: ${ticket.description || '(none)'}`,
    publicThread ? `Public thread so far:\n${publicThread}` : 'No public replies yet.',
    '',
    `Write a reply that greets ${first} by name.`,
  ].join('\n');
  return { system, prompt };
}
