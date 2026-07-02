// SPDX-License-Identifier: LicenseRef-Tessio-Commercial
import { ensureTestDbMigrated } from '@tessio/db/testing';

export default async function setup() {
  await ensureTestDbMigrated();
}
