import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  onJourneysClick?: () => void;
  onEventsClick?: () => void;
};

/**
 * Outer app shell — a slim left nav rail plus the main content area.
 *
 * Scoped deliberately: full-featured journey-orchestration products
 * typically have a dozen nav sections (Campaigns, Landing pages, Decision
 * Management, Content Management, Data Management, Connections, Customer,
 * Privacy, Administration, ...). This app only builds journeys and manages
 * the events catalog they reference, so the rail has exactly two
 * destinations — see README → "UI layout reference (target)" → "1. Outer
 * app shell — left nav rail". Other sections are omitted, not hidden,
 * until a phase actually needs them.
 *
 * "Journeys" opens `PublishHistoryModal` (Phase 5) — see that component
 * for why it's a publish-history list rather than a real multi-journey
 * list. "Events" opens `EventsManagerModal` — a real, persisted catalog of
 * named events, distinct from the still-static Audiences/Templates lists.
 */
export function AppShell({ children, onJourneysClick, onEventsClick }: Props) {
  return (
    <div className="flex h-screen w-full bg-slate-100">
      <nav
        aria-label="Primary"
        className="flex w-14 flex-shrink-0 flex-col items-center gap-1 border-r border-slate-800 bg-slate-900 py-3"
      >
        <div
          className="mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-slate-700 text-xs font-bold text-white"
          title="Journey Flow"
          aria-hidden="true"
        >
          JF
        </div>
        <button
          type="button"
          title="Journeys"
          onClick={onJourneysClick}
          className="flex w-11 flex-col items-center gap-1 rounded-md bg-slate-800 py-2 text-[10px] font-medium text-white hover:bg-slate-700"
        >
          <span aria-hidden="true" className="text-base leading-none">
            🧭
          </span>
          Journeys
        </button>
        <button
          type="button"
          title="Events"
          onClick={onEventsClick}
          className="flex w-11 flex-col items-center gap-1 rounded-md py-2 text-[10px] font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          <span aria-hidden="true" className="text-base leading-none">
            ⚡
          </span>
          Events
        </button>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
