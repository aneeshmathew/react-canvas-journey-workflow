/**
 * Mock API layer.
 *
 * This module stands in for a real backend so the rest of the app can start
 * consuming data through TanStack Query hooks (see `@/hooks/queries`) instead
 * of calling `localStorage` directly. Journeys, Events, Test runs, Fragments,
 * and Publish history are all backed by `localStorage` under the hood today
 * — swapping them for real `fetch()` calls later should not require touching
 * any component, only this file and the query hooks that wrap it.
 */
import {
  defaultJourney,
  parseJourney,
  serializeJourney,
  type JourneyDocument,
  type JourneyNodeData,
} from "@/lib/journeySchema";
import type { PublishBundle } from "@/lib/publishBundle";
import { loadFromLocalStorage } from "@/lib/storage";
import type { Edge, Node } from "@xyflow/react";

/** Simulated network latency so loading states are real and visible in dev. */
function delay<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });
}

// --- Journeys: a real, multi-journey collection ---------------------------
//
// Each journey's full document lives under its own `localStorage` key
// (`journeyDocKey(id)`); a lightweight index (`JOURNEYS_INDEX_KEY`) holds
// just the summary fields a list page needs, so listing journeys doesn't
// require loading every document. This replaced the original single-journey
// model (one document under a fixed key) once real multi-journey CRUD was
// requested — see README → Journeys landing page.

export type JourneySummary = {
  id: string;
  name: string;
  description?: string;
  updatedAt: string;
  nodeCount: number;
  edgeCount: number;
};

const JOURNEYS_INDEX_KEY = "journey-builder:journeys-index";

function journeyDocKey(id: string): string {
  return `journey-builder:journey:${id}`;
}

function loadIndex(): JourneySummary[] {
  try {
    const raw = localStorage.getItem(JOURNEYS_INDEX_KEY);
    return raw ? (JSON.parse(raw) as JourneySummary[]) : [];
  } catch {
    return [];
  }
}

function saveIndex(list: JourneySummary[]): void {
  try {
    localStorage.setItem(JOURNEYS_INDEX_KEY, JSON.stringify(list));
  } catch {
    /* quota or private mode */
  }
}

function summarize(id: string, doc: JourneyDocument): JourneySummary {
  return {
    id,
    name: doc.meta?.name ?? "Untitled journey",
    description: doc.meta?.description,
    updatedAt: doc.meta?.updatedAt ?? new Date().toISOString(),
    nodeCount: doc.nodes.length,
    edgeCount: doc.edges.length,
  };
}

/**
 * One-time migration: if the index has never been written but the old
 * single-journey key has data, adopt it as the first journey instead of
 * silently losing whatever was being worked on. Safe to call repeatedly —
 * it only acts when the index key is completely absent (not just empty),
 * so deleting the last journey doesn't re-trigger it.
 */
function migrateLegacySingleJourneyIfNeeded(): void {
  try {
    if (localStorage.getItem(JOURNEYS_INDEX_KEY) !== null) return;
    const legacyRaw = loadFromLocalStorage();
    if (!legacyRaw) {
      saveIndex([]);
      return;
    }
    const doc = parseJourney(JSON.parse(legacyRaw));
    const id = crypto.randomUUID();
    localStorage.setItem(journeyDocKey(id), serializeJourney(doc));
    saveIndex([summarize(id, doc)]);
  } catch {
    saveIndex([]);
  }
}

export async function listJourneys(): Promise<JourneySummary[]> {
  migrateLegacySingleJourneyIfNeeded();
  return delay(
    loadIndex().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    150,
  );
}

export async function fetchJourney(id: string): Promise<JourneyDocument> {
  try {
    const raw = localStorage.getItem(journeyDocKey(id));
    if (raw) return delay(parseJourney(JSON.parse(raw)), 200);
  } catch {
    /* fall through to a default so a bad id doesn't crash the editor */
  }
  return delay(defaultJourney(), 200);
}

export async function createJourney(
  name = "Untitled journey",
): Promise<JourneySummary> {
  migrateLegacySingleJourneyIfNeeded();
  const doc = defaultJourney();
  doc.meta = { ...doc.meta, name };
  const id = crypto.randomUUID();
  localStorage.setItem(journeyDocKey(id), serializeJourney(doc));
  const summary = summarize(id, doc);
  saveIndex([summary, ...loadIndex()]);
  return delay(summary, 150);
}

