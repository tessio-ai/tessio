// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { buildSummarizePrompt } from './summarize';
import { buildDraftPrompt } from './draft';
import { buildTriagePrompt } from './triage';

const ticket = {
  number: 142,
  title: 'Printer offline on 3F',
  description: 'The shared HP LaserJet is offline. Power-cycled twice, no change.',
  category: 'Hardware',
};
const comments = [
  { author: 'Dana Kohl', internal: false, body: 'Still down this morning.' },
  { author: 'Agent', internal: true, body: 'Checked the spooler.' },
];

describe('prompt builders', () => {
  it('summarize includes title, description and public + internal comments', () => {
    const { prompt } = buildSummarizePrompt({ ticket, comments });
    expect(prompt).toContain('Printer offline on 3F');
    expect(prompt).toContain('Still down this morning.');
    expect(prompt).toContain('Checked the spooler.');
  });

  it('draft greets the requester and excludes internal notes', () => {
    const { prompt } = buildDraftPrompt({ ticket, comments, requesterName: 'Dana Kohl' });
    expect(prompt).toContain('Dana');
    expect(prompt).toContain('Still down this morning.');
    expect(prompt).not.toContain('Checked the spooler.');
  });

  it('triage lists candidate agents by id and name', () => {
    const { prompt } = buildTriagePrompt({
      ticket,
      candidateAgents: [{ id: 'u1', name: 'Priya' }, { id: 'u2', name: 'Sam' }],
    });
    expect(prompt).toContain('u1');
    expect(prompt).toContain('Priya');
    expect(prompt).toContain('Sam');
  });

  it('defaults the assistant identity to Tess', () => {
    expect(buildSummarizePrompt({ ticket, comments }).system).toContain('You are Tess,');
    expect(buildDraftPrompt({ ticket, comments, requesterName: null }).system).toContain('You are Tess,');
    expect(buildTriagePrompt({ ticket, candidateAgents: [] }).system).toContain('You are Tess,');
  });

  it('speaks as the personalized bot name when one is set', () => {
    expect(buildSummarizePrompt({ ticket, comments, botName: 'Max' }).system).toContain('You are Max,');
    expect(buildDraftPrompt({ ticket, comments, requesterName: null, botName: 'Max' }).system).toContain('You are Max,');
    expect(buildTriagePrompt({ ticket, candidateAgents: [], botName: 'Max' }).system).toContain('You are Max,');
  });
});
