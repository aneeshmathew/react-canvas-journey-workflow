import { useState } from "react";
import { AppShell, type NavView } from "@/components/shell/AppShell";
import { JourneysListPage } from "@/components/journeys/JourneysListPage";
import { EventsListPage } from "@/components/events/EventsListPage";
import { JourneyBuilder } from "./JourneyBuilder";

type View = { type: "journeys" } | { type: "events" } | { type: "editor"; journeyId: string };

/**
 * Owns top-level navigation: the Journeys landing page (a data grid, not a
 * modal — see `JourneysListPage`), the Events landing page, and the journey
 * editor. All three share one `AppShell` so the nav rail's active state is
 * consistent regardless of which view is showing.
 */
export default function App() {
  const [view, setView] = useState<View>({ type: "journeys" });

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
