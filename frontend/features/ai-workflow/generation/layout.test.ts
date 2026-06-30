import { describe, expect, it } from "vitest";

import {
  LAYOUT_COLUMN_X,
  LAYOUT_ROW_GAP,
  LAYOUT_TOP_OFFSET,
  layoutVertical,
} from "@/features/ai-workflow/generation/layout";

describe("layoutVertical", () => {
  it("places every node at a constant x", () => {
    const nodes = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const laid = layoutVertical(nodes);
    for (const node of laid) {
      expect(node.position.x).toBe(LAYOUT_COLUMN_X);
    }
  });

  it("yields strictly increasing, non-overlapping y values", () => {
    const nodes = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    const ys = layoutVertical(nodes).map((node) => node.position.y);

    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]).toBeGreaterThan(ys[i - 1]);
      expect(ys[i] - ys[i - 1]).toBe(LAYOUT_ROW_GAP);
    }
    expect(ys[0]).toBe(LAYOUT_TOP_OFFSET);
  });

  it("preserves the original node fields", () => {
    const nodes = [{ id: "a", type: "OPENAI" as const, foo: 1 }];
    const [laid] = layoutVertical(nodes);
    expect(laid.id).toBe("a");
    expect(laid.type).toBe("OPENAI");
    expect(laid.foo).toBe(1);
    expect(laid.position).toEqual({ x: LAYOUT_COLUMN_X, y: LAYOUT_TOP_OFFSET });
  });

  it("returns an empty list unchanged", () => {
    expect(layoutVertical([])).toEqual([]);
  });
});
