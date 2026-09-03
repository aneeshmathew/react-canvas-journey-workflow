import { usePublishHistoryQuery } from "@/hooks/queries/useJourneyQueries";

type Props = {
  open: boolean;
  onClose: () => void;
  journeyId: string;
  journeyName: string;
};

/**
 * A history of past publishes of *this* journey — node/edge counts and
 * compiler-warning counts, not fabricated delivery/reporting numbers (see
 * README → Non-goals on reporting). Opened from the "Publish" area of the
 * editor. Now that Journeys has a real landing page, this is purely a
 * per-journey publish log, not a stand-in for a journey list.
 */
export function PublishHistoryModal({
  open,
  onClose,
  journeyId,
  journeyName,
}: Props) {
  const historyQuery = usePublishHistoryQuery(journeyId);

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
        <h2 id="publish-history-title">Publish history: {journeyName}</h2>
        <p className="exec-modal-note">
          Each row is a structural snapshot from a past publish — no real
          delivery/reporting data exists (see README → Non-goals on
          reporting).
        </p>
        {historyQuery.isPending ? <p>Loading publish history…</p> : null}
        {historyQuery.data && historyQuery.data.length === 0 ? (
          <p className="test-mode-history-empty">
            Nothing published yet — use the Publish button once this journey
            is valid.
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
