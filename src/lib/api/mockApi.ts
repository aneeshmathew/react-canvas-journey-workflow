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

/**
 * Stand-in for a real publish endpoint. Today this just timestamps the
 * bundle that `lib/publishBundle.ts` already builds — a real backend call
 * slots in here without touching the UI layer.
 */
export async function publishJourney(bundle: unknown): Promise<PublishResult> {
  return delay({ publishedAt: new Date().toISOString(), bundle }, 300);
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
