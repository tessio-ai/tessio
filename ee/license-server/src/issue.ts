// SPDX-License-Identifier: LicenseRef-Tessio-Commercial

/**
 * Turn a looked-up subscription into a freshly-signed, short-TTL entitlement
 * token. This is the only place the private signing key is used at request time.
 *
 * The short TTL is deliberate: it is the customer's offline grace window. A
 * 14-day token means an instance keeps working for up to 14 days if the license
 * server is unreachable, then goes dark — and a lapse/renewal is reflected on
 * the next successful daily check-in, never later than the TTL.
 */

import { signLicense } from '@tessio/license';
import type { Subscription } from './store';

export interface IssueResult {
  token: string;
  edition: Subscription['edition'];
  expiresAt: number;
}

export function issueEntitlement(
  sub: Subscription,
  opts: { now: number; ttlSeconds: number; privateKey: string },
): IssueResult {
  const token = signLicense(
    {
      edition: sub.edition,
      subject: sub.subject,
      licenseId: sub.licenseId,
      features: sub.features,
      ttlSeconds: opts.ttlSeconds,
      now: opts.now,
    },
    opts.privateKey,
  );
  return { token, edition: sub.edition, expiresAt: opts.now + opts.ttlSeconds };
}
