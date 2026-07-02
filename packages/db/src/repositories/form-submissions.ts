// SPDX-License-Identifier: AGPL-3.0-only

import { formSubmissions } from '../schema';
import { createRecordRepository } from './records';
import type { Db } from '../client';

export function formSubmissionsRepo(db: Db) {
  return createRecordRepository(db, formSubmissions);
}
