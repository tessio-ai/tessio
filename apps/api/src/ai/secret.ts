// SPDX-License-Identifier: AGPL-3.0-only

import { ApiError } from '../errors';

/** Return the configured master key, or throw a 500 if AI is in use without one. */
export function requireSecretKey(): string {
  const key = process.env.TESSIO_SECRET_KEY;
  if (!key) {
    throw new ApiError(500, 'Server Misconfigured', 'TESSIO_SECRET_KEY is not set; cannot use Tess AI');
  }
  return key;
}
