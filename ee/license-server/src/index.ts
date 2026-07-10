// SPDX-License-Identifier: LicenseRef-Tessio-Commercial

/**
 * License-server bootstrap. Reads its secrets from the environment (a real
 * deploy pulls TESSIO_LICENSE_PRIVATE_KEY from a vault) and refuses to start
 * without a signing key — a license server that can't sign is useless and a
 * misconfiguration we want to fail loudly on.
 *
 * The InMemorySubscriptionStore here is a placeholder: back it with your
 * database in production so subscription state survives restarts.
 */

import { buildLicenseServer } from './app';
import { InMemorySubscriptionStore } from './store';

const privateKey = process.env.TESSIO_LICENSE_PRIVATE_KEY;
if (!privateKey) {
  console.error('TESSIO_LICENSE_PRIVATE_KEY is required (raw base64url Ed25519 seed from your vault).');
  process.exit(1);
}

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? '0.0.0.0';

const app = buildLicenseServer({
  store: new InMemorySubscriptionStore(),
  privateKey,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  ttlSeconds: process.env.TESSIO_LICENSE_TTL_DAYS ? Number(process.env.TESSIO_LICENSE_TTL_DAYS) * 86400 : undefined,
});

app.listen({ port, host }).then(
  () => console.log(`license server listening on http://${host}:${port}`),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
