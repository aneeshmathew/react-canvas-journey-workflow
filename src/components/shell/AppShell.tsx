import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  onJourneysClick?: () => void;
};

/**
 * Outer app shell — a slim left nav rail plus the main content area.
 *
 * Scoped deliberately: full-featured journey-orchestration products
 * typically have a dozen nav sections (Campaigns, Landing pages, Decision
 * Management, Content Management, Data Management, Connections, Customer,
 * Privacy, Administration, ...). This app only builds journeys, so the
 * rail has exactly one destination — see README → "UI layout reference
 * (target)" → "1. Outer app shell — left nav rail". The other sections are
 * omitted, not hidden, until a phase actually needs them.
 *
 * The "Journeys" item opens `PublishHistoryModal` (Phase 5) — see that
 * component for why it's a publish-history list rather than a real
 * multi-journey list.
 */
export function AppShell({ children, onJourneysClick }: Props) {
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
          aria-current="page"
          title="Journeys"
          onClick={onJourneysClick}
          className="flex w-11 flex-col items-center gap-1 rounded-md bg-slate-800 py-2 text-[10px] font-medium text-white hover:bg-slate-700"
        >
          <span aria-hidden="true" className="text-base leading-none">
            🧭
          </span>
          Journeys
        </button>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
