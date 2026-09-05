import { describe, expect, it } from "vitest";
import { parseHash, viewToHash } from "./route";

describe("parseHash", () => {
  it("defaults to the journeys list for an empty hash", () => {
    expect(parseHash("")).toEqual({ type: "journeys" });
  });

  it("defaults to the journeys list for an explicit #/journeys hash", () => {
    expect(parseHash("#/journeys")).toEqual({ type: "journeys" });
  });

  it("parses the events hash", () => {
    expect(parseHash("#/events")).toEqual({ type: "events" });
  });

  it("parses the catalogs hash", () => {
    expect(parseHash("#/catalogs")).toEqual({ type: "catalogs" });
  });

  it("parses an editor hash into a journeyId", () => {
    expect(parseHash("#/journey/abc-123")).toEqual({
      type: "editor",
      journeyId: "abc-123",
    });
  });

  it("decodes a URI-encoded journey id", () => {
    expect(parseHash("#/journey/abc%20123")).toEqual({
      type: "editor",
      journeyId: "abc 123",
    });
  });

  it("falls back to journeys for garbage input rather than throwing", () => {
    expect(parseHash("#/nonsense/path")).toEqual({ type: "journeys" });
    expect(parseHash("not-even-a-hash")).toEqual({ type: "journeys" });
  });

  it("falls back to journeys for an editor hash with an empty id", () => {
    expect(parseHash("#/journey/")).toEqual({ type: "journeys" });
  });
});

describe("viewToHash", () => {
  it("round-trips journeys/events/catalogs views", () => {
    expect(viewToHash({ type: "journeys" })).toBe("#/journeys");
    expect(viewToHash({ type: "events" })).toBe("#/events");
    expect(viewToHash({ type: "catalogs" })).toBe("#/catalogs");
  });

  it("round-trips an editor view, encoding the id", () => {
    const hash = viewToHash({ type: "editor", journeyId: "abc 123" });
    expect(hash).toBe("#/journey/abc%20123");
    expect(parseHash(hash)).toEqual({ type: "editor", journeyId: "abc 123" });
  });

  it("round-trips every parseHash output back through viewToHash and parseHash again", () => {
    const samples = ["#/journeys", "#/events", "#/catalogs", "#/journey/xyz-789"];
    for (const hash of samples) {
      const view = parseHash(hash);
      expect(parseHash(viewToHash(view))).toEqual(view);
    }
  });
});