export async function saveJourney(
  id: string,
  doc: JourneyDocument,
): Promise<JourneyDocument> {
  const stamped: JourneyDocument = {
    ...doc,
    meta: { ...doc.meta, updatedAt: new Date().toISOString() },
  };
  localStorage.setItem(journeyDocKey(id), serializeJourney(stamped));
  const index = loadIndex();
  const i = index.findIndex((j) => j.id === id);
  const summary = summarize(id, stamped);
  if (i === -1) {
    index.unshift(summary);
  } else {
    index[i] = summary;
  }
  saveIndex(index);
  return delay(stamped, 150);
}

export async function deleteJourney(id: string): Promise<void> {
  saveIndex(loadIndex().filter((j) => j.id !== id));
  try {
    localStorage.removeItem(journeyDocKey(id));
  } catch {
    /* ignore */
  }
  return delay(undefined, 150);
}

export type PublishResult = {
  publishedAt: string;
  bundle: unknown;
};

const PUBLISH_HISTORY_KEY = "journey-builder:publish-history";

export type PublishRecord = {
  id: string;
  journeyId: string;
  journeyName: string;
  publishedAt: string;
  nodeCount: number;
  edgeCount: number;
  compilerWarningCount: number;
};

function loadPublishHistory(): PublishRecord[] {
  try {
    const raw = localStorage.getItem(PUBLISH_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as PublishRecord[]) : [];
  } catch {
    return [];
  }
}

function savePublishHistory(records: PublishRecord[]): void {
  try {
    localStorage.setItem(PUBLISH_HISTORY_KEY, JSON.stringify(records));
  } catch {
    /* quota or private mode */
  }
}

/**
 * Stand-in for a real publish endpoint. Today this just timestamps the
 * bundle that `lib/publishBundle.ts` already builds, and records a
 * lightweight structural summary to `localStorage`, scoped to the journey
 * that was published — a real backend call slots in here without touching
 * the UI layer.
 */
export async function publishJourney(
  journeyId: string,
  bundle: PublishBundle,
): Promise<PublishResult> {
  const record: PublishRecord = {
    id: crypto.randomUUID(),
    journeyId,
    journeyName: bundle.journey.meta?.name ?? "Untitled journey",
    publishedAt: new Date().toISOString(),
    nodeCount: bundle.journey.nodes.length,
    edgeCount: bundle.journey.edges.length,
    compilerWarningCount: bundle.compilerWarnings.length,
  };
  savePublishHistory([record, ...loadPublishHistory()].slice(0, 200));
  return delay({ publishedAt: record.publishedAt, bundle }, 300);
}

export async function listPublishHistory(
  journeyId: string,
): Promise<PublishRecord[]> {
  return delay(
    loadPublishHistory().filter((r) => r.journeyId === journeyId),
    100,
  );
}

export type CatalogItem = {
  id: string;
  name: string;
  description?: string;
};

const AUDIENCES: CatalogItem[] = [
  { id: "aud-newsletter", name: "Newsletter subscribers" },
  { id: "aud-vip", name: "VIP customers" },
  { id: "aud-churn-risk", name: "Churn risk" },
  { id: "aud-loyalty-gold", name: "Loyalty program — Gold members" },
];

const TEMPLATES: CatalogItem[] = [
  { id: "tpl-welcome", name: "Welcome email" },
  { id: "tpl-cart-reminder", name: "Cart reminder" },
  { id: "tpl-winback", name: "Win-back offer" },
];

export async function fetchAudiences(): Promise<CatalogItem[]> {
  return delay(AUDIENCES, 120);
}

export async function fetchMessageTemplates(): Promise<CatalogItem[]> {
  return delay(TEMPLATES, 120);
}

// --- Events catalog: persisted and user-editable --------------------------
//
// Unlike Audiences/Templates (still a static mock list), Events are a real,
// user-managed catalog — see the "Events" nav item / `EventsListPage`.
// Creating an event here immediately shows up as a `<datalist>` suggestion
// in the Inspector's event-key field for any event-based node. Audiences
// and Templates could follow the same pattern later; scoped to Events only
// for now since that's what was asked for.

export type EventIdType = "system-generated" | "custom";
export type EventTimeoutUnit = "minutes" | "hours" | "days";

