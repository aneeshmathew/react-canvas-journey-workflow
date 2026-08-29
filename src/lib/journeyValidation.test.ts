import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { validateJourney } from "./journeyValidation";
import type { JourneyNodeData } from "./journeySchema";

function node(
  id: string,
  type: string,
  data: Partial<JourneyNodeData> = {},
): Node<JourneyNodeData> {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { label: id, ...data },
  };
}

function edge(source: string, target: string): Edge {
  return { id: `${source}->${target}`, source, target };
}

describe("validateJourney", () => {
  it("is invalid with no nodes at all", () => {
    const result = validateJourney([], []);
    expect(result.isValid).toBe(false);
    expect(result.global).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Start"),
        expect.stringContaining("End"),
      ]),
    );
  });

  it("is valid for a minimal Start -> End journey", () => {
    const nodes = [
      node("start-1", "start", { label: "Start" }),
      node("end-1", "end", { label: "End" }),
    ];
    const edges = [edge("start-1", "end-1")];
    const result = validateJourney(nodes, edges);
    expect(result.isValid).toBe(true);
    expect(result.global).toHaveLength(0);
  });

  it("flags duplicate node labels", () => {
    const nodes = [
      node("start-1", "start", { label: "Start" }),
      node("audience-1", "audience", {
        label: "Same Name",
        segmentHint: "vip",
      }),
      node("audience-2", "audience", {
        label: "Same Name",
        segmentHint: "vip",
      }),
      node("end-1", "end", { label: "End" }),
    ];
    const edges = [
      edge("start-1", "audience-1"),
      edge("audience-1", "audience-2"),
      edge("audience-2", "end-1"),
    ];
    const result = validateJourney(nodes, edges);
    expect(result.isValid).toBe(false);
    expect(result.byNode["audience-1"]).toEqual(
      expect.arrayContaining([expect.stringContaining("Duplicate label")]),
    );
    expect(result.byNode["audience-2"]).toEqual(
      expect.arrayContaining([expect.stringContaining("Duplicate label")]),
    );
  });

  it("requires a segment hint on Audience nodes", () => {
    const nodes = [
      node("start-1", "start", { label: "Start" }),
      node("audience-1", "audience", { label: "Audience" }),
      node("end-1", "end", { label: "End" }),
    ];
    const edges = [edge("start-1", "audience-1"), edge("audience-1", "end-1")];
    const result = validateJourney(nodes, edges);
    expect(result.byNode["audience-1"]).toEqual(
      expect.arrayContaining([expect.stringContaining("Segment hint")]),
    );
  });

  it("flags nodes that are not reachable from Start", () => {
    const nodes = [
      node("start-1", "start", { label: "Start" }),
      node("end-1", "end", { label: "End" }),
      node("orphan", "audience", { label: "Orphan", segmentHint: "vip" }),
    ];
    const edges = [edge("start-1", "end-1")];
    const result = validateJourney(nodes, edges);
    expect(result.byNode["orphan"]).toEqual(
      expect.arrayContaining([expect.stringContaining("Not reachable")]),
    );
  });

  it("rejects more than one Start or End node", () => {
    const nodes = [
      node("start-1", "start", { label: "Start 1" }),
      node("start-2", "start", { label: "Start 2" }),
      node("end-1", "end", { label: "End 1" }),
      node("end-2", "end", { label: "End 2" }),
    ];
    const result = validateJourney(nodes, []);
    expect(result.isValid).toBe(false);
    expect(result.global).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Only one Start"),
        expect.stringContaining("Only one End"),
      ]),
    );
  });
});
