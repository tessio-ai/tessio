// SPDX-License-Identifier: AGPL-3.0-only

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';

function keyBuffer(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) throw new Error('TESSIO_SECRET_KEY must decode to 32 bytes');
  return key;
}

/** Encrypt a secret. Output: `iv:authTag:ciphertext`, all hex. */
export function encryptSecret(plaintext: string, base64Key: string): string {
  const key = keyBuffer(base64Key);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), ct.toString('hex')].join(':');
}

/** Decrypt a value produced by `encryptSecret`. Throws if the auth tag fails. */
export function decryptSecret(packed: string, base64Key: string): string {
  const key = keyBuffer(base64Key);
  const [ivHex, tagHex, ctHex] = packed.split(':');
  if (!ivHex || !tagHex || !ctHex) throw new Error('malformed ciphertext');
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(ctHex, 'hex')), decipher.final()]).toString('utf8');
}
