// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import {
  buildSlackTicketMessage,
  buildSlackSlaMessage,
  escapeSlackText,
  isSlackTicketEvent,
  isValidSlackWebhookUrl,
  slackSettingsInput,
} from './slack';

describe('isValidSlackWebhookUrl', () => {
  it('accepts https URLs', () => {
    expect(isValidSlackWebhookUrl('https://hooks.slack.com/services/T0/B0/xyz')).toBe(true);
    expect(isValidSlackWebhookUrl('https://mattermost.internal.example/hooks/abc')).toBe(true);
  });
  it('rejects http, other schemes, and garbage', () => {
    expect(isValidSlackWebhookUrl('http://hooks.slack.com/services/T0/B0/xyz')).toBe(false);
    expect(isValidSlackWebhookUrl('ftp://hooks.slack.com/x')).toBe(false);
    expect(isValidSlackWebhookUrl('not a url')).toBe(false);
    expect(isValidSlackWebhookUrl('')).toBe(false);
  });
});

describe('escapeSlackText', () => {
  it('escapes &, < and > (mrkdwn control characters)', () => {
    expect(escapeSlackText('a <b> & c')).toBe('a &lt;b&gt; &amp; c');
  });
});

describe('isSlackTicketEvent', () => {
  it('accepts announceable events and rejects the rest', () => {
    expect(isSlackTicketEvent('created')).toBe(true);
    expect(isSlackTicketEvent('commented')).toBe(true);
    expect(isSlackTicketEvent('priority')).toBe(false);
    expect(isSlackTicketEvent('field_changed')).toBe(false);
  });
});

describe('buildSlackTicketMessage', () => {
  it('renders a status change with the new value and a ticket link', () => {
    const m = buildSlackTicketMessage({
      eventType: 'status', number: 7, title: 'Printer <broken>', url: 'https://x/#/tickets/t1',
      changes: { status: 'resolved' },
    });
    expect(m.text).toContain('#7 Printer <broken>');
    expect(m.text).toContain('Status is now "resolved".');
    const section = m.blocks[0] as { text: { text: string } };
    expect(section.text.text).toContain('<https://x/#/tickets/t1|#7 Printer &lt;broken&gt;>');
  });

  it('distinguishes internal notes from public replies', () => {
    const note = buildSlackTicketMessage({ eventType: 'commented', number: 1, title: 'T', url: 'u', internal: true });
    expect(note.text).toContain('internal note');
    const reply = buildSlackTicketMessage({ eventType: 'commented', number: 1, title: 'T', url: 'u' });
    expect(reply.text).toContain('New reply');
  });
});

describe('buildSlackSlaMessage', () => {
  it('renders the breach kind and tolerates a missing ticket number', () => {
    expect(buildSlackSlaMessage({ number: 9, kind: 'response', url: 'u' }).text).toContain('Response SLA breached.');
    expect(buildSlackSlaMessage({ number: null, kind: 'resolution', url: 'u' }).text).toContain('#?');
  });
});

describe('slackSettingsInput', () => {
  it('accepts a partial patch and rejects wrong types', () => {
    expect(slackSettingsInput.safeParse({ enabled: true, webhookUrl: 'https://x' }).success).toBe(true);
    expect(slackSettingsInput.safeParse({}).success).toBe(true);
    expect(slackSettingsInput.safeParse({ notifyCreated: 'yes' }).success).toBe(false);
  });
});
