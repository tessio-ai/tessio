// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, afterEach } from 'vitest';
import { isTypingTarget } from './keyboard';

function el(tag: string, opts: { contentEditable?: boolean; parentClass?: string } = {}): HTMLElement {
  const node = document.createElement(tag);
  if (opts.contentEditable) node.setAttribute('contenteditable', 'true');
  if (opts.parentClass) {
    const parent = document.createElement('div');
    parent.className = opts.parentClass;
    parent.appendChild(node);
    document.body.appendChild(parent);
  } else {
    document.body.appendChild(node);
  }
  return node;
}

afterEach(() => { document.body.innerHTML = ''; });

describe('isTypingTarget', () => {
  it('treats native form fields as typing contexts', () => {
    expect(isTypingTarget(el('input'))).toBe(true);
    expect(isTypingTarget(el('textarea'))).toBe(true);
    expect(isTypingTarget(el('select'))).toBe(true);
  });
  it('treats contenteditable as a typing context', () => {
    expect(isTypingTarget(el('div', { contentEditable: true }))).toBe(true);
  });
  it('treats Monaco (a plain div inside .monaco-editor) as a typing context', () => {
    expect(isTypingTarget(el('div', { parentClass: 'monaco-editor' }))).toBe(true);
  });
  it('is false for ordinary elements and non-elements', () => {
    expect(isTypingTarget(el('button'))).toBe(false);
    expect(isTypingTarget(el('div'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(window)).toBe(false);
  });
});
