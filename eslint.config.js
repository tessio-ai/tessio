import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.turbo/**', '**/migrations/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Open-core import boundary: core (apps/*, packages/*) must NOT import the
    // commercial Enterprise Edition packages. The boundary is one-directional —
    // ee/ may import core, never the reverse. The composition root loads ee via
    // a computed dynamic import (apps/api/src/enterprise/load.ts), which is not a
    // static string literal and so is intentionally exempt. See LICENSING.md.
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@tessio/ee-server', '@tessio/ee-server/*', '@tessio/ee-web', '@tessio/ee-web/*'],
              message:
                'Core code must not import the commercial Enterprise Edition (ee/). The boundary is one-directional; load ee only at the composition root. See LICENSING.md.',
            },
          ],
        },
      ],
    },
  },
  {
    // Ported design-handoff console: vendored prototype with intentionally loose typing.
    files: ['apps/web/src/console/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
