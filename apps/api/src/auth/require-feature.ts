// SPDX-License-Identifier: AGPL-3.0-only

import { isFeatureEnabled, type Feature } from '@tessio/entitlements';
import { ApiError } from '../errors';

/**
 * preHandler guard: reject unless the given enterprise `feature` is enabled in
 * the active edition. Returns 404 (not 403) so a Community build does not even
 * advertise the existence of enterprise endpoints.
 *
 * Enterprise routes that live in `ee/` already self-gate on `isFeatureEnabled`;
 * this guard is for any core route that needs to be edition-gated in place.
 */
export function requireFeature(feature: Feature) {
  return async (): Promise<void> => {
    if (!isFeatureEnabled(feature)) {
      throw new ApiError(404, 'Not Found', 'Not found.');
    }
  };
}
