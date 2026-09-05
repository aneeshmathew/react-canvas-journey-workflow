import { useEffect, useState } from "react";
import { AppShell, type NavView } from "@/components/shell/AppShell";
import { JourneysListPage } from "@/components/journeys/JourneysListPage";
import { EventsListPage } from "@/components/events/EventsListPage";
import { parseHash, viewToHash, type View } from "@/lib/route";
import { JourneyBuilder } from "./JourneyBuilder";

/**
 * Owns top-level navigation: the Journeys landing page (a data grid, not a
 * modal — see `JourneysListPage`), the Events landing page, and the journey
 * editor. All three share one `AppShell` so the nav rail's active state is
 * consistent regardless of which view is showing.
 *
 * Navigation state lives in the URL hash (`lib/route.ts`), not just in
 * memory — a plain `useState` meant refreshing the browser while inside the
 * editor silently dropped back to the Journeys list, with no back/forward
 * or bookmark support either. Three destinations didn't seem worth a
 * routing library, so this reads/writes `window.location.hash` directly.
 */
export default function App() {
  const [view, setView] = useState<View>(() =>
    parseHash(window.location.hash),
  );

  // Push the current view into the URL. Uses `history.pushState` rather
  // than assigning `location.hash` directly so this doesn't also trigger
  // the `hashchange` listener below (which would immediately call
  // `setView` again with the same value — harmless, but pointless).
  useEffect(() => {
    const nextHash = viewToHash(view);
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, "", nextHash);
    }
  }, [view]);

  // Back/forward buttons (and manual hash edits) change the hash without
  // going through `setView` — this is what makes those work.
  useEffect(() => {
    const onHashChange = () => setView(parseHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const activeNav: NavView | null =
    view.type === "editor" ? "journeys" : view.type;

  const handleNavigate = (next: NavView) => {
    setView({ type: next });
  };

  return (
    <AppShell activeView={activeNav} onNavigate={handleNavigate}>
      {view.type === "journeys" ? (
        <JourneysListPage
          onOpenJourney={(journeyId) => setView({ type: "editor", journeyId })}
        />
      ) : null}
      {view.type === "events" ? <EventsListPage /> : null}
      {view.type === "editor" ? (
        <JourneyBuilder
          journeyId={view.journeyId}
          onBack={() => setView({ type: "journeys" })}
        />
      ) : null}
    </AppShell>
  );
}
