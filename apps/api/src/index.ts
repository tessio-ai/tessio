// SPDX-License-Identifier: AGPL-3.0-only

import { loadEnv } from './load-env';
import { buildApp } from './app';
import { loadEnterprise } from './enterprise/load';
import { applyResolvedEdition, createLicenseClient } from '@tessio/license';
import { createDbClient } from '@tessio/db';

// Load a local .env (dev convenience) before reading any process.env value.
loadEnv();

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
const databaseUrl = process.env.DATABASE_URL ?? 'postgres://tessio:tessio@localhost:5432/tessio';
const storageDir = process.env.TESSIO_STORAGE_DIR ?? './.storage';

async function main() {
  const now = () => Math.floor(Date.now() / 1000);

  // --- License: resolve the effective edition BEFORE anything reads TESSIO_EDITION.
  // The customer sets one stable, opaque TESSIO_LICENSE_KEY. The client trades it
  // for a short-lived signed entitlement at the license server (or uses a signed
  // offline token directly for air-gapped installs, or the last cached token when
  // the server is briefly unreachable). Anything unverifiable fails closed to
  // Community — the env var alone can never unlock paid features.
  const license = createLicenseClient({
    storeToken: process.env.TESSIO_LICENSE_KEY,
    checkInUrl: process.env.TESSIO_LICENSE_SERVER_URL,
    cachePath: process.env.TESSIO_LICENSE_CACHE_PATH ?? `${storageDir}/license.json`,
  });
  const resolvedToken = await license.resolveInitial();
  const resolved = applyResolvedEdition({
    requestedEdition: process.env.TESSIO_EDITION,
    signedToken: resolvedToken.signedToken,
    now: now(),
  });
  if (resolved.downgraded) {
    console.warn(`[license] paid edition requested but ${resolved.reason ?? resolvedToken.reason}; running Community.`);
  } else if (resolved.license) {
    console.log(`[license] ${resolved.edition} edition licensed to "${resolved.license.subject}" (via ${resolvedToken.source}).`);
  }
  // Re-check daily so renewals/lapses take effect without a restart or a new key.
  license.startDailyRefresh((token) => {
    const next = applyResolvedEdition({ requestedEdition: process.env.TESSIO_EDITION, signedToken: token, now: now() });
    console.log(`[license] refreshed: running ${next.edition} edition.`);
  });

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
