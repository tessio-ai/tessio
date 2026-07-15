// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Billable-seat enforcement. Tessio is free for FREE_SEAT_LIMIT active
 * admins + agents; beyond that a paid per-seat license (verified at boot,
 * see @tessio/license) must cover the new total. Requesters are never billable.
 *
 * This is the ONLY place seat limits are enforced (see CONTRIBUTING.md).
 * Every server-side path that can INCREASE the number of active billable
 * users — user create, bulk import, and the role/status transitions in
 * PATCH /users/:id — performs its write through `withSeatGuard`, which runs
 * the count and the mutation in one transaction under a per-org advisory
 * lock. Without the lock, two concurrent requests could both observe a free
 * seat and both take it (check-then-act race), silently exceeding the limit.
 */

import { sql } from 'drizzle-orm';
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
 * Run `mutate` (a write that occupies ONE new billable seat) atomically with
 * the seat-limit check: a transaction takes a per-org advisory lock, re-counts
 * billable users, throws the 402 if the org is full, and only then performs
 * the write. The lock serializes concurrent seat-takers for the same org
 * (creates, imports, promotions), so the limit holds under concurrency;
 * `pg_advisory_xact_lock` releases automatically at commit/rollback.
 */
export async function withSeatGuard<T>(db: Db, orgId: string, mutate: (tx: Db) => Promise<T>): Promise<T> {
  return db.transaction(async (txRaw) => {
    // The drizzle transaction exposes the same query API as Db; the repos only
    // use that shared surface, so the narrowing cast is safe here.
    const tx = txRaw as unknown as Db;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${orgId})::bigint)`);
    const seatLimit = getSeatLimit();
    if (seatLimit !== null) {
      const seatsUsed = await usersRepo(tx).countBillable(orgId);
      if (seatsUsed + 1 > seatLimit) throw seatLimitError(seatLimit, seatsUsed);
    }
    return mutate(tx);
  });
}
