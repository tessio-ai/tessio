// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import {
  parseEdition,
  getEdition,
  isFeatureEnabled,
  getEntitlements,
  FEATURE_KEYS,
} from './index';

describe('parseEdition', () => {
  it('accepts the three known editions', () => {
    expect(parseEdition('community')).toBe('community');
    expect(parseEdition('enterprise')).toBe('enterprise');
    expect(parseEdition('cloud')).toBe('cloud');
  });

  it('defaults unknown / empty values to community', () => {
    expect(parseEdition('')).toBe('community');
    expect(parseEdition(undefined)).toBe('community');
    expect(parseEdition('platinum')).toBe('community');
  });
});

describe('getEdition', () => {
  it('reads an explicit value over the environment', () => {
    expect(getEdition('enterprise')).toBe('enterprise');
  });
});

describe('isFeatureEnabled', () => {
  it('community enables NO enterprise features', () => {
    for (const f of FEATURE_KEYS) {
      expect(isFeatureEnabled(f, 'community')).toBe(false);
    }
  });

  it('enterprise & cloud enable the available features (sso, audit_log)', () => {
    for (const edition of ['enterprise', 'cloud'] as const) {
      expect(isFeatureEnabled('sso', edition)).toBe(true);
      expect(isFeatureEnabled('audit_log', edition)).toBe(true);
    }
  });

  it('reserved (unimplemented) features stay disabled even in paid editions', () => {
    for (const edition of ['enterprise', 'cloud'] as const) {
      expect(isFeatureEnabled('scim', edition)).toBe(false);
      expect(isFeatureEnabled('custom_roles', edition)).toBe(false);
      expect(isFeatureEnabled('advanced_sla', edition)).toBe(false);
    }
  });
});

describe('getEntitlements', () => {
  it('never caps seats in any edition (unlimited agents)', () => {
    for (const edition of ['community', 'enterprise', 'cloud'] as const) {
      expect(getEntitlements(edition).maxAgents).toBeNull();
    }
  });

  it('reports a complete per-feature map', () => {
    const ent = getEntitlements('enterprise');
    expect(Object.keys(ent.features).sort()).toEqual([...FEATURE_KEYS].sort());
    expect(ent.features.sso).toBe(true);
    expect(ent.features.scim).toBe(false);
  });
});
