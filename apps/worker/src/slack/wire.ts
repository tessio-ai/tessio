// SPDX-License-Identifier: AGPL-3.0-only

import { slackSettingsRepo, type Db } from '@tessio/db';
import { decryptSecret } from '@tessio/ai';
import type { SlackSendDeps } from './send';

export function buildSlackSendDeps(db: Db): SlackSendDeps {
  return {
    loadWebhook: async (orgId) => {
      const row = await slackSettingsRepo(db).getOrCreate(orgId);
      const secretKey = process.env.TESSIO_SECRET_KEY;
      if (!row?.enabled || !row.webhookUrlCiphertext || !secretKey) return null;
      return decryptSecret(row.webhookUrlCiphertext, secretKey);
    },
    fetchFn: fetch,
  };
}
