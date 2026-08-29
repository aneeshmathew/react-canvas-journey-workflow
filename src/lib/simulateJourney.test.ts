import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { simulateJourney } from "./simulateJourney";
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

describe("simulateJourney", () => {
  it("fails when there is no Start node", () => {
    const result = simulateJourney([node("end-1", "end")], []);
    expect(result.ok).toBe(false);
  });

  it("fails when there is more than one Start node", () => {
    const nodes = [node("start-1", "start"), node("start-2", "start")];
    const result = simulateJourney(nodes, []);
    expect(result.ok).toBe(false);
  });

  it("walks a simple Start -> End path", () => {
    const nodes = [node("start-1", "start"), node("end-1", "end")];
    const edges = [edge("start-1", "end-1")];
    const result = simulateJourney(nodes, edges);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.steps.map((s) => s.id)).toEqual(["start-1", "end-1"]);
      expect(result.warnings).toHaveLength(0);
    }
  });

  it("reports a dead end when the path never reaches End", () => {
    const nodes = [node("start-1", "start"), node("audience-1", "audience")];
    const edges = [edge("start-1", "audience-1")];
    const result = simulateJourney(nodes, edges);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/dead end/i);
    }
  });

  it("detects a cycle", () => {
    const nodes = [
      node("start-1", "start"),
      node("audience-1", "audience"),
      node("audience-2", "audience"),
    ];
    const edges = [
      edge("start-1", "audience-1"),
      edge("audience-1", "audience-2"),
      edge("audience-2", "audience-1"),
    ];
    const result = simulateJourney(nodes, edges);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/cycle/i);
    }
  });

  it("warns and picks the alphabetically-first target on a branch", () => {
    const nodes = [
      node("start-1", "start"),
      node("audience-b", "audience"),
      node("audience-a", "audience"),
      node("end-1", "end"),
    ];
    const edges = [
      edge("start-1", "audience-b"),
      edge("start-1", "audience-a"),
      edge("audience-a", "end-1"),
      edge("audience-b", "end-1"),
    ];
    const result = simulateJourney(nodes, edges);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // "audience-a" sorts before "audience-b"
      expect(result.steps.map((s) => s.id)).toEqual([
        "start-1",
        "audience-a",
        "end-1",
      ]);
      expect(result.warnings.length).toBeGreaterThan(0);
    }
  });
});
