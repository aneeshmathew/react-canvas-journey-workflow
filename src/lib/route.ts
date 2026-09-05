export type View =
  | { type: "journeys" }
  | { type: "events" }
  | { type: "catalogs" }
  | { type: "editor"; journeyId: string };

/**
 * Turns `window.location.hash` into a `View`. Deliberately not a routing
 * library — there are only four destinations, so reading/writing the hash
 * directly (see `viewToHash`) is enough to get refresh persistence and
 * back/forward-button support without adding a dependency.
 *
 * Unrecognized or malformed hashes fall back to the Journeys list rather
 * than throwing — a bad/stale URL shouldn't be able to break the app.
 */
export function parseHash(hash: string): View {
  const clean = hash.replace(/^#\/?/, "");
  if (clean.startsWith("journey/")) {
    const id = decodeURIComponent(clean.slice("journey/".length));
    if (id) return { type: "editor", journeyId: id };
  }
  if (clean === "events") return { type: "events" };
  if (clean === "catalogs") return { type: "catalogs" };
  return { type: "journeys" };
}

export function viewToHash(view: View): string {
  switch (view.type) {
    case "editor":
      return `#/journey/${encodeURIComponent(view.journeyId)}`;
    case "events":
      return "#/events";
    case "catalogs":
      return "#/catalogs";
    case "journeys":
      return "#/journeys";
    default:
      return "#/journeys";
  }
}
