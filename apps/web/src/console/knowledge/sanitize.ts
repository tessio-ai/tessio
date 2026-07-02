// SPDX-License-Identifier: AGPL-3.0-only

import DOMPurify from 'dompurify';

/**
 * Sanitize untrusted HTML before it reaches a `dangerouslySetInnerHTML` sink.
 *
 * Knowledge-base article bodies and AI ("Ask Tess") answers are rendered as HTML
 * for inline formatting (bold, links, lists). That content is authored by users
 * or produced by the model from user input, so it must be scrubbed of scripts,
 * event handlers, and other XSS vectors. We allow a small inline-formatting
 * vocabulary and force links to open safely.
 */
const ALLOWED_TAGS = [
  'p', 'br', 'span', 'b', 'strong', 'i', 'em', 'u', 's', 'code', 'pre', 'kbd',
  'a', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr',
];
const ALLOWED_ATTR = ['href', 'title', 'class', 'target', 'rel'];

// Any link that opens a new tab gets noopener/noreferrer (prevents reverse-tabnabbing).
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Block javascript:/data: URLs and other non-http(s) schemes on links.
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}
