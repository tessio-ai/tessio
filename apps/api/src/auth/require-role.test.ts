// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { requireRole } from './require-role';
import { ApiError } from '../errors';

function reqWith(role: 'admin' | 'agent' | 'requester') {
  return { user: { id: 'u', orgId: 'o', role } } as never;
}

describe('requireRole', () => {
  it('passes when the role is allowed', async () => {
    await expect(requireRole('agent', 'admin')(reqWith('agent'))).resolves.toBeUndefined();
  });
  it('throws 403 when the role is not allowed', async () => {
    await expect(requireRole('admin')(reqWith('requester'))).rejects.toMatchObject({ status: 403 });
  });
  it('uses ApiError', async () => {
    await requireRole('admin')(reqWith('agent')).catch((e) => expect(e).toBeInstanceOf(ApiError));
  });
});
