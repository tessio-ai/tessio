// SPDX-License-Identifier: AGPL-3.0-only

/**
 * `@tessio/license` — the shared licensing primitives.
 *
 * One package so the two independently-deployed sides agree on one token format:
 *   - a customer's Tessio instance imports the VERIFIER + client check-in +
 *     the boot resolver (public-key only, safe to ship);
 *   - the vendor's license server / CLI import the SIGNER (private-key half).
 */

export * from './format';
export * from './keys';
export * from './verify';
export * from './sign';
export * from './resolve';
export * from './checkin';
