// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { processExampleJob } from './jobs';

describe('processExampleJob', () => {
  it('returns the processed ticket id', () => {
    expect(processExampleJob({ ticketId: 'abc-123' })).toEqual({ processed: 'abc-123' });
  });
});