export type EventDefinition = {
  id: string;
  /** Called "Label" in the editor UI — kept as `name` here so the rest of the app (which reads `CatalogItem.name`) doesn't need a special case. */
  name: string;
  description?: string;
  type: "unitary" | "business";
  eventIdType: EventIdType;
  timeoutEnabled: boolean;
  timeoutAmount?: number;
  timeoutUnit?: EventTimeoutUnit;
  /** Single-user mock app — always the same placeholder author, kept as a field for layout/structural fidelity rather than a real identity system. */
  author: string;
  createdAt: string;
  updatedAt: string;
};

const EVENTS_KEY = "journey-builder:events";
const MOCK_AUTHOR = "You";

function makeDefaultEvent(id: string, name: string): EventDefinition {
  const now = new Date().toISOString();
  return {
    id,
    name,
    type: "unitary",
    eventIdType: "system-generated",
    timeoutEnabled: false,
    author: MOCK_AUTHOR,
    createdAt: now,
    updatedAt: now,
  };
}

const DEFAULT_EVENTS: EventDefinition[] = [
  makeDefaultEvent("evt-signup", "Account sign-up"),
  makeDefaultEvent("evt-cart-abandon", "Cart abandoned"),
  makeDefaultEvent("evt-purchase", "Purchase completed"),
  makeDefaultEvent("evt-lobby-beacon", "Lobby beacon check-in"),
];

function loadEvents(): EventDefinition[] {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    if (raw) return JSON.parse(raw) as EventDefinition[];
  } catch {
    /* fall through to defaults */
  }
  // Return a copy, not the shared constant — callers like `createEvent`
  // push onto whatever this returns, and mutating `DEFAULT_EVENTS` itself
  // would silently corrupt every subsequent "no saved events yet" read.
  return DEFAULT_EVENTS.map((e) => ({ ...e }));
}

function saveEventsList(list: EventDefinition[]): void {
  try {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(list));
  } catch {
    /* quota or private mode */
  }
}

/** `useEventsQuery` / the Inspector's `<datalist>` only need id+name+description, so this keeps that call site unchanged even though Events grew richer fields. */
export async function fetchEvents(): Promise<CatalogItem[]> {
  return delay(
    loadEvents().map(({ id, name, description }) => ({ id, name, description })),
    120,
  );
}

export async function fetchEventDefinitions(): Promise<EventDefinition[]> {
  return delay(loadEvents(), 120);
}

export type EventDefinitionInput = {
  name: string;
  description?: string;
  type: EventDefinition["type"];
  eventIdType: EventIdType;
  timeoutEnabled: boolean;
  timeoutAmount?: number;
  timeoutUnit?: EventTimeoutUnit;
};

export async function createEvent(
  input: EventDefinitionInput,
): Promise<EventDefinition> {
  const now = new Date().toISOString();
  const item: EventDefinition = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    type: input.type,
    eventIdType: input.eventIdType,
    timeoutEnabled: input.timeoutEnabled,
    timeoutAmount: input.timeoutEnabled ? input.timeoutAmount : undefined,
    timeoutUnit: input.timeoutEnabled ? input.timeoutUnit : undefined,
    author: MOCK_AUTHOR,
    createdAt: now,
    updatedAt: now,
  };
  const list = loadEvents();
  list.push(item);
  saveEventsList(list);
  return delay(item, 150);
}

export async function updateEvent(
  id: string,
  input: EventDefinitionInput,
): Promise<EventDefinition> {
  const list = loadEvents();
  const idx = list.findIndex((e) => e.id === id);
  if (idx === -1) {
    throw new Error(`Event "${id}" not found.`);
  }
  const updated: EventDefinition = {
    ...list[idx]!,
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    type: input.type,
    eventIdType: input.eventIdType,
    timeoutEnabled: input.timeoutEnabled,
    timeoutAmount: input.timeoutEnabled ? input.timeoutAmount : undefined,
    timeoutUnit: input.timeoutEnabled ? input.timeoutUnit : undefined,
    updatedAt: new Date().toISOString(),
  };
  list[idx] = updated;
  saveEventsList(list);
  return delay(updated, 150);
}

export async function deleteEvent(id: string): Promise<void> {
  saveEventsList(loadEvents().filter((e) => e.id !== id));
  return delay(undefined, 100);
}

// --- Phase 4: Test mode profiles + persisted test runs -------------------
//
// "Test mode" walks a small set of *persistent* test profiles through
// the journey, one branch decision at a time — distinct from Simulation
// (ephemeral, walks every branch automatically) and Dry run (also
// exhaustive, but framed as "production-shaped data, no real sends"). Since
// this app has no rule-based Condition logic (branches are named, not
// evaluated against profile attributes — see README → Phase 2), a profile's
// path through a Condition can't be computed automatically; a person
// chooses it by hand in `TestModeModal`, and that choice is what gets
// persisted here.

