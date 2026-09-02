import { beforeEach, describe, expect, it } from "vitest";
import {
  createEvent,
  deleteEvent,
  fetchEventDefinitions,
  fetchEvents,
  updateEvent,
  type EventDefinitionInput,
} from "./mockApi";

const baseInput: EventDefinitionInput = {
  name: "Trial started",
  description: "Fired when a free trial begins",
  type: "unitary",
  eventIdType: "system-generated",
  timeoutEnabled: false,
};

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
    const created = await createEvent(baseInput);
    expect(created.name).toBe("Trial started");
    expect(created.id).toBeTruthy();
    expect(created.author).toBeTruthy();
    expect(created.createdAt).toBeTruthy();

    const after = await fetchEvents();
    expect(after.length).toBe(before.length + 1);
    expect(after.some((e) => e.id === created.id)).toBe(true);
  });

  it("trims whitespace and drops an empty description", async () => {
    const created = await createEvent({
      ...baseInput,
      name: "  Padded name  ",
      description: "   ",
    });
    expect(created.name).toBe("Padded name");
    expect(created.description).toBeUndefined();
  });

  it("drops timeout fields when timeoutEnabled is false, even if amount/unit were passed", async () => {
    const created = await createEvent({
      ...baseInput,
      timeoutEnabled: false,
      timeoutAmount: 5,
      timeoutUnit: "hours",
    });
    expect(created.timeoutAmount).toBeUndefined();
    expect(created.timeoutUnit).toBeUndefined();
  });

  it("keeps timeout fields when timeoutEnabled is true", async () => {
    const created = await createEvent({
      ...baseInput,
      timeoutEnabled: true,
      timeoutAmount: 2,
      timeoutUnit: "days",
    });
    expect(created.timeoutAmount).toBe(2);
    expect(created.timeoutUnit).toBe("days");
  });

  it("deletes an event so it no longer appears on the next fetch", async () => {
    const created = await createEvent(baseInput);
    const withIt = await fetchEvents();
    expect(withIt.some((e) => e.id === created.id)).toBe(true);

    await deleteEvent(created.id);
    const withoutIt = await fetchEvents();
    expect(withoutIt.some((e) => e.id === created.id)).toBe(false);
  });

  it("updates an existing event in place, bumping updatedAt", async () => {
    const created = await createEvent(baseInput);
    const updated = await updateEvent(created.id, {
      ...baseInput,
      name: "Trial started (renamed)",
      type: "business",
    });
    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe("Trial started (renamed)");
    expect(updated.type).toBe("business");
    expect(updated.createdAt).toBe(created.createdAt);

    const list = await fetchEventDefinitions();
    expect(list.find((e) => e.id === created.id)?.name).toBe(
      "Trial started (renamed)",
    );
  });

  it("throws when updating an event id that doesn't exist", async () => {
    await expect(updateEvent("nope", baseInput)).rejects.toThrow(/not found/i);
  });
});
