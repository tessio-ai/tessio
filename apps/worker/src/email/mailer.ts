// SPDX-License-Identifier: AGPL-3.0-only

import nodemailer from 'nodemailer';
import type JSONTransport from 'nodemailer/lib/json-transport';

export interface MailerConfig { host: string; port: number; secure: boolean; user?: string; pass?: string; fromName?: string; fromAddress: string; replyTo?: string | null; }
export interface OutMessage { to: string; subject: string; text: string; html: string; headers?: Record<string, string>; }
export interface Mailer { send(m: OutMessage): Promise<unknown>; }

/** `override` lets tests pass `{ jsonTransport: true }`; prod uses real SMTP.
 *  Typed as createTransport's own parameter so json/stream transport options are accepted. */
export function createMailer(cfg: MailerConfig, override?: nodemailer.TransportOptions | JSONTransport.Options): Mailer {
  const transport = nodemailer.createTransport(
    override ?? { host: cfg.host, port: cfg.port, secure: cfg.secure, auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined },
  );
  const from = cfg.fromName ? `${cfg.fromName} <${cfg.fromAddress}>` : cfg.fromAddress;
  return {
    send: (m) => transport.sendMail({ from, to: m.to, subject: m.subject, text: m.text, html: m.html, replyTo: cfg.replyTo ?? undefined, headers: m.headers }),
  };
}
