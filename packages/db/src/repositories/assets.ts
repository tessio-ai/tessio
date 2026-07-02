// SPDX-License-Identifier: AGPL-3.0-only

import { assets } from '../schema';
import { createRecordRepository } from './records';
import type { Db } from '../client';

export function assetsRepo(db: Db) {
  return createRecordRepository(db, assets);
}
