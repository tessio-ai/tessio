// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Vendor-side license tool — NOT part of the running server.
 *
 * This is the counterpart to verify.ts: the maintainers run it offline to mint
 * license tokens with the PRIVATE key. It is committed so the token format has
 * one authoritative definition, but the private key it needs is never in the
 * repo — you generate one with `keygen`, publish the printed public key into
 * verify.ts's CANONICAL_PUBLIC_KEY_B64URL, and keep the private key in a vault.
 *
 * Usage (run with tsx):
 *   # 1. one-time: create the signing keypair
 *   tsx src/license/sign.ts keygen
 *       → prints PUBLIC (paste into verify.ts) and PRIVATE (store offline)
 *
 *   # 2. mint a license
 *   TESSIO_LICENSE_PRIVATE_KEY=<b64url-private> \
 *   tsx src/license/sign.ts issue \
 *       --edition enterprise --sub "Acme Corp" --lid lic_123 --days 365
 *       → prints the tessio-lic.v1.… token to put in TESSIO_LICENSE_KEY
 */

import { generateKeyPairSync, sign as edSign, createPrivateKey } from 'node:crypto';
import { EDITIONS, type Edition } from '@tessio/entitlements';

const TOKEN_PREFIX = 'tessio-lic';
const TOKEN_VERSION = 'v1';

function keygen(): void {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const pubRaw = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32);
  const privRaw = privateKey.export({ type: 'pkcs8', format: 'der' }).subarray(-32);
  process.stdout.write(
    `PUBLIC  (paste into verify.ts CANONICAL_PUBLIC_KEY_B64URL):\n  ${pubRaw.toString('base64url')}\n\n` +
      `PRIVATE (store offline — TESSIO_LICENSE_PRIVATE_KEY):\n  ${privRaw.toString('base64url')}\n`,
  );
}

function privateKeyFromRaw(b64url: string) {
  // Wrap the raw 32-byte seed in the fixed Ed25519 PKCS#8 DER header.
  const pkcs8Header = Buffer.from('302e020100300506032b657004220420', 'hex');
  const der = Buffer.concat([pkcs8Header, Buffer.from(b64url, 'base64url')]);
  return createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
}

function issue(args: Record<string, string>, now: number): string {
  const priv = process.env.TESSIO_LICENSE_PRIVATE_KEY;
  if (!priv) throw new Error('set TESSIO_LICENSE_PRIVATE_KEY (from `keygen`) to sign a license');

  const edition = args.edition as Edition;
  if (!EDITIONS.includes(edition) || edition === 'community') {
    throw new Error(`--edition must be a paid edition (${EDITIONS.filter((e) => e !== 'community').join(' | ')})`);
  }
  const days = args.days ? Number(args.days) : null;
  const payload = {
    v: 1,
    edition,
    sub: args.sub ?? 'unknown',
    lid: args.lid ?? `lic_${now}`,
    iat: now,
    exp: days && Number.isFinite(days) ? now + Math.round(days * 86400) : null,
    ...(args.features ? { features: args.features.split(',').map((f) => f.trim()).filter(Boolean) } : {}),
  };

  const payloadSeg = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `${TOKEN_PREFIX}.${TOKEN_VERSION}.${payloadSeg}`;
  const sig = edSign(null, Buffer.from(signingInput, 'utf8'), privateKeyFromRaw(priv)).toString('base64url');
  return `${signingInput}.${sig}`;
}

function parseFlags(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (argv[i]?.startsWith('--')) out[argv[i].slice(2)] = argv[i + 1] ?? '';
  }
  return out;
}

function main(): void {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'keygen') return keygen();
  if (cmd === 'issue') {
    const token = issue(parseFlags(rest), Math.floor(Date.now() / 1000));
    process.stdout.write(`${token}\n`);
    return;
  }
  process.stderr.write('usage: sign.ts <keygen | issue --edition <e> --sub <name> [--lid id] [--days n] [--features a,b]>\n');
  process.exit(1);
}

// Only run when invoked directly (not when imported by a test).
if (process.argv[1] && process.argv[1].endsWith('sign.ts')) main();

export { issue };
