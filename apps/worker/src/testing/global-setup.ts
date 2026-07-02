// SPDX-License-Identifier: AGPL-3.0-only

import { ensureTestDbMigrated } from '@tessio/db/testing';

/** Runs once before the worker integration suite. */
export default async function setup() {
  await ensureTestDbMigrated();
}
