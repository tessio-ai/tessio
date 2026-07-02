// SPDX-License-Identifier: AGPL-3.0-only

import { getEdition, type EnterprisePlugin } from '@tessio/entitlements';

/**
 * Load the Enterprise Edition server plugin — ONLY in paid editions.
 *
 * This is the SINGLE, deliberate composition-root exception to the
 * "core must never import ee/" boundary (see LICENSING.md):
 *   - it runs only when TESSIO_EDITION is enterprise/cloud;
 *   - the module specifier is computed, so the static import-boundary ESLint
 *     rule does not apply and bundlers keep it a runtime import;
 *   - a Community distribution ships WITHOUT the ee/ packages, so the import
 *     simply fails to resolve and the app runs core-only.
 */
export async function loadEnterprise(
  log?: { warn: (obj: unknown, msg?: string) => void },
): Promise<EnterprisePlugin | null> {
  if (getEdition() === 'community') return null;
  const spec = ['@tessio', 'ee-server'].join('/');
  try {
    const mod = (await import(spec)) as { enterprise: EnterprisePlugin };
    return mod.enterprise;
  } catch (err) {
    log?.warn?.({ err }, `edition is "${getEdition()}" but ${spec} is not installed; running core only`);
    return null;
  }
}
