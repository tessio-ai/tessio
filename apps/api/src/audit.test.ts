// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { safeMeta } from './audit';

describe('safeMeta', () => {
  it('keeps only allow-listed keys and drops secrets', () => {
    expect(safeMeta({ enabled: true, clientSecret: 'x', smtpPassword: 'y' }, ['enabled'])).toEqual({ enabled: true });
  });

  it('omits undefined keys', () => {
    expect(safeMeta({ enabled: true }, ['enabled', 'status'])).toEqual({ enabled: true });
  });
});
