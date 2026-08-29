import type { ReactNode } from "react";

/**
 * Outer app shell — a slim left nav rail plus the main content area.
 *
 * Scoped deliberately: real AJO has a dozen nav sections (Campaigns,
 * Landing pages, Decision Management, Content Management, Data Management,
 * Connections, Customer, Privacy, Administration, ...). This app only
 * builds journeys, so the rail has exactly one destination — see README →
 * "UI layout reference (target)" → "1. Outer app shell — left nav rail".
 * The other sections are omitted, not hidden, until a phase actually needs
 * them.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-slate-100">
      <nav
        aria-label="Primary"
        className="flex w-14 flex-shrink-0 flex-col items-center gap-1 border-r border-slate-800 bg-slate-900 py-3"
      >
        <div
          className="mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-slate-700 text-xs font-bold text-white"
          title="Journey builder"
          aria-hidden="true"
        >
          JB
        </div>
        <button
          type="button"
          aria-current="page"
          title="Journeys"
          className="flex w-11 flex-col items-center gap-1 rounded-md bg-slate-800 py-2 text-[10px] font-medium text-white"
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
