// SPDX-License-Identifier: AGPL-3.0-only

const DEV_FALLBACK = 'dev-insecure-secret-change-me';

/** Resolve the cookie-signing secret; refuse the insecure fallback in production. */
export function resolveSessionSecret(nodeEnv: string | undefined, secret: string | undefined): string {
  if (nodeEnv === 'production') {
    if (!secret || secret === DEV_FALLBACK) {
      throw new Error('SESSION_SECRET must be set to a strong value in production (refusing the insecure dev fallback).');
    }
    return secret;
  }
  return secret ?? DEV_FALLBACK;
}
