// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import {
  parseEdition,
  getEdition,
  isFeatureEnabled,
  getEntitlements,
  getSeatLimit,
  isBillableRole,
  parseSeats,
  FEATURE_KEYS,
  FREE_SEAT_LIMIT,
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

describe('seat limits', () => {
  it('community always gets exactly the free allotment', () => {
    expect(getSeatLimit('community', undefined)).toBe(FREE_SEAT_LIMIT);
    // even a (nonsensical) licensed-seat value cannot raise community
    expect(getSeatLimit('community', 500)).toBe(FREE_SEAT_LIMIT);
    expect(getSeatLimit('community', null)).toBe(FREE_SEAT_LIMIT);
  });

  it('paid editions get the licensed seat count', () => {
    expect(getSeatLimit('enterprise', 25)).toBe(25);
    expect(getSeatLimit('cloud', 12)).toBe(12);
  });

  it('a licensed null means unlimited (site license)', () => {
    expect(getSeatLimit('enterprise', null)).toBeNull();
  });

  it('a paid edition without a seat grant fails toward the free allotment, never unlimited', () => {
    expect(getSeatLimit('enterprise', undefined)).toBe(FREE_SEAT_LIMIT);
  });

  it('a licensed count below the free allotment never reduces it', () => {
    expect(getSeatLimit('enterprise', 2)).toBe(FREE_SEAT_LIMIT);
  });

  it('only admins and agents are billable', () => {
    expect(isBillableRole('admin')).toBe(true);
    expect(isBillableRole('agent')).toBe(true);
    expect(isBillableRole('requester')).toBe(false);
  });

  it('parseSeats: the one seats grammar — never falls toward unlimited', () => {
    expect(parseSeats('25')).toBe(25);
    expect(parseSeats('unlimited')).toBeNull();
    for (const bad of [undefined, null, '', '0', '-3', '2.5', 'lots', 'Infinity', 'NaN']) {
      expect(parseSeats(bad)).toBeUndefined();
    }
  });
});

describe('getEntitlements', () => {
  it('reports the seat limit for the edition', () => {
    expect(getEntitlements('community').seatLimit).toBe(FREE_SEAT_LIMIT);
    expect(getEntitlements('enterprise', 30).seatLimit).toBe(30);
    expect(getEntitlements('enterprise', null).seatLimit).toBeNull();
  });

  it('reports a complete per-feature map', () => {
    const ent = getEntitlements('enterprise');
    expect(Object.keys(ent.features).sort()).toEqual([...FEATURE_KEYS].sort());
    expect(ent.features.sso).toBe(true);
    expect(ent.features.scim).toBe(false);
  });
});
