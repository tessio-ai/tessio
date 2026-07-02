// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { AUDIT_ACTIONS, AUDIT_ACTION_LABELS } from './audit';
describe('audit actions', () => {
  it('every action has a label', () => {
    for (const a of AUDIT_ACTIONS) expect(AUDIT_ACTION_LABELS[a], a).toBeTruthy();
  });
});
