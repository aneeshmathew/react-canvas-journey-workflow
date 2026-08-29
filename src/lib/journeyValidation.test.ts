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
        expect.stringContaining("entry point"),
        expect.stringContaining("End"),
      ]),
    );
  });

  it("is valid for a minimal entry -> End journey", () => {
    const nodes = [
      node("entry-1", "entry-unitary-event", { eventKey: "signup" }),
      node("end-1", "end", { label: "End" }),
    ];
    const edges = [edge("entry-1", "end-1")];
    const result = validateJourney(nodes, edges);
    expect(result.isValid).toBe(true);
    expect(result.global).toHaveLength(0);
  });

  it("flags duplicate node labels", () => {
    const nodes = [
      node("entry-1", "entry-unitary-event", {
        label: "Start",
        eventKey: "signup",
      }),
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
      edge("entry-1", "audience-1"),
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

  it("requires an audience on Audience nodes", () => {
    const nodes = [
      node("entry-1", "entry-unitary-event", {
        label: "Start",
        eventKey: "signup",
      }),
      node("audience-1", "audience", { label: "Audience" }),
      node("end-1", "end", { label: "End" }),
    ];
    const edges = [edge("entry-1", "audience-1"), edge("audience-1", "end-1")];
    const result = validateJourney(nodes, edges);
    expect(result.byNode["audience-1"]).toEqual(
      expect.arrayContaining([expect.stringContaining("Audience")]),
    );
  });

  it("flags nodes that are not reachable from the entry point", () => {
    const nodes = [
      node("entry-1", "entry-unitary-event", {
        label: "Start",
        eventKey: "signup",
      }),
      node("end-1", "end", { label: "End" }),
      node("orphan", "audience", { label: "Orphan", segmentHint: "vip" }),
    ];
    const edges = [edge("entry-1", "end-1")];
    const result = validateJourney(nodes, edges);
    expect(result.byNode["orphan"]).toEqual(
      expect.arrayContaining([expect.stringContaining("Not reachable")]),
    );
  });

  it("rejects more than one entry point or End node", () => {
    const nodes = [
      node("entry-1", "entry-unitary-event", {
        label: "Entry 1",
        eventKey: "signup",
      }),
      node("entry-2", "entry-unitary-event", {
        label: "Entry 2",
        eventKey: "signup",
      }),
      node("end-1", "end", { label: "End 1" }),
      node("end-2", "end", { label: "End 2" }),
    ];
    const result = validateJourney(nodes, []);
    expect(result.isValid).toBe(false);
    expect(result.global).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Only one entry point"),
        expect.stringContaining("Only one End"),
      ]),
    );
  });

  it("rejects an entry point with an incoming connection", () => {
    const nodes = [
      node("entry-1", "entry-unitary-event", {
        label: "Start",
        eventKey: "signup",
      }),
      node("audience-1", "audience", { label: "Audience", segmentHint: "vip" }),
      node("end-1", "end", { label: "End" }),
    ];
    // audience-1 wrongly points back into the entry node
    const edges = [
      edge("entry-1", "audience-1"),
      edge("audience-1", "entry-1"),
      edge("audience-1", "end-1"),
    ];
    const result = validateJourney(nodes, edges);
    expect(result.isValid).toBe(false);
    expect(result.byNode["entry-1"]).toEqual(
      expect.arrayContaining([
        expect.stringContaining("can't have incoming connections"),
      ]),
    );
  });

  it("requires an event on Unitary Event and Business Event entry points", () => {
    const nodes = [
      node("entry-1", "entry-unitary-event", { label: "Start" }),
      node("end-1", "end", { label: "End" }),
    ];
    const edges = [edge("entry-1", "end-1")];
    const result = validateJourney(nodes, edges);
    expect(result.byNode["entry-1"]).toEqual(
      expect.arrayContaining([expect.stringContaining("Event is required")]),
    );
  });

  it("requires an audience on Read Audience and Audience Qualification entry points", () => {
    const nodes = [
      node("entry-1", "entry-audience-qualification", { label: "Start" }),
      node("end-1", "end", { label: "End" }),
    ];
    const edges = [edge("entry-1", "end-1")];
    const result = validateJourney(nodes, edges);
    expect(result.byNode["entry-1"]).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Audience is required"),
      ]),
    );
  });
});
