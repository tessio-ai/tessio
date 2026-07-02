import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.integration.test.ts'],
    globalSetup: ['./src/testing/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 20000,
  },
});
