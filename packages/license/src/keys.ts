// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Ed25519 key plumbing shared by the signer and verifier.
 *
 * Keys are handled as raw 32-byte values encoded base64url — compact enough to
 * paste into an env var. Node's `crypto` only accepts DER/PEM key objects, so
 * these helpers wrap/unwrap the raw bytes with the fixed Ed25519 ASN.1 headers.
 */

import { createPublicKey, createPrivateKey, generateKeyPairSync, type KeyObject } from 'node:crypto';

// Fixed ASN.1 prefixes for Ed25519 (the algorithm OID is constant), so a raw
// 32-byte key is just these bytes followed by the key material.
const SPKI_PUBLIC_HEADER = Buffer.from('302a300506032b6570032100', 'hex');
const PKCS8_PRIVATE_HEADER = Buffer.from('302e020100300506032b657004220420', 'hex');

/** Build a public KeyObject from a raw base64url 32-byte Ed25519 key. */
export function publicKeyFromRaw(b64url: string): KeyObject {
  const der = Buffer.concat([SPKI_PUBLIC_HEADER, Buffer.from(b64url, 'base64url')]);
  return createPublicKey({ key: der, format: 'der', type: 'spki' });
}

/** Build a private KeyObject from a raw base64url 32-byte Ed25519 seed. */
export function privateKeyFromRaw(b64url: string): KeyObject {
  const der = Buffer.concat([PKCS8_PRIVATE_HEADER, Buffer.from(b64url, 'base64url')]);
  return createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
}

/** Extract the raw base64url public key from a KeyObject. */
export function rawPublicKey(key: KeyObject): string {
  return key.export({ type: 'spki', format: 'der' }).subarray(-32).toString('base64url');
}

/** Extract the raw base64url private seed from a KeyObject. */
export function rawPrivateSeed(key: KeyObject): string {
  return key.export({ type: 'pkcs8', format: 'der' }).subarray(-32).toString('base64url');
}

/** Generate a fresh Ed25519 keypair as raw base64url strings. */
export function generateKeypair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { publicKey: rawPublicKey(publicKey), privateKey: rawPrivateSeed(privateKey) };
}
