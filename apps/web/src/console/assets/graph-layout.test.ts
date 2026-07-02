// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { layoutRadial } from './graph-layout';

describe('layoutRadial', () => {
  it('places the center then distributes nodes on a ring by index', () => {
    const { center, nodes } = layoutRadial(
      [{ id: 'b', linkId: 'l-b', label: 'B', kind: 'asset', relationship: 'depends_on' },
       { id: 'c', linkId: 'l-c', label: 'C', kind: 'ticket', relationship: 'runs_on' }],
      { width: 400, height: 400, radius: 150 },
    );
    expect(center).toEqual({ x: 200, y: 200 });
    expect(nodes).toHaveLength(2);
    expect(Math.round(nodes[0].y)).toBe(50);
    expect(Math.round(nodes[0].x)).toBe(200);
    nodes.forEach((n) => { expect(n.x).toBeGreaterThanOrEqual(0); expect(n.x).toBeLessThanOrEqual(400); });
  });
  it('returns empty nodes for no links', () => {
    expect(layoutRadial([], { width: 400, height: 400, radius: 150 }).nodes).toEqual([]);
  });
});
