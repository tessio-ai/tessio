// SPDX-License-Identifier: AGPL-3.0-only

import type { FieldWidth } from '@tessio/shared';

/** Map a field width to a Tailwind column span on a 6-column section grid. */
export function widthToColSpan(width: FieldWidth): string {
  switch (width) {
    case 'half':
      return 'col-span-3';
    case 'third':
      return 'col-span-2';
    default:
      return 'col-span-6';
  }
}
