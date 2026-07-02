// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { createMailer } from './mailer';

describe('createMailer', () => {
  it('sends a message through a transport built from config', async () => {
    const mailer = createMailer({ host: 'localhost', port: 587, secure: false, user: 'u', pass: 'p', fromName: 'Tess', fromAddress: 'tess@desk.acme.com' }, { jsonTransport: true });
    const info = await mailer.send({ to: 'a@b.com', subject: 'Hi', text: 'body', html: '<p>body</p>', headers: { 'Message-ID': '<x@y>' } });
    const sent = JSON.parse((info as { message: string }).message);
    expect(sent.subject).toBe('Hi');
    // nodemailer v6+ normalises `from` to an address object { address, name } in jsonTransport output
    const fromAddr = typeof sent.from === 'string' ? sent.from : (sent.from as { address: string }).address;
    expect(fromAddr).toContain('tess@desk.acme.com');
    expect(sent.messageId ?? sent.headers?.['message-id']).toBeDefined();
  });
});
