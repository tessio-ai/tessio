// SPDX-License-Identifier: LicenseRef-Tessio-Commercial

import { emailDomain } from '@tessio/shared';

export interface ResolveSsoInput {
  email: string;
  emailVerified: boolean | undefined;
  allowedDomain: string | null;
  autoCreate: boolean;
  existingUser: { id: string; status: string } | null;
}

export type SsoResolution =
  | { action: 'login'; userId: string }
  | { action: 'create' }
  | { action: 'reject'; reason: 'unverified' | 'domain' | 'no_account' | 'disabled_user' };

export function resolveSsoUser(i: ResolveSsoInput): SsoResolution {
  // Trust the email only when the IdP explicitly asserts it verified. A missing/
  // undefined `email_verified` claim is NOT trustworthy: some IdPs let a user set an
  // arbitrary, unverified email, and since accounts are linked by email alone this
  // would otherwise allow taking over a local account (incl. an admin) at that address.
  if (i.emailVerified !== true) return { action: 'reject', reason: 'unverified' };
  if (i.allowedDomain) {
    const d = emailDomain(i.email);
    if (!d || d !== i.allowedDomain.toLowerCase()) return { action: 'reject', reason: 'domain' };
  }
  if (i.existingUser) {
    if (i.existingUser.status !== 'active') return { action: 'reject', reason: 'disabled_user' };
    return { action: 'login', userId: i.existingUser.id };
  }
  if (i.autoCreate) return { action: 'create' };
  return { action: 'reject', reason: 'no_account' };
}
