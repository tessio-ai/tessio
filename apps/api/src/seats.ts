// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Billable-seat enforcement. Tessio is free for FREE_SEAT_LIMIT active
 * admins + agents; beyond that a paid per-seat license (verified at boot,
 * see @tessio/license) must cover the new total. Requesters are never billable.
 *
 * Every server-side path that can INCREASE the number of active billable users
 * must call `assertSeatsAvailable` first: user create, bulk import, and the
 * role/status transitions in PATCH /users/:id. Counting lives in the database
 * (usersRepo.countBillable), so the check holds no matter which client calls
 * the API.
 */

import type { Db } from '@tessio/db';
import { usersRepo } from '@tessio/db';
import { getSeatLimit, FREE_SEAT_LIMIT } from '@tessio/entitlements';
import { ApiError } from './errors';

/** 402 problem+json carrying the numbers the UI needs to render an upgrade prompt. */
export function seatLimitError(seatLimit: number, seatsUsed: number): ApiError {
  const base =
    seatLimit <= FREE_SEAT_LIMIT
      ? `Tessio is free for up to ${seatLimit} active admins and agents.`
      : `Your license covers ${seatLimit} active admins and agents.`;
  return new ApiError(
    402,
    'Seat limit reached',
    `${base} You are using ${seatsUsed}. Add seats to your subscription to invite more, or disable an existing admin/agent first. Requesters are free and unlimited.`,
    { code: 'seat_limit_reached', seatLimit, seatsUsed },
  );
}

/**
 * Throw a 402 unless `adding` more billable users fits within the current seat
 * limit. Returns the (pre-add) billable count so bulk callers can track it.
 */
export async function assertSeatsAvailable(db: Db, orgId: string, adding = 1): Promise<number> {
  const seatLimit = getSeatLimit();
  const seatsUsed = await usersRepo(db).countBillable(orgId);
  if (seatLimit !== null && seatsUsed + adding > seatLimit) throw seatLimitError(seatLimit, seatsUsed);
  return seatsUsed;
}
