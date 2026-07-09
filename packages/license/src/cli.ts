// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Vendor CLI — run offline by the maintainers, never on a customer instance.
 *
 *   # one-time: create the signing keypair
 *   tsx src/cli.ts keygen
 *       → prints PUBLIC (paste into verify.ts) and PRIVATE (store in a vault)
 *
 *   # mint a long-lived OFFLINE token for an air-gapped customer
 *   TESSIO_LICENSE_PRIVATE_KEY=<b64url> \
 *   tsx src/cli.ts issue --edition enterprise --sub "Acme Corp" --days 365
 *
 * The hosted path does NOT use `issue` — the license server mints short-TTL
 * tokens automatically on check-in. `issue` exists only for air-gapped deals.
 */

import { generateKeypair } from './keys';
import { signLicense } from './sign';
import type { Edition, Feature } from '@tessio/entitlements';

function keygen(): void {
  const { publicKey, privateKey } = generateKeypair();
  process.stdout.write(
    `PUBLIC  (paste into verify.ts CANONICAL_PUBLIC_KEY_B64URL):\n  ${publicKey}\n\n` +
      `PRIVATE (store offline — TESSIO_LICENSE_PRIVATE_KEY):\n  ${privateKey}\n`,
  );
}

function parseFlags(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (argv[i]?.startsWith('--')) out[argv[i].slice(2)] = argv[i + 1] ?? '';
  }
  return out;
}

function issue(flags: Record<string, string>, now: number): string {
  const priv = process.env.TESSIO_LICENSE_PRIVATE_KEY;
  if (!priv) throw new Error('set TESSIO_LICENSE_PRIVATE_KEY (from `keygen`) to sign a license');
  return signLicense(
    {
      edition: flags.edition as Edition,
      subject: flags.sub ?? 'unknown',
      licenseId: flags.lid,
      features: flags.features ? (flags.features.split(',').map((f) => f.trim()).filter(Boolean) as Feature[]) : undefined,
      ttlSeconds: flags.days ? Number(flags.days) * 86400 : null,
      now,
    },
    priv,
  );
}

function main(): void {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'keygen') return keygen();
  if (cmd === 'issue') {
    process.stdout.write(`${issue(parseFlags(rest), Math.floor(Date.now() / 1000))}\n`);
    return;
  }
  process.stderr.write('usage: cli.ts <keygen | issue --edition <e> --sub <name> [--lid id] [--days n] [--features a,b]>\n');
  process.exit(1);
}

if (process.argv[1]?.endsWith('cli.ts')) main();

export { issue };
