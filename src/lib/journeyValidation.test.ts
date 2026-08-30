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

function edge(source: string, target: string, sourceHandle?: string): Edge {
  return { id: `${source}->${target}-${sourceHandle ?? "x"}`, source, target, sourceHandle };
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

  it("requires a wait duration and unit on Wait nodes", () => {
    const nodes = [
      node("entry-1", "entry-unitary-event", { eventKey: "signup" }),
      node("wait-1", "wait", { label: "Wait" }),
      node("end-1", "end", { label: "End" }),
    ];
    const edges = [edge("entry-1", "wait-1"), edge("wait-1", "end-1")];
    const result = validateJourney(nodes, edges);
    expect(result.byNode["wait-1"]).toEqual(
      expect.arrayContaining([
        expect.stringContaining("duration"),
        expect.stringContaining("unit"),
      ]),
    );
  });

  it("passes Wait validation once duration and unit are set", () => {
    const nodes = [
      node("entry-1", "entry-unitary-event", { eventKey: "signup" }),
      node("wait-1", "wait", {
        label: "Wait",
        waitAmount: 2,
        waitUnit: "days",
      }),
      node("end-1", "end", { label: "End" }),
    ];
    const edges = [edge("entry-1", "wait-1"), edge("wait-1", "end-1")];
    const result = validateJourney(nodes, edges);
    expect(result.byNode["wait-1"] ?? []).toHaveLength(0);
  });

  it("flags a Condition branch with no outgoing connection", () => {
    const nodes = [
      node("entry-1", "entry-unitary-event", { eventKey: "signup" }),
      node("cond-1", "condition", { branches: ["Yes", "No"] }),
      node("end-1", "end", { label: "End" }),
    ];
    // Only "Yes" is wired up; "No" is dangling.
    const edges = [
      edge("entry-1", "cond-1"),
      edge("cond-1", "end-1", "Yes"),
    ];
    const result = validateJourney(nodes, edges);
    expect(result.byNode["cond-1"]).toEqual(
      expect.arrayContaining([expect.stringContaining('"No"')]),
    );
  });

  it("flags an edge left on a branch that no longer exists", () => {
    const nodes = [
      node("entry-1", "entry-unitary-event", { eventKey: "signup" }),
      node("cond-1", "condition", { branches: ["Yes", "No"] }),
      node("end-1", "end", { label: "End" }),
      node("end-2", "end", { label: "End 2" }),
    ];
    const edges = [
      edge("entry-1", "cond-1"),
      edge("cond-1", "end-1", "Yes"),
      edge("cond-1", "end-2", "No"),
      // stale handle left over from a renamed/removed branch
      edge("cond-1", "end-1", "Maybe"),
    ];
    const result = validateJourney(nodes, edges);
    expect(result.byNode["cond-1"]).toEqual(
      expect.arrayContaining([expect.stringContaining("no longer exists")]),
    );
  });

  it("passes a well-formed Condition with all branches connected", () => {
    const nodes = [
      node("entry-1", "entry-unitary-event", { eventKey: "signup" }),
      node("cond-1", "condition", { branches: ["Yes", "No"] }),
      node("end-1", "end", { label: "End" }),
      node("end-2", "end", { label: "End 2" }),
    ];
    const edges = [
      edge("entry-1", "cond-1"),
      edge("cond-1", "end-1", "Yes"),
      edge("cond-1", "end-2", "No"),
    ];
    const result = validateJourney(nodes, edges);
    // Two End nodes is otherwise rejected — isolate to the Condition's own messages.
    expect(result.byNode["cond-1"] ?? []).toHaveLength(0);
  });

  it("requires the error/timeout fallback to be connected once enabled", () => {
    const nodes = [
      node("entry-1", "entry-unitary-event", { eventKey: "signup" }),
      node("email-1", "email", {
        templateName: "welcome",
        hasErrorFallback: true,
      }),
      node("end-1", "end", { label: "End" }),
    ];
    const edges = [
      edge("entry-1", "email-1"),
      edge("email-1", "end-1", "out"),
    ];
    const result = validateJourney(nodes, edges);
    expect(result.byNode["email-1"]).toEqual(
      expect.arrayContaining([expect.stringContaining("fallback")]),
    );
  });

  it("requires a template on template-based Action nodes (Email, In-app, Content card)", () => {
    const nodes = [
      node("entry-1", "entry-unitary-event", { eventKey: "signup" }),
      node("act-1", "action-inapp", {}),
      node("end-1", "end", { label: "End" }),
    ];
    const edges = [edge("entry-1", "act-1"), edge("act-1", "end-1")];
    const result = validateJourney(nodes, edges);
    expect(result.byNode["act-1"]).toEqual(
      expect.arrayContaining([expect.stringContaining("Template")]),
    );
  });

  it("requires message text on SMS/Push Action nodes", () => {
    const nodes = [
      node("entry-1", "entry-unitary-event", { eventKey: "signup" }),
      node("act-1", "action-sms", {}),
      node("end-1", "end", { label: "End" }),
    ];
    const edges = [edge("entry-1", "act-1"), edge("act-1", "end-1")];
    const result = validateJourney(nodes, edges);
    expect(result.byNode["act-1"]).toEqual(
      expect.arrayContaining([expect.stringContaining("Message")]),
    );
  });

  it("requires configuration on Web/Code-based/Custom Action nodes", () => {
    const nodes = [
      node("entry-1", "entry-unitary-event", { eventKey: "signup" }),
      node("act-1", "action-code", {}),
      node("end-1", "end", { label: "End" }),
    ];
    const edges = [edge("entry-1", "act-1"), edge("act-1", "end-1")];
    const result = validateJourney(nodes, edges);
    expect(result.byNode["act-1"]).toEqual(
      expect.arrayContaining([expect.stringContaining("Configuration")]),
    );
  });

  it("passes a fully-configured Push Action node", () => {
    const nodes = [
      node("entry-1", "entry-unitary-event", { eventKey: "signup" }),
      node("act-1", "action-push", { messageBody: "You have a new offer!" }),
      node("end-1", "end", { label: "End" }),
    ];
    const edges = [edge("entry-1", "act-1"), edge("act-1", "end-1")];
    const result = validateJourney(nodes, edges);
    expect(result.byNode["act-1"] ?? []).toHaveLength(0);
  });

  it("requires a reaction type on Reaction event nodes", () => {
    const nodes = [
      node("entry-1", "entry-unitary-event", { eventKey: "signup" }),
      node("react-1", "event-reaction", {}),
      node("end-1", "end", { label: "End" }),
    ];
    const edges = [edge("entry-1", "react-1"), edge("react-1", "end-1")];
    const result = validateJourney(nodes, edges);
    expect(result.byNode["react-1"]).toEqual(
      expect.arrayContaining([expect.stringContaining("Reaction type")]),
    );
  });

  it("passes a Reaction event node once a reaction type is set", () => {
    const nodes = [
      node("entry-1", "entry-unitary-event", { eventKey: "signup" }),
      node("react-1", "event-reaction", { reactionKind: "opened" }),
      node("end-1", "end", { label: "End" }),
    ];
    const edges = [edge("entry-1", "react-1"), edge("react-1", "end-1")];
    const result = validateJourney(nodes, edges);
    expect(result.byNode["react-1"] ?? []).toHaveLength(0);
  });
});
