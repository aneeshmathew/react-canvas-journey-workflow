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

function edge(source: string, target: string, sourceHandle?: string): Edge {
  return { id: `${source}->${target}-${sourceHandle ?? "x"}`, source, target, sourceHandle };
}

describe("simulateJourney", () => {
  it("fails when there is no entry point", () => {
    const result = simulateJourney([node("end-1", "end")], []);
    expect(result.ok).toBe(false);
  });

  it("fails when there is more than one entry point", () => {
    const nodes = [node("entry-1", "entry-unitary-event"), node("entry-2", "entry-unitary-event")];
    const result = simulateJourney(nodes, []);
    expect(result.ok).toBe(false);
  });

  it("walks a simple entry -> End path", () => {
    const nodes = [node("entry-1", "entry-unitary-event"), node("end-1", "end")];
    const edges = [edge("entry-1", "end-1")];
    const result = simulateJourney(nodes, edges);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0]!.steps.map((s) => s.id)).toEqual([
        "entry-1",
        "end-1",
      ]);
      expect(result.warnings).toHaveLength(0);
    }
  });

  it("reports a dead end when a path never reaches End", () => {
    const nodes = [node("entry-1", "entry-unitary-event"), node("audience-1", "audience")];
    const edges = [edge("entry-1", "audience-1")];
    const result = simulateJourney(nodes, edges);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/dead end/i);
    }
  });

  it("detects a true cycle", () => {
    const nodes = [
      node("entry-1", "entry-unitary-event"),
      node("audience-1", "audience"),
      node("audience-2", "audience"),
    ];
    const edges = [
      edge("entry-1", "audience-1"),
      edge("audience-1", "audience-2"),
      edge("audience-2", "audience-1"),
    ];
    const result = simulateJourney(nodes, edges);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/cycle/i);
    }
  });

  it("does NOT treat re-converging branches as a cycle", () => {
    // entry -> [audience-a, audience-b] -> both feed into the same end node.
    // This is a diamond, not a cycle: each path walks the shared node once.
    const nodes = [
      node("entry-1", "entry-unitary-event"),
      node("audience-a", "audience"),
      node("audience-b", "audience"),
      node("end-1", "end"),
    ];
    const edges = [
      edge("entry-1", "audience-a"),
      edge("entry-1", "audience-b"),
      edge("audience-a", "end-1"),
      edge("audience-b", "end-1"),
    ];
    const result = simulateJourney(nodes, edges);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.paths).toHaveLength(2);
      expect(result.warnings.length).toBeGreaterThan(0);
    }
  });

  it("simulates every named branch of a Condition node", () => {
    const nodes = [
      node("entry-1", "entry-unitary-event"),
      node("cond-1", "condition", { branches: ["Yes", "No"] }),
      node("email-1", "email"),
      node("end-1", "end"),
    ];
    const edges = [
      edge("entry-1", "cond-1"),
      edge("cond-1", "email-1", "Yes"),
      edge("cond-1", "end-1", "No"),
      edge("email-1", "end-1"),
    ];
    const result = simulateJourney(nodes, edges);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.paths).toHaveLength(2);
      // No warning: Condition fan-out is expected, unlike ambiguous branching.
      expect(result.warnings).toHaveLength(0);

      const branchLabels = result.paths
        .map((p) => p.steps.find((s) => s.branchLabel)?.branchLabel)
        .sort();
      expect(branchLabels).toEqual(["No", "Yes"]);
    }
  });

  it("labels a path that uses the error/timeout fallback handle", () => {
    const nodes = [
      node("entry-1", "entry-unitary-event"),
      node("email-1", "email", { hasErrorFallback: true }),
      node("end-1", "end"),
    ];
    const edges = [
      edge("entry-1", "email-1"),
      edge("email-1", "end-1", "out"),
      edge("email-1", "end-1", "error-fallback"),
    ];
    const result = simulateJourney(nodes, edges);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.paths).toHaveLength(2);
      const labels = result.paths.map(
        (p) => p.steps.find((s) => s.branchLabel)?.branchLabel,
      );
      expect(labels).toContain("error-fallback");
    }
  });
});
