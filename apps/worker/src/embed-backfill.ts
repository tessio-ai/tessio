// SPDX-License-Identifier: AGPL-3.0-only

import { loadEnv } from './load-env';
import { createDbClient, aiSettingsRepo, ticketEmbeddingsRepo, orgs } from '@tessio/db';
import { embedTexts, decryptSecret } from '@tessio/ai';

loadEnv();

/** One-off: embed every stale/unembedded ticket for orgs that have similar enabled. */
async function main(): Promise<void> {
  const db = createDbClient(process.env.DATABASE_URL ?? 'postgres://tessio:tessio@localhost:5432/tessio');
  const secret = process.env.TESSIO_SECRET_KEY;
  if (!secret) throw new Error('TESSIO_SECRET_KEY is not set');
  const allOrgs = await db.select({ id: orgs.id }).from(orgs);
  for (const org of allOrgs) {
    const s = await aiSettingsRepo(db).getOrCreate(org.id);
    if (!s.enabled || !s.features.similar || !s.apiKeyCiphertext) continue;
    const apiKey = decryptSecret(s.apiKeyCiphertext, secret);
    for (;;) {
      const stale = await ticketEmbeddingsRepo(db).listStale(org.id, 100);
      if (stale.length === 0) break;
      const active = stale
        .map((t) => ({ row: t, text: `${t.title}\n${t.description}`.trim() }))
        .filter((x) => x.text.length > 0);
      if (active.length === 0) break; // only empty-text tickets remain → stop
      const hadEmpties = active.length < stale.length;
      const vectors = await embedTexts({ apiKey, model: s.embeddingModel, baseUrl: s.baseUrl, texts: active.map((x) => x.text) });
      for (let i = 0; i < active.length; i++) {
        await ticketEmbeddingsRepo(db).upsert({
          ticketId: active[i].row.id, orgId: org.id, embedding: vectors[i], contentHash: active[i].row.hash, model: s.embeddingModel,
        });
      }
      console.log(`embedded ${active.length} tickets for org ${org.id}`);
      if (hadEmpties) break; // empty tickets will always be stale; avoid infinite loop
    }
  }
  await db.$client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