export type TestProfile = {
  id: string;
  name: string;
  description: string;
  traits: string[];
};

const TEST_PROFILES: TestProfile[] = [
  {
    id: "profile-vip",
    name: "Priya Shah",
    description: "Loyalty Gold member, frequent purchaser",
    traits: ["VIP", "Loyalty Gold"],
  },
  {
    id: "profile-new",
    name: "Sam Rivera",
    description: "Signed up yesterday, no purchases yet",
    traits: ["New signup"],
  },
  {
    id: "profile-cart",
    name: "Jordan Lee",
    description: "Added items to cart, did not check out",
    traits: ["Cart abandoner"],
  },
];

export async function fetchTestProfiles(): Promise<TestProfile[]> {
  return delay(TEST_PROFILES, 120);
}

export type TestRunStep = {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  /** The branch/fallback label chosen to leave this step, if any. */
  choiceLabel?: string;
};

export type TestRun = {
  id: string;
  /**
   * This app doesn't have a journey list/id yet (see README → Non-goals /
   * Phase 5), so runs are scoped to a constant "current journey" bucket
   * rather than a real journey id. Swapping in real ids is additive once
   * Phase 5 introduces a journey list.
   */
  journeyKey: string;
  profileId: string;
  steps: TestRunStep[];
  reachedEnd: boolean;
  completedAt: string;
};

const TEST_RUNS_KEY = "journey-builder:test-runs";

function loadAllTestRuns(): TestRun[] {
  try {
    const raw = localStorage.getItem(TEST_RUNS_KEY);
    return raw ? (JSON.parse(raw) as TestRun[]) : [];
  } catch {
    return [];
  }
}

function saveAllTestRuns(runs: TestRun[]): void {
  try {
    localStorage.setItem(TEST_RUNS_KEY, JSON.stringify(runs));
  } catch {
    /* quota or private mode */
  }
}

export async function fetchTestRuns(
  journeyKey: string,
  profileId: string,
): Promise<TestRun[]> {
  const runs = loadAllTestRuns()
    .filter((r) => r.journeyKey === journeyKey && r.profileId === profileId)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  return delay(runs, 100);
}

export async function saveTestRun(
  run: Omit<TestRun, "id" | "completedAt">,
): Promise<TestRun> {
  const stamped: TestRun = {
    ...run,
    id: crypto.randomUUID(),
    completedAt: new Date().toISOString(),
  };
  const runs = loadAllTestRuns();
  runs.push(stamped);
  saveAllTestRuns(runs);
  return delay(stamped, 150);
}

// --- Backlog: Journey Fragments -------------------------------------------
//
// A small, reusable library of node/edge bundles a person can drop back
// onto the canvas — see README → Backlog. Saving/inserting id-remapping and
// position handling live in `lib/cloneGraph.ts`; this module is just
// persistence.

export type JourneyFragment = {
  id: string;
  name: string;
  description?: string;
  nodes: Node<JourneyNodeData>[];
  edges: Edge[];
  createdAt: string;
};

const FRAGMENTS_KEY = "journey-builder:fragments";

function loadFragments(): JourneyFragment[] {
  try {
    const raw = localStorage.getItem(FRAGMENTS_KEY);
    return raw ? (JSON.parse(raw) as JourneyFragment[]) : [];
  } catch {
    return [];
  }
}

function saveFragmentsList(list: JourneyFragment[]): void {
  try {
    localStorage.setItem(FRAGMENTS_KEY, JSON.stringify(list));
  } catch {
    /* quota or private mode */
  }
}

export async function listFragments(): Promise<JourneyFragment[]> {
  return delay(
    loadFragments().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    120,
  );
}

export async function saveFragment(input: {
  name: string;
  description?: string;
  nodes: Node<JourneyNodeData>[];
  edges: Edge[];
}): Promise<JourneyFragment> {
  const stamped: JourneyFragment = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  saveFragmentsList([stamped, ...loadFragments()].slice(0, 50));
  return delay(stamped, 150);
}

export async function deleteFragment(id: string): Promise<void> {
  saveFragmentsList(loadFragments().filter((f) => f.id !== id));
  return delay(undefined, 100);
}
