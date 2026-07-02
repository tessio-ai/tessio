// SPDX-License-Identifier: AGPL-3.0-only

import { createDbClient } from './client';
import { seedAdmin, seedAssetSchema, seedTicketSchema, seedForms, cleanupUntitled, seedTeams, seedKbSchema } from './seed';

async function main() {
  const email = process.env.TESSIO_ADMIN_EMAIL;
  const password = process.env.TESSIO_ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('Set TESSIO_ADMIN_EMAIL and TESSIO_ADMIN_PASSWORD');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL ?? 'postgres://tessio:tessio@localhost:5432/tessio';
  const db = createDbClient(url);
  const user = await seedAdmin(db, { email, password, name: process.env.TESSIO_ADMIN_NAME });
  console.log(`Seeded admin ${user.email} (${user.id})`);
  await seedAssetSchema(db, user.orgId);
  console.log(`Seeded Hardware Asset schema for org ${user.orgId}`);
  await seedTicketSchema(db, user.orgId);
  console.log(`Seeded ticket types for org ${user.orgId}`);
  await seedForms(db, user.orgId);
  console.log(`Seeded default forms for org ${user.orgId}`);
  const cleaned = await cleanupUntitled(db, user.orgId);
  if (cleaned.forms || cleaned.schemas) console.log(`Archived ${cleaned.forms} untitled form(s), ${cleaned.schemas} untitled schema(s)`);
  await seedTeams(db, user.orgId);
  console.log(`Seeded default teams for org ${user.orgId}`);
  await seedKbSchema(db, user.orgId);
  console.log(`Seeded Article schema for org ${user.orgId}`);
  await db.$client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
