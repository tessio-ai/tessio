// SPDX-License-Identifier: AGPL-3.0-only

/**
 * True when a keydown originates from a text-editing context, where global
 * single-key shortcuts (c, /, g…) must be suppressed.
 *
 * Covers native form fields and `contenteditable`, plus code editors like
 * Monaco: since v0.52 Monaco's editable element uses the EditContext API and is
 * a plain `<div class="native-edit-context">` — not a textarea and not
 * `isContentEditable` — so a tag/contentEditable check alone misses it. We treat
 * anything inside `.monaco-editor` as a typing context.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (/^(input|textarea|select)$/i.test(target.tagName)) return true;
  // `isContentEditable` reflects inherited editability in real browsers; the
  // attribute check is a fallback (and keeps this testable under jsdom).
  if (target.isContentEditable) return true;
  if (target.closest('[contenteditable="true"], [contenteditable=""]')) return true;
  return !!target.closest('.monaco-editor');
}
