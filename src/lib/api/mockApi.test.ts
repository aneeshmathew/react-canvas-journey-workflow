import { beforeEach, describe, expect, it } from "vitest";
import { createEvent, deleteEvent, fetchEvents } from "./mockApi";

describe("Events catalog (mockApi)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns a non-empty default catalog when nothing has been saved yet", async () => {
    const events = await fetchEvents();
    expect(events.length).toBeGreaterThan(0);
  });

  it("persists a newly created event so it shows up on the next fetch", async () => {
    const before = await fetchEvents();
    const created = await createEvent({
      name: "Trial started",
      description: "Fired when a free trial begins",
    });
    expect(created.name).toBe("Trial started");
    expect(created.id).toBeTruthy();

    const after = await fetchEvents();
    expect(after.length).toBe(before.length + 1);
    expect(after.some((e) => e.id === created.id)).toBe(true);
  });

  it("trims whitespace and drops an empty description", async () => {
    const created = await createEvent({ name: "  Padded name  ", description: "   " });
    expect(created.name).toBe("Padded name");
    expect(created.description).toBeUndefined();
  });

  it("deletes an event so it no longer appears on the next fetch", async () => {
    const created = await createEvent({ name: "Temporary event" });
    const withIt = await fetchEvents();
    expect(withIt.some((e) => e.id === created.id)).toBe(true);

    await deleteEvent(created.id);
    const withoutIt = await fetchEvents();
    expect(withoutIt.some((e) => e.id === created.id)).toBe(false);
  });
});
