import { describe, expect, it } from "vitest";
import { journeyToN8nWorkflow } from "./n8n";
import { JOURNEY_VERSION, type JourneyDocument } from "@/lib/journeySchema";

function doc(overrides: Partial<JourneyDocument>): JourneyDocument {
  return {
    version: JOURNEY_VERSION,
    meta: { name: "Test journey" },
    nodes: [],
    edges: [],
    ...overrides,
  };
}

describe("journeyToN8nWorkflow", () => {
  it("compiles one n8n node per journey node, keyed by label as name", () => {
    const journey = doc({
      nodes: [
        {
          id: "e1",
          type: "entry-unitary-event",
          position: { x: 10, y: 20 },
          data: { label: "Entry", eventKey: "signup" },
        },
        {
          id: "end1",
          type: "end",
          position: { x: 100, y: 20 },
          data: { label: "End" },
        },
      ],
      edges: [{ id: "e1->end1", source: "e1", target: "end1" }],
    });
    const { workflow, warnings } = journeyToN8nWorkflow(journey);
    expect(workflow.nodes).toHaveLength(2);
    expect(workflow.nodes.map((n) => n.name)).toEqual(["Entry", "End"]);
    expect(workflow.nodes[0]!.type).toBe("n8n-nodes-base.webhook");
    expect(workflow.nodes[1]!.type).toBe("n8n-nodes-base.noOp");
    expect(workflow.connections["Entry"]?.main[0]).toEqual([
      { node: "End", type: "main", index: 0 },
    ]);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("maps Read Audience entries to a schedule trigger, not a webhook", () => {
    const journey = doc({
      nodes: [
        {
          id: "e1",
          type: "entry-read-audience",
          position: { x: 0, y: 0 },
          data: { label: "Entry", segmentHint: "VIP" },
        },
      ],
    });
    const { workflow } = journeyToN8nWorkflow(journey);
    expect(workflow.nodes[0]!.type).toBe("n8n-nodes-base.scheduleTrigger");
  });

  it("maps a Condition's branches to ordered Switch output slots", () => {
    const journey = doc({
      nodes: [
        {
          id: "c1",
          type: "condition",
          position: { x: 0, y: 0 },
          data: { label: "Cond", branches: ["Yes", "No"] },
        },
        { id: "a", type: "end", position: { x: 0, y: 0 }, data: { label: "A" } },
        { id: "b", type: "end", position: { x: 0, y: 0 }, data: { label: "B" } },
      ],
      edges: [
        { id: "c1->a", source: "c1", target: "a", sourceHandle: "Yes" },
        { id: "c1->b", source: "c1", target: "b", sourceHandle: "No" },
      ],
    });
    const { workflow } = journeyToN8nWorkflow(journey);
    expect(workflow.nodes[0]!.type).toBe("n8n-nodes-base.switch");
    const slots = workflow.connections["Cond"]!.main;
    expect(slots).toHaveLength(2);
    expect(slots[0]).toEqual([{ node: "A", type: "main", index: 0 }]);
    expect(slots[1]).toEqual([{ node: "B", type: "main", index: 0 }]);
  });

  it("gives an Action node with the error/timeout fallback a second output slot", () => {
    const journey = doc({
      nodes: [
        {
          id: "act1",
          type: "action-email",
          position: { x: 0, y: 0 },
          data: { label: "Send", templateName: "welcome", hasErrorFallback: true },
        },
        { id: "ok", type: "end", position: { x: 0, y: 0 }, data: { label: "OK" } },
        {
          id: "fallback",
          type: "end",
          position: { x: 0, y: 0 },
          data: { label: "Fallback" },
        },
      ],
      edges: [
        { id: "act1->ok", source: "act1", target: "ok", sourceHandle: "out" },
        {
          id: "act1->fallback",
          source: "act1",
          target: "fallback",
          sourceHandle: "error-fallback",
        },
      ],
    });
    const { workflow } = journeyToN8nWorkflow(journey);
    expect(workflow.nodes[0]!.type).toBe("n8n-nodes-base.emailSend");
    const slots = workflow.connections["Send"]!.main;
    expect(slots).toHaveLength(2);
    expect(slots[0]).toEqual([{ node: "OK", type: "main", index: 0 }]);
    expect(slots[1]).toEqual([{ node: "Fallback", type: "main", index: 0 }]);
  });

  it("omits a fallback output slot when the node has no fallback edge", () => {
    const journey = doc({
      nodes: [
        {
          id: "act1",
          type: "action-sms",
          position: { x: 0, y: 0 },
          data: { label: "Text", messageBody: "Hi" },
        },
        { id: "ok", type: "end", position: { x: 0, y: 0 }, data: { label: "OK" } },
      ],
      edges: [{ id: "act1->ok", source: "act1", target: "ok", sourceHandle: "out" }],
    });
    const { workflow } = journeyToN8nWorkflow(journey);
    expect(workflow.connections["Text"]!.main).toHaveLength(1);
  });

  it("treats the deprecated 'email' literal like action-email", () => {
    const journey = doc({
      nodes: [
        {
          id: "e1",
          type: "email",
          position: { x: 0, y: 0 },
          data: { label: "Legacy email", templateName: "welcome" },
        },
      ],
    });
    const { workflow } = journeyToN8nWorkflow(journey);
    expect(workflow.nodes[0]!.type).toBe("n8n-nodes-base.emailSend");
  });
});
