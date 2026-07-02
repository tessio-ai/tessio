// SPDX-License-Identifier: AGPL-3.0-only

import { ensureTestDbMigrated } from '@tessio/db/testing';

export default async function setup() {
  await ensureTestDbMigrated();
}
