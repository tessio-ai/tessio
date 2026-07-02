// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';

export const ssoSettingsInput = z.object({
  enabled: z.boolean().optional(),
  issuer: z.string().url().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),   // write-only
  buttonLabel: z.string().optional(),
  autoCreateUsers: z.boolean().optional(),
  allowedDomain: z.string().nullable().optional(),
});

export type SsoSettingsInput = z.infer<typeof ssoSettingsInput>;

/** Lower-cased email domain, or null. */
export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  return at > 0 ? email.slice(at + 1).toLowerCase() : null;
}
