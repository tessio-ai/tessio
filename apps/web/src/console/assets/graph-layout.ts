// SPDX-License-Identifier: AGPL-3.0-only

export interface GraphNodeInput { id: string; linkId: string; label: string; kind: string; relationship: string }
export interface PlacedNode extends GraphNodeInput { x: number; y: number }
export interface LayoutOpts { width: number; height: number; radius: number }

/** Deterministic radial layout: center node in the middle, links evenly spaced on a ring
 *  starting at the top (-90deg) going clockwise. */
export function layoutRadial(links: GraphNodeInput[], opts: LayoutOpts): { center: { x: number; y: number }; nodes: PlacedNode[] } {
  const center = { x: opts.width / 2, y: opts.height / 2 };
  const n = links.length;
  const nodes = links.map((l, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(n, 1);
    return { ...l, x: center.x + opts.radius * Math.cos(angle), y: center.y + opts.radius * Math.sin(angle) };
  });
  return { center, nodes };
}
