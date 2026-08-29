type Props = {
  journeyName: string;
  onJourneyNameChange: (name: string) => void;
  isSaving: boolean;
  alertsCount: number;
  onTogglePropertiesPanel: () => void;
  propertiesPanelOpen: boolean;
  onDelete: () => void;
};

/**
 * Mirrors the AJO screenshot's top bar: back arrow, editable journey name,
 * a Journey/Draft/Version/saved-status row, and a right-aligned action
 * cluster (Alerts, Manage access, Test mode, Delete, info). This replaces
 * the old flat `.app-toolbar` for journey-identity concerns — the extra
 * authoring tools this app has that AJO's chrome doesn't (Import/Export/
 * Simulate/Dry run/Undo/Redo/Zoom) live in a secondary row below it, since
 * they aren't part of AJO's actual header.
 *
 * Not everything here is wired up yet: "Manage access" and "Test mode" are
 * intentionally disabled stubs so the layout matches the reference now,
 * without pretending those features exist before their phases land (Test
 * mode is Phase 4 — see README → Roadmap).
 */
export function JourneyEditorHeader({
  journeyName,
  onJourneyNameChange,
  isSaving,
  alertsCount,
  onTogglePropertiesPanel,
  propertiesPanelOpen,
  onDelete,
}: Props) {
  return (
    <header className="border-b border-slate-200 bg-white px-4 py-2.5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Back"
          title="Back"
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
        >
          ←
        </button>
        <input
          aria-label="Journey name"
          value={journeyName}
          onChange={(e) => onJourneyNameChange(e.target.value)}
          className="min-w-0 flex-shrink border-b border-transparent bg-transparent text-base font-semibold text-slate-900 hover:border-slate-300 focus:border-blue-500 focus:outline-none"
        />
        <span aria-hidden="true" className="text-slate-400">
          ✎
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={alertsCount === 0}
            title={
              alertsCount > 0
                ? `${alertsCount} validation issue(s)`
                : "No alerts"
            }
          >
            <span aria-hidden="true">⚠</span>
            Alerts ({alertsCount})
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-400"
            disabled
            title="Not implemented yet — no multi-user/permissions model in this authoring tool"
          >
            <span aria-hidden="true">🔑</span>
            Manage access
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-400"
            disabled
            title="Test mode is planned for a later phase — see README Roadmap"
          >
            Test mode
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            title="Clear this journey and start a new one"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={onTogglePropertiesPanel}
            aria-pressed={propertiesPanelOpen}
            aria-label="Journey properties"
            title="Journey properties (name, description)"
            className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs ${
              propertiesPanelOpen
                ? "border-blue-500 bg-blue-50 text-blue-600"
                : "border-slate-300 text-slate-500 hover:bg-slate-50"
            }`}
          >
            ⓘ
          </button>
        </div>
      </div>
      <div className="mt-1 flex items-center gap-2 pl-10 text-xs text-slate-500">
        <span>Journey</span>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1">
          <span
            aria-hidden="true"
            className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400"
          />
          Draft
        </span>
        <span aria-hidden="true">·</span>
        <span>Version 1 (Latest)</span>
        <span aria-hidden="true">·</span>
        <span role="status" className="inline-flex items-center gap-1">
          {isSaving ? (
            "Saving…"
          ) : (
            <>
              <span aria-hidden="true" className="text-emerald-500">
                ✓
              </span>
              Saved
            </>
          )}
        </span>
      </div>
    </header>
  );
}
