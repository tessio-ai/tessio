// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { applyGmailPreset, EmailSettings, type Draft } from './EmailSettings';
import type { EmailSettingsView } from '../../api/email';

const VIEW: EmailSettingsView = {
  orgId: 'o1', enabled: false,
  smtpHost: null, smtpPort: null, smtpSecure: false, smtpUser: null, smtpConfigured: false,
  fromName: null, fromAddress: 'support@acme.com', replyTo: null,
  inboundEnabled: false, imapHost: null, imapPort: null, imapSecure: false, imapUser: null, imapConfigured: false,
  mailbox: 'INBOX', acceptNewSenders: false, defaultSchemaId: null, defaultTeamId: null,
};

const noopMutation = { mutate: vi.fn(), isPending: false };
vi.mock('./queries', () => ({
  useEmailSettings: () => ({ data: VIEW }),
  useUpdateEmailSettings: () => noopMutation,
  useTestSmtp: () => noopMutation,
}));
vi.mock('../tickets/queries', () => ({
  useTicketSchemas: () => ({ data: [] }),
  useTeams: () => ({ data: [] }),
}));

const base: Draft = {
  enabled: false,
  smtpHost: '', smtpPort: '', smtpSecure: false, smtpUser: '', smtpPassword: '',
  fromName: 'Acme Support', fromAddress: 'support@acme.com', replyTo: '',
  inboundEnabled: false,
  imapHost: '', imapPort: '', imapSecure: false, imapUser: '', imapPassword: '',
  mailbox: '', acceptNewSenders: false, defaultSchemaId: 'sch-1', defaultTeamId: '',
};

describe('applyGmailPreset', () => {
  it('fills Google SMTP and IMAP server settings', () => {
    const d = applyGmailPreset(base);
    expect(d).toMatchObject({
      smtpHost: 'smtp.gmail.com', smtpPort: '465', smtpSecure: true,
      imapHost: 'imap.gmail.com', imapPort: '993', imapSecure: true,
      mailbox: 'INBOX',
    });
  });

  it('autofills the SMTP/IMAP username from the from-address when blank', () => {
    const d = applyGmailPreset(base);
    expect(d.smtpUser).toBe('support@acme.com');
    expect(d.imapUser).toBe('support@acme.com');
  });

  it('preserves an already-entered username and mailbox', () => {
    const d = applyGmailPreset({ ...base, smtpUser: 'me@acme.com', imapUser: 'me@acme.com', mailbox: 'Support' });
    expect(d.smtpUser).toBe('me@acme.com');
    expect(d.imapUser).toBe('me@acme.com');
    expect(d.mailbox).toBe('Support');
  });

  it('does not touch feature toggles, secrets, or unrelated fields', () => {
    const d = applyGmailPreset({ ...base, smtpPassword: 'typed', enabled: true });
    expect(d.enabled).toBe(true);
    expect(d.inboundEnabled).toBe(false);
    expect(d.smtpPassword).toBe('typed');
    expect(d.fromName).toBe('Acme Support');
    expect(d.defaultSchemaId).toBe('sch-1');
  });
});

describe('EmailSettings — Connect Google button', () => {
  it('fills the Gmail SMTP/IMAP fields when clicked', async () => {
    render(<EmailSettings />);
    const smtpHost = screen.getByPlaceholderText('smtp.example.com') as HTMLInputElement;
    const imapHost = screen.getByPlaceholderText('imap.example.com') as HTMLInputElement;
    expect(smtpHost.value).toBe('');

    await userEvent.click(screen.getByRole('button', { name: /use google settings/i }));

    expect(smtpHost.value).toBe('smtp.gmail.com');
    expect(imapHost.value).toBe('imap.gmail.com');
    // Both usernames are auto-filled from the configured from-address.
    const users = screen.getAllByPlaceholderText('user@example.com') as HTMLInputElement[];
    expect(users.map((u) => u.value)).toEqual(['support@acme.com', 'support@acme.com']);
    // The App Password help link points at Google's account page.
    const link = screen.getByRole('link', { name: /App Password/i }) as HTMLAnchorElement;
    expect(link.href).toBe('https://myaccount.google.com/apppasswords');
  });
});
