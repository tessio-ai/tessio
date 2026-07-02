// SPDX-License-Identifier: AGPL-3.0-only

import { loadEnv } from './load-env';
import { buildApp } from './app';
import { loadEnterprise } from './enterprise/load';
import { createDbClient } from '@tessio/db';

// Load a local .env (dev convenience) before reading any process.env value.
loadEnv();

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
const databaseUrl = process.env.DATABASE_URL ?? 'postgres://tessio:tessio@localhost:5432/tessio';

async function main() {
  const db = createDbClient(databaseUrl);
  // Paid editions only; Community returns null and the app runs core-only.
  const enterprise = await loadEnterprise(console);
  const app = buildApp({ db, enterprise });
  await app.listen({ port, host });
  console.log(`api listening on http://${host}:${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
