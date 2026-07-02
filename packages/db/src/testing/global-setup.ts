// SPDX-License-Identifier: AGPL-3.0-only

import { ensureTestDbMigrated } from './test-db';

/** Runs once before the integration suite. */
export default async function setup() {
  await ensureTestDbMigrated();
}
