import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { findSingleEntryNode, getWalkOptions } from "./testModeWalk";
import type { JourneyNodeData } from "./journeySchema";

function node(
  id: string,
  type: string,
  data: Partial<JourneyNodeData> = {},
): Node<JourneyNodeData> {
  return { id, type, position: { x: 0, y: 0 }, data: { label: id, ...data } };
}

function edge(source: string, target: string, sourceHandle?: string): Edge {
  return { id: `${source}->${target}-${sourceHandle ?? "x"}`, source, target, sourceHandle };
}

describe("findSingleEntryNode", () => {
  it("returns the entry node when exactly one exists", () => {
    const nodes = [node("entry-1", "entry-unitary-event"), node("end-1", "end")];
    expect(findSingleEntryNode(nodes)?.id).toBe("entry-1");
  });

  it("returns null with zero or multiple entry nodes", () => {
    expect(findSingleEntryNode([node("end-1", "end")])).toBeNull();
    expect(
      findSingleEntryNode([
        node("entry-1", "entry-unitary-event"),
        node("entry-2", "entry-unitary-event"),
      ]),
    ).toBeNull();
  });
});

describe("getWalkOptions", () => {
  it("labels options with the target's own label when there's no branch handle", () => {
    const nodes = [node("a", "audience", { label: "Audience A" }), node("b", "email")];
    const edges = [edge("a", "b")];
    const options = getWalkOptions("a", nodes, edges);
    expect(options).toHaveLength(1);
    expect(options[0]!.branchLabel).toBeUndefined();
    expect(options[0]!.targetId).toBe("b");
  });

  it("labels options with the branch name for a Condition node", () => {
    const nodes = [
      node("cond", "condition", { branches: ["Yes", "No"] }),
      node("email-1", "email"),
      node("end-1", "end"),
    ];
    const edges = [
      edge("cond", "email-1", "Yes"),
      edge("cond", "end-1", "No"),
    ];
    const options = getWalkOptions("cond", nodes, edges);
    expect(options.map((o) => o.branchLabel).sort()).toEqual(["No", "Yes"]);
  });

  it("returns an empty list at a dead end", () => {
    const nodes = [node("a", "audience")];
    expect(getWalkOptions("a", nodes, [])).toHaveLength(0);
  });
});
