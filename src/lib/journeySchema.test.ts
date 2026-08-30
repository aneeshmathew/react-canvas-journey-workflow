import { describe, expect, it } from "vitest";
import { defaultJourney, parseJourney, JOURNEY_VERSION } from "./journeySchema";

describe("parseJourney", () => {
  it("round-trips a freshly created default journey", () => {
    const doc = defaultJourney();
    const parsed = parseJourney(JSON.parse(JSON.stringify(doc)));
    expect(parsed.nodes).toHaveLength(1);
    expect(parsed.nodes[0]!.type).toBe("entry-unitary-event");
  });

  it("migrates a legacy 'start' node to 'entry-unitary-event'", () => {
    const legacy = {
      version: JOURNEY_VERSION,
      meta: { name: "Old journey" },
      nodes: [
        {
          id: "start-1",
          type: "start",
          position: { x: 0, y: 0 },
          data: { label: "Start" },
        },
      ],
      edges: [],
    };
    const parsed = parseJourney(legacy);
    expect(parsed.nodes[0]!.type).toBe("entry-unitary-event");
    expect(parsed.nodes[0]!.id).toBe("start-1"); // id is untouched, only type migrates
  });

  it("migrates a legacy 'email' node to 'action-email'", () => {
    const legacy = {
      version: JOURNEY_VERSION,
      meta: { name: "Old journey" },
      nodes: [
        {
          id: "email-1",
          type: "email",
          position: { x: 0, y: 0 },
          data: { label: "Send email", templateName: "welcome" },
        },
      ],
      edges: [],
    };
    const parsed = parseJourney(legacy);
    expect(parsed.nodes[0]!.type).toBe("action-email");
    expect(parsed.nodes[0]!.data.templateName).toBe("welcome");
  });

  it("rejects an unsupported version", () => {
    expect(() =>
      parseJourney({ version: 999, nodes: [], edges: [] }),
    ).toThrow(/version/i);
  });

  it("rejects a document missing nodes/edges arrays", () => {
    expect(() =>
      parseJourney({ version: JOURNEY_VERSION, nodes: [] }),
    ).toThrow(/edges/i);
  });
});
