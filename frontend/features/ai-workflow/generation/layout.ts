/** Constant horizontal position for every node in the generated column. */
export const LAYOUT_COLUMN_X = 250;
/** Vertical distance between consecutive nodes. */
export const LAYOUT_ROW_GAP = 160;
/** Vertical offset of the first node from the top. */
export const LAYOUT_TOP_OFFSET = 50;

/**
 * Arrange nodes into a single clean vertical column with no overlap.
 *
 * Each node keeps its original fields and gains a `position`: x is constant
 * (`LAYOUT_COLUMN_X`) and y increases by `LAYOUT_ROW_GAP` per index, starting
 * at `LAYOUT_TOP_OFFSET`. Generic so it works on plan-derived node descriptors
 * or full React Flow nodes alike.
 */
export function layoutVertical<T extends { id: string }>(
  nodes: T[],
): (T & { position: { x: number; y: number } })[] {
  return nodes.map((node, index) => ({
    ...node,
    position: {
      x: LAYOUT_COLUMN_X,
      y: index * LAYOUT_ROW_GAP + LAYOUT_TOP_OFFSET,
    },
  }));
}
