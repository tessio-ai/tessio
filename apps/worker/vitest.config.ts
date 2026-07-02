import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration tests run via `test:integration` (vitest.integration.config.ts),
    // which provides the test-DB global setup. Exclude them from the unit run.
    exclude: [...configDefaults.exclude, '**/*.integration.test.ts'],
  },
});
