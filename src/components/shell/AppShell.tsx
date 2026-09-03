import type { ReactNode } from "react";

export type NavView = "journeys" | "events";

type Props = {
  children: ReactNode;
  activeView: NavView | null;
  onNavigate: (view: NavView) => void;
};

/**
 * Outer app shell — a slim left nav rail plus the main content area,
 * shared across every top-level view (Journeys list, Events list, and the
 * journey editor) so navigation state lives in one place (`App.tsx`)
 * instead of each view managing its own modals.
 *
 * Scoped deliberately: full-featured journey-orchestration products
 * typically have a dozen nav sections (Campaigns, Landing pages, Decision
 * Management, Content Management, Data Management, Connections, Customer,
 * Privacy, Administration, ...). This app only builds journeys and manages
 * the events catalog they reference, so the rail has exactly two
 * destinations. Other sections are omitted, not hidden, until a phase
 * actually needs them.
 */
export function AppShell({ children, activeView, onNavigate }: Props) {
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
          aria-current={activeView === "journeys" ? "page" : undefined}
          title="Journeys"
          onClick={() => onNavigate("journeys")}
          className={`flex w-11 flex-col items-center gap-1 rounded-md py-2 text-[10px] font-medium ${
            activeView === "journeys"
              ? "bg-slate-800 text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
        >
          <span aria-hidden="true" className="text-base leading-none">
            🧭
          </span>
          Journeys
        </button>
        <button
          type="button"
          aria-current={activeView === "events" ? "page" : undefined}
          title="Events"
          onClick={() => onNavigate("events")}
          className={`flex w-11 flex-col items-center gap-1 rounded-md py-2 text-[10px] font-medium ${
            activeView === "events"
              ? "bg-slate-800 text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
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
