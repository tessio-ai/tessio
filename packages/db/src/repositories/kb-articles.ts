// SPDX-License-Identifier: AGPL-3.0-only

import { kbArticles } from '../schema';
import { createRecordRepository } from './records';
import type { Db } from '../client';

export function kbArticlesRepo(db: Db) {
  return createRecordRepository(db, kbArticles);
}
