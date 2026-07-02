// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from './sanitize';

describe('sanitizeHtml', () => {
  it('keeps allowed inline formatting', () => {
    expect(sanitizeHtml('<b>bold</b> and <a href="https://x.test">link</a>')).toBe(
      '<b>bold</b> and <a href="https://x.test">link</a>',
    );
  });

  it('strips script tags', () => {
    expect(sanitizeHtml('hi<script>alert(1)</script>')).toBe('hi');
  });

  it('strips inline event handlers', () => {
    const out = sanitizeHtml('<img src=x onerror="alert(1)">');
    expect(out).not.toContain('onerror');
    expect(out).not.toContain('alert');
  });

  it('removes javascript: hrefs', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain('javascript:');
  });

  it('drops disallowed tags but keeps their text', () => {
    expect(sanitizeHtml('<iframe src="evil"></iframe>text')).toBe('text');
  });

  it('adds noopener/noreferrer to target=_blank links', () => {
    const out = sanitizeHtml('<a href="https://x.test" target="_blank">x</a>');
    expect(out).toContain('rel="noopener noreferrer"');
  });
});
