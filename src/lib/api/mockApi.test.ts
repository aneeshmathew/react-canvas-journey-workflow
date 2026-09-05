import { beforeEach, describe, expect, it } from "vitest";
import {
  createAudience,
  createEvent,
  createJourney,
  createTemplate,
  deleteAudience,
  deleteEvent,
  deleteJourney,
  deleteTemplate,
  fetchAudienceDefinitions,
  fetchAudiences,
  fetchEventDefinitions,
  fetchEvents,
  fetchJourney,
  fetchMessageTemplates,
  fetchTemplateDefinitions,
  listJourneys,
  saveJourney,
  updateAudience,
  updateEvent,
  updateTemplate,
  type EventDefinitionInput,
} from "./mockApi";
import { saveToLocalStorage } from "@/lib/storage";
import { defaultJourney } from "@/lib/journeySchema";

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

describe("Journeys (mockApi)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts with an empty list when nothing has been saved", async () => {
    const journeys = await listJourneys();
    expect(journeys).toEqual([]);
  });

  it("creates a journey and lists it with a summary", async () => {
    const summary = await createJourney("My first journey");
    expect(summary.name).toBe("My first journey");
    expect(summary.nodeCount).toBeGreaterThan(0); // defaultJourney() seeds one entry node

    const journeys = await listJourneys();
    expect(journeys).toHaveLength(1);
    expect(journeys[0]!.id).toBe(summary.id);
  });

  it("fetches the full document for a created journey by id", async () => {
    const summary = await createJourney("Fetch me");
    const doc = await fetchJourney(summary.id);
    expect(doc.meta?.name).toBe("Fetch me");
    expect(doc.nodes.length).toBeGreaterThan(0);
  });

  it("falls back to a default document for an unknown id rather than throwing", async () => {
    const doc = await fetchJourney("does-not-exist");
    expect(doc.nodes.length).toBeGreaterThan(0);
  });

  it("saves changes to a journey and reflects them in the list summary", async () => {
    const summary = await createJourney("Original name");
    const doc = await fetchJourney(summary.id);
    const renamed = { ...doc, meta: { ...doc.meta, name: "Renamed" } };

    await saveJourney(summary.id, renamed);

    const journeys = await listJourneys();
    expect(journeys.find((j) => j.id === summary.id)?.name).toBe("Renamed");
  });

  it("deletes a journey so it no longer appears in the list", async () => {
    const summary = await createJourney("Temporary");
    await deleteJourney(summary.id);
    const journeys = await listJourneys();
    expect(journeys.some((j) => j.id === summary.id)).toBe(false);
  });

  it("keeps journeys independent — saving one doesn't affect another", async () => {
    const a = await createJourney("Journey A");
    const b = await createJourney("Journey B");
    const docA = await fetchJourney(a.id);
    await saveJourney(a.id, { ...docA, meta: { ...docA.meta, name: "A renamed" } });

    const journeys = await listJourneys();
    expect(journeys.find((j) => j.id === a.id)?.name).toBe("A renamed");
    expect(journeys.find((j) => j.id === b.id)?.name).toBe("Journey B");
  });

  it("migrates a pre-existing legacy single journey into the list on first read", async () => {
    const legacyDoc = defaultJourney();
    legacyDoc.meta = { ...legacyDoc.meta, name: "Legacy journey" };
    saveToLocalStorage(legacyDoc);

    const journeys = await listJourneys();
    expect(journeys).toHaveLength(1);
    expect(journeys[0]!.name).toBe("Legacy journey");

    const doc = await fetchJourney(journeys[0]!.id);
    expect(doc.meta?.name).toBe("Legacy journey");
  });

  it("does not re-migrate (and duplicate) the legacy journey on a second read", async () => {
    const legacyDoc = defaultJourney();
    saveToLocalStorage(legacyDoc);

    await listJourneys();
    await createJourney("A second, unrelated journey");
    const journeys = await listJourneys();

    expect(journeys).toHaveLength(2);
  });
});

describe("Audiences catalog (mockApi)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns a non-empty default catalog when nothing has been saved yet", async () => {
    const audiences = await fetchAudiences();
    expect(audiences.length).toBeGreaterThan(0);
  });

  it("creates, persists, and lists a new audience", async () => {
    const before = await fetchAudiences();
    const created = await createAudience({
      name: "Frequent buyers",
      description: "3+ purchases in 90 days",
    });
    expect(created.name).toBe("Frequent buyers");
    expect(created.author).toBeTruthy();

    const after = await fetchAudiences();
    expect(after.length).toBe(before.length + 1);
  });

  it("updates an audience in place", async () => {
    const created = await createAudience({ name: "Original" });
    const updated = await updateAudience(created.id, { name: "Renamed" });
    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe("Renamed");

    const list = await fetchAudienceDefinitions();
    expect(list.find((a) => a.id === created.id)?.name).toBe("Renamed");
  });

  it("deletes an audience", async () => {
    const created = await createAudience({ name: "Temporary" });
    await deleteAudience(created.id);
    const after = await fetchAudiences();
    expect(after.some((a) => a.id === created.id)).toBe(false);
  });

  it("throws when updating an audience id that doesn't exist", async () => {
    await expect(
      updateAudience("nope", { name: "x" }),
    ).rejects.toThrow(/not found/i);
  });

  it("does not mutate the shared defaults when reading twice with nothing saved", async () => {
    // Regression test for the reference-sharing bug caught earlier in the
    // Events catalog (see README) — guards the same pattern here too.
    const first = await fetchAudiences();
    await createAudience({ name: "New one" });
    const second = await fetchAudiences();
    expect(second.length).toBe(first.length + 1);
  });
});

describe("Message templates catalog (mockApi)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns a non-empty default catalog when nothing has been saved yet", async () => {
    const templates = await fetchMessageTemplates();
    expect(templates.length).toBeGreaterThan(0);
  });

  it("creates a template with a channel and persists it", async () => {
    const created = await createTemplate({
      name: "SMS reminder",
      description: "Sent 1 hour before an appointment",
      channel: "action-sms",
    });
    expect(created.channel).toBe("action-sms");

    const list = await fetchTemplateDefinitions();
    expect(list.some((t) => t.id === created.id)).toBe(true);
  });

  it("updates a template's channel", async () => {
    const created = await createTemplate({
      name: "Push test",
      channel: "action-push",
    });
    const updated = await updateTemplate(created.id, {
      name: "Push test",
      channel: "action-inapp",
    });
    expect(updated.channel).toBe("action-inapp");
  });

  it("deletes a template", async () => {
    const created = await createTemplate({
      name: "Temp template",
      channel: "action-email",
    });
    await deleteTemplate(created.id);
    const list = await fetchTemplateDefinitions();
    expect(list.some((t) => t.id === created.id)).toBe(false);
  });

  it("throws when updating a template id that doesn't exist", async () => {
    await expect(
      updateTemplate("nope", { name: "x", channel: "action-email" }),
    ).rejects.toThrow(/not found/i);
  });
});
