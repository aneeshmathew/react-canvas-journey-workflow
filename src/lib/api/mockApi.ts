/**
 * Mock API layer (Phase 0).
 *
 * This module stands in for a real backend so the rest of the app can start
 * consuming data through TanStack Query hooks (see `@/hooks/queries`) instead
 * of calling `localStorage` directly. `fetchJourney` / `saveJourney` are
 * backed by `localStorage` under the hood today — swapping them for real
 * `fetch()` calls later should not require touching any component, only this
 * file and the query hooks that wrap it.
 *
 * `fetchAudiences` / `fetchEvents` / `fetchMessageTemplates` model the
 * catalogs AJO reads from (Audiences, Events, Message templates). They're
 * static in-memory lists for now — Phase 3 is expected to wire real
 * selections from these catalogs into the Inspector per node type.
 */
import {
  defaultJourney,
  parseJourney,
  type JourneyDocument,
} from "@/lib/journeySchema";
import type { PublishBundle } from "@/lib/publishBundle";
import { loadFromLocalStorage, saveToLocalStorage } from "@/lib/storage";

/** Simulated network latency so loading states are real and visible in dev. */
function delay<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });
}

export async function fetchJourney(): Promise<JourneyDocument> {
  let doc: JourneyDocument;
  try {
    const raw = loadFromLocalStorage();
    doc = raw ? parseJourney(JSON.parse(raw)) : defaultJourney();
  } catch {
    doc = defaultJourney();
  }
  return delay(doc, 200);
}

export async function saveJourney(
  doc: JourneyDocument,
): Promise<JourneyDocument> {
  const stamped: JourneyDocument = {
    ...doc,
    meta: { ...doc.meta, updatedAt: new Date().toISOString() },
  };
  saveToLocalStorage(stamped);
  return delay(stamped, 150);
}

export type PublishResult = {
  publishedAt: string;
  bundle: unknown;
};

const PUBLISH_HISTORY_KEY = "journey-builder:publish-history";

export type PublishRecord = {
  id: string;
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
 * lightweight structural summary to `localStorage` so the app has
 * somewhere to show "publish history" (see `listPublishHistory` and
 * `AppShell`'s Journeys nav) — a real backend call slots in here without
 * touching the UI layer.
 *
 * Scope note: this app remains single-journey (see README → Non-goals), so
 * "publish history" is a list of past publishes of *the one journey being
 * edited*, not a multi-journey list. A real journey list is a larger,
 * deliberately deferred architectural change — see README → Phase 5.
 */
export async function publishJourney(
  bundle: PublishBundle,
): Promise<PublishResult> {
  const record: PublishRecord = {
    id: crypto.randomUUID(),
    journeyName: bundle.journey.meta?.name ?? "Untitled journey",
    publishedAt: new Date().toISOString(),
    nodeCount: bundle.journey.nodes.length,
    edgeCount: bundle.journey.edges.length,
    compilerWarningCount: bundle.compilerWarnings.length,
  };
  savePublishHistory([record, ...loadPublishHistory()].slice(0, 50));
  return delay({ publishedAt: record.publishedAt, bundle }, 300);
}

export async function listPublishHistory(): Promise<PublishRecord[]> {
  return delay(loadPublishHistory(), 100);
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

const EVENTS: CatalogItem[] = [
  { id: "evt-signup", name: "Account sign-up" },
  { id: "evt-cart-abandon", name: "Cart abandoned" },
  { id: "evt-purchase", name: "Purchase completed" },
  { id: "evt-lobby-beacon", name: "Lobby beacon check-in" },
];

const TEMPLATES: CatalogItem[] = [
  { id: "tpl-welcome", name: "Welcome email" },
  { id: "tpl-cart-reminder", name: "Cart reminder" },
  { id: "tpl-winback", name: "Win-back offer" },
];

export async function fetchAudiences(): Promise<CatalogItem[]> {
  return delay(AUDIENCES, 120);
}

export async function fetchEvents(): Promise<CatalogItem[]> {
  return delay(EVENTS, 120);
}

export async function fetchMessageTemplates(): Promise<CatalogItem[]> {
  return delay(TEMPLATES, 120);
}

// --- Phase 4: Test mode profiles + persisted test runs -------------------
//
// AJO's "Test mode" walks a small set of *persistent* test profiles through
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
export const CURRENT_JOURNEY_KEY = "current";

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
