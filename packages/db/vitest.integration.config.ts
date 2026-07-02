import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.integration.test.ts'],
    globalSetup: ['./src/testing/global-setup.ts'],
    // Integration tests share one Postgres DB and truncate between tests,
    // so they must not run in parallel across files.
    fileParallelism: false,
    testTimeout: 20000,
  },
});
