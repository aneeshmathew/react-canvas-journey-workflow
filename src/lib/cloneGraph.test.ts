import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { cloneNodesAndEdges, normalizePositions } from "./cloneGraph";
import type { JourneyNodeData } from "./journeySchema";

function node(
  id: string,
  type: string,
  data: Partial<JourneyNodeData> = {},
): Node<JourneyNodeData> {
  return { id, type, position: { x: 0, y: 0 }, data: { label: id, ...data } };
}

function edge(source: string, target: string): Edge {
  return { id: `${source}->${target}`, source, target };
}

function idFactory() {
  let n = 0;
  return () => `new-${n++}`;
}

describe("cloneNodesAndEdges", () => {
  it("assigns fresh ids and offsets positions", () => {
    const nodes = [
      { ...node("a", "audience"), position: { x: 10, y: 10 } },
      { ...node("b", "email"), position: { x: 50, y: 10 } },
    ];
    const edges = [edge("a", "b")];
    const result = cloneNodesAndEdges(nodes, edges, { x: 20, y: 30 }, idFactory());

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes.map((n) => n.id)).toEqual(["new-0", "new-1"]);
    expect(result.nodes[0]!.position).toEqual({ x: 30, y: 40 });
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]!.source).toBe("new-0");
    expect(result.edges[0]!.target).toBe("new-1");
    expect(result.skippedEntryCount).toBe(0);
  });

  it("marks cloned nodes as selected", () => {
    const nodes = [node("a", "audience")];
    const result = cloneNodesAndEdges(nodes, [], { x: 0, y: 0 }, idFactory());
    expect(result.nodes[0]!.selected).toBe(true);
  });

  it("drops entry-point nodes and reports how many were skipped", () => {
    const nodes = [
      node("entry-1", "entry-unitary-event"),
      node("a", "audience"),
    ];
    const edges = [edge("entry-1", "a")];
    const result = cloneNodesAndEdges(nodes, edges, { x: 0, y: 0 }, idFactory());

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]!.id).toBe("new-0");
    expect(result.skippedEntryCount).toBe(1);
    // The edge from the dropped entry node has nowhere to reconnect to.
    expect(result.edges).toHaveLength(0);
  });

  it("drops edges that reach outside the cloned node set", () => {
    const nodes = [node("a", "audience")]; // "b" is deliberately not included
    const edges = [edge("a", "b")];
    const result = cloneNodesAndEdges(nodes, edges, { x: 0, y: 0 }, idFactory());
    expect(result.edges).toHaveLength(0);
  });

  it("deep-copies node data so mutating the clone doesn't affect the original", () => {
    const original = node("a", "audience", { segmentHint: "vip" });
    const result = cloneNodesAndEdges([original], [], { x: 0, y: 0 }, idFactory());
    result.nodes[0]!.data.segmentHint = "changed";
    expect(original.data.segmentHint).toBe("vip");
  });
});

describe("normalizePositions", () => {
  it("shifts nodes so the top-left bounding corner sits at (0, 0)", () => {
    const nodes = [
      { ...node("a", "audience"), position: { x: 100, y: 50 } },
      { ...node("b", "email"), position: { x: 180, y: 20 } },
    ];
    const result = normalizePositions(nodes);
    expect(result[0]!.position).toEqual({ x: 0, y: 30 });
    expect(result[1]!.position).toEqual({ x: 80, y: 0 });
  });

  it("returns an empty array unchanged", () => {
    expect(normalizePositions([])).toEqual([]);
  });
});
