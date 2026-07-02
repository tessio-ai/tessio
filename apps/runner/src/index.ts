// SPDX-License-Identifier: AGPL-3.0-only

import { buildApp } from './app';

const port = Number(process.env.RUNNER_PORT ?? 3100);
const host = process.env.HOST ?? '0.0.0.0';

const app = buildApp();
app
  .listen({ port, host })
  .then(() => console.log(`runner listening on http://${host}:${port}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
