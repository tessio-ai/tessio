// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, pgEnum, uuid, index } from 'drizzle-orm/pg-core';
import { foundationColumns } from './foundation';

export const submissionSource = pgEnum('submission_source', ['portal', 'internal']);

/** Form submissions (spec 4.4). */
export const formSubmissions = pgTable(
  'form_submissions',
  {
    ...foundationColumns,
    formSchemaId: uuid('form_schema_id'),
    submittedBy: uuid('submitted_by'),
    source: submissionSource('source'),
  },
  (t) => [
    index('form_submissions_org_idx').on(t.orgId),
    index('form_submissions_data_gin_idx').using('gin', t.data),
  ],
);
