// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { formDefinition, portalTheme, portalSettings } from './forms';

describe('form contracts', () => {
  it('parses a valid form definition', () => {
    const parsed = formDefinition.parse({
      sections: [
        { id: 's1', title: 'About', order: 0, fields: [{ fieldKey: 'title', width: 'full', requiredAtIntake: true }] },
      ],
    });
    expect(parsed.sections[0].fields[0].fieldKey).toBe('title');
    expect(parsed.sections[0].fields[0].width).toBe('full');
  });

  it('defaults field width to full', () => {
    const parsed = formDefinition.parse({ sections: [{ id: 's1', title: 'A', order: 0, fields: [{ fieldKey: 'x' }] }] });
    expect(parsed.sections[0].fields[0].width).toBe('full');
  });

  it('rejects a field ref without a fieldKey', () => {
    expect(() => formDefinition.parse({ sections: [{ id: 's1', title: 'A', order: 0, fields: [{ width: 'full' }] }] })).toThrow();
  });

  it('parses a portal theme with defaults', () => {
    const t = portalTheme.parse({ accent: '#4f46e5', headline: 'Report an issue' });
    expect(t.layout).toBe('single');
    expect(t.showTess).toBe(true);
  });

  it('parses portal settings with categories', () => {
    const s = portalSettings.parse({
      brandName: 'Acme', heroHeadline: 'How can we help?', accent: '#4f46e5', showTess: true,
      categories: [{ key: 'IT', label: 'IT & Software', icon: 'laptop', color: '#2563eb', order: 0, visible: true }],
    });
    expect(s.categories[0].key).toBe('IT');
  });
});

describe('portalSettings hero + catalog', () => {
  it('fills hero + catalog defaults when omitted', () => {
    const s = portalSettings.parse({ brandName: 'Acme', heroHeadline: 'Hi', accent: '#000' });
    expect(s.hero.preset).toBe('spotlight');
    expect(s.hero.showSearch).toBe(true);
    expect(s.hero.pills).toEqual([]);
    expect(s.catalog.sectionStyle).toBe('band');
    expect(s.catalog.cardStyle).toBe('comfortable');
    expect(s.catalog.columns).toBe('auto');
  });

  it('round-trips explicit hero + catalog', () => {
    const s = portalSettings.parse({
      brandName: 'A', heroHeadline: 'H', accent: '#000',
      hero: { preset: 'editorial', eyebrow: 'Help', pills: [{ label: 'Reset', formKey: 'reset' }], showSearch: false },
      catalog: { sectionStyle: 'plain', cardStyle: 'compact', columns: 3 },
    });
    expect(s.hero.preset).toBe('editorial');
    expect(s.hero.eyebrow).toBe('Help');
    expect(s.hero.pills[0]).toEqual({ label: 'Reset', formKey: 'reset' });
    expect(s.hero.showSearch).toBe(false);
    expect(s.catalog.columns).toBe(3);
  });

  it('accepts a category-targeted pill and rejects a targetless pill', () => {
    const ok = portalSettings.parse({ brandName: 'A', heroHeadline: 'H', accent: '#000',
      hero: { preset: 'spotlight', pills: [{ label: 'Hardware', categoryKey: 'hw' }], showSearch: true } });
    expect(ok.hero.pills[0]).toEqual({ label: 'Hardware', categoryKey: 'hw' });
    expect(() => portalSettings.parse({ brandName: 'A', heroHeadline: 'H', accent: '#000',
      hero: { preset: 'spotlight', pills: [{ label: 'Bad' }], showSearch: true } })).toThrow();
  });
});
