import { usePublishHistoryQuery } from "@/hooks/queries/useJourneyQueries";

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * The Phase 5 roadmap called for "a minimal journey list so publish has
 * somewhere to go besides a JSON download." This app is still
 * single-journey (see README → Non-goals) — building real multi-journey
 * CRUD would mean threading a journey id through the store, queries, and
 * `JourneyBuilder` that Phases 0-4 were built around, which is a bigger,
 * deliberately deferred architectural change, not a Phase 5 add-on.
 *
 * What's genuinely buildable within that constraint: a history of past
 * publishes of *this* journey, each with a structural summary (node/edge
 * counts, compiler warning count) and a re-download link for that bundle's
 * JSON. That's what this shows — it's honestly a "publish history" list,
 * not a "journey list", and is labeled that way rather than implying
 * multi-journey support that doesn't exist.
 */
export function PublishHistoryModal({ open, onClose }: Props) {
  const historyQuery = usePublishHistoryQuery();

  if (!open) return null;

  return (
    <div className="exec-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="exec-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-history-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="publish-history-title">Journeys</h2>
        <p className="exec-modal-note">
          This app edits a single journey (see the README's Non-goals), so this is
          a history of past publishes of that journey, not a multi-journey list.
          Each row is a structural snapshot — no real delivery/reporting data
          exists (see README → Non-goals on reporting).
        </p>
        {historyQuery.isPending ? <p>Loading publish history…</p> : null}
        {historyQuery.data && historyQuery.data.length === 0 ? (
          <p className="test-mode-history-empty">
            Nothing published yet — use the Publish button once your journey is
            valid.
          </p>
        ) : null}
        {historyQuery.data && historyQuery.data.length > 0 ? (
          <ul className="publish-history-list">
            {historyQuery.data.map((r) => (
              <li key={r.id} className="publish-history-row">
                <div className="publish-history-row__main">
                  <strong>{r.journeyName}</strong>
                  <span className="publish-history-row__time">
                    {new Date(r.publishedAt).toLocaleString()}
                  </span>
                </div>
                <div className="publish-history-row__stats">
                  <span>{r.nodeCount} nodes</span>
                  <span>{r.edgeCount} edges</span>
                  {r.compilerWarningCount > 0 ? (
                    <span className="publish-history-row__warning">
                      {r.compilerWarningCount} compiler note
                      {r.compilerWarningCount === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="exec-modal-actions">
          <button type="button" className="exec-modal-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
