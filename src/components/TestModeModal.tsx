import { useEffect, useMemo, useState } from "react";
import type { Edge, Node } from "@xyflow/react";
import type { JourneyNodeData } from "@/lib/journeySchema";
import { findSingleEntryNode, getWalkOptions } from "@/lib/testModeWalk";
import type { TestRunStep } from "@/lib/api/mockApi";
import { CURRENT_JOURNEY_KEY } from "@/lib/api/mockApi";
import {
  useSaveTestRunMutation,
  useTestProfilesQuery,
  useTestRunsQuery,
} from "@/hooks/queries/useJourneyQueries";

type Props = {
  open: boolean;
  onClose: () => void;
  nodes: Node<JourneyNodeData>[];
  edges: Edge[];
};

type WalkState = {
  currentNodeId: string;
  steps: TestRunStep[];
  deadEnd: boolean;
};

function nodeStep(n: Node<JourneyNodeData>): TestRunStep {
  return { nodeId: n.id, nodeLabel: String(n.data.label ?? n.id), nodeType: String(n.type) };
}

/**
 * Test mode: a small set of *named, reusable* profiles walked through
 * the journey — distinct from Simulation (ephemeral, walks every branch
 * automatically) and Dry run (also automatic, framed as production-shaped
 * no-send preview). Because Condition branches here are named rather than
 * rule-evaluated (see README → Phase 2), a profile's path can't be computed
 * automatically — a person clicks through it, one branch at a time, and
 * that choice is what gets persisted via `saveTestRun`.
 */
export function TestModeModal({ open, onClose, nodes, edges }: Props) {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [walk, setWalk] = useState<WalkState | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const profilesQuery = useTestProfilesQuery();
  const runsQuery = useTestRunsQuery(profileId);
  const saveRunMutation = useSaveTestRunMutation();

  useEffect(() => {
    if (!open) {
      setProfileId(null);
      setWalk(null);
      setSavedFlash(false);
    }
  }, [open]);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const selectedProfile = profilesQuery.data?.find((p) => p.id === profileId);
  const currentNode = walk ? nodeById.get(walk.currentNodeId) : undefined;
  const options = walk ? getWalkOptions(walk.currentNodeId, nodes, edges) : [];
  const atEnd = currentNode?.type === "end";

  const startWalk = () => {
    const entry = findSingleEntryNode(nodes);
    if (!entry) {
      setWalk({ currentNodeId: "", steps: [], deadEnd: true });
      return;
    }
    setWalk({ currentNodeId: entry.id, steps: [nodeStep(entry)], deadEnd: false });
    setSavedFlash(false);
  };

  const choose = (targetId: string, branchLabel: string | undefined) => {
    if (!walk) return;
    const target = nodeById.get(targetId);
    if (!target) return;
    const steps = walk.steps.slice();
    // Record the choice on the step we're leaving.
    steps[steps.length - 1] = { ...steps[steps.length - 1]!, choiceLabel: branchLabel };
    steps.push(nodeStep(target));
    setWalk({ currentNodeId: targetId, steps, deadEnd: false });
  };

  const handleSave = () => {
    if (!walk || !profileId) return;
    saveRunMutation.mutate(
      {
        journeyKey: CURRENT_JOURNEY_KEY,
        profileId,
        steps: walk.steps,
        reachedEnd: atEnd,
      },
      { onSuccess: () => setSavedFlash(true) },
    );
  };

  if (!open) return null;

  return (
    <div className="exec-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="exec-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="test-mode-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="test-mode-title">Test mode</h2>
        <p className="exec-modal-note">
          Run a persistent test profile through the journey and choose its path by
          hand at each branch. Unlike Simulation, this saves the run so you (or a
          teammate) can come back to it later.
        </p>

        {!profileId ? (
          <div className="test-mode-profiles">
            {profilesQuery.isPending ? <p>Loading test profiles…</p> : null}
            {(profilesQuery.data ?? []).map((p) => (
              <button
                key={p.id}
                type="button"
                className="test-mode-profile-card"
                onClick={() => setProfileId(p.id)}
              >
                <span className="test-mode-profile-name">{p.name}</span>
                <span className="test-mode-profile-desc">{p.description}</span>
                <span className="test-mode-profile-traits">
                  {p.traits.map((t) => (
                    <span key={t} className="test-mode-trait-chip">
                      {t}
                    </span>
                  ))}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="test-mode-run">
            <div className="test-mode-run-header">
              <div>
                <strong>{selectedProfile?.name ?? "Profile"}</strong>
                <span className="test-mode-run-header-desc">
                  {selectedProfile?.description}
                </span>
              </div>
              <button
                type="button"
                className="test-mode-change-profile"
                onClick={() => {
                  setProfileId(null);
                  setWalk(null);
                }}
              >
                Change profile
              </button>
            </div>

            {!walk ? (
              <>
                {runsQuery.data && runsQuery.data.length > 0 ? (
                  <div className="test-mode-history">
                    <p className="test-mode-history-title">
                      Previous runs (persisted)
                    </p>
                    <ul>
                      {runsQuery.data.slice(0, 3).map((r) => (
                        <li key={r.id}>
                          {new Date(r.completedAt).toLocaleString()} —{" "}
                          {r.reachedEnd ? "reached End" : "did not finish"} (
                          {r.steps.length} step{r.steps.length === 1 ? "" : "s"})
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : runsQuery.data ? (
                  <p className="test-mode-history-empty">
                    No saved runs yet for this profile.
                  </p>
                ) : null}
                <button
                  type="button"
                  className="exec-modal-close test-mode-start"
                  onClick={startWalk}
                >
                  Start test run
                </button>
              </>
            ) : walk.deadEnd && !currentNode ? (
              <p className="test-mode-error">
                This journey needs exactly one entry point before it can be
                tested — check the Alerts count in the header.
              </p>
            ) : (
              <>
                <ol className="exec-modal-steps">
                  {walk.steps.map((s, idx) => (
                    <li
                      key={`${s.nodeId}-${idx}`}
                      className="exec-modal-step exec-modal-step--done"
                    >
                      <span className="exec-modal-step__mark" aria-hidden>
                        ✓
                      </span>
                      <span className="exec-modal-step__label">{s.nodeLabel}</span>
                      <span className="exec-modal-step__type">{s.nodeType}</span>
                      {s.choiceLabel ? (
                        <span className="exec-modal-step__branch">
                          → [{s.choiceLabel}]
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ol>

                {atEnd ? (
                  <p className="test-mode-reached-end" role="status">
                    Reached End.
                  </p>
                ) : options.length === 0 ? (
                  <p className="test-mode-error">
                    Dead end — no outgoing connection from "
                    {currentNode ? String(currentNode.data.label) : "this step"}".
                  </p>
                ) : (
                  <div className="test-mode-options">
                    <p className="test-mode-options-prompt">
                      Which way does {selectedProfile?.name ?? "this profile"} go?
                    </p>
                    {options.map((o) => (
                      <button
                        key={o.edgeId}
                        type="button"
                        className="test-mode-option-btn"
                        onClick={() => choose(o.targetId, o.branchLabel)}
                      >
                        {o.branchLabel
                          ? `Take: ${o.branchLabel}`
                          : `Continue → ${o.targetLabel}`}
                      </button>
                    ))}
                  </div>
                )}

                <div className="test-mode-actions">
                  <button
                    type="button"
                    className="test-mode-save"
                    onClick={handleSave}
                    disabled={saveRunMutation.isPending}
                  >
                    {saveRunMutation.isPending ? "Saving…" : "Save this run"}
                  </button>
                  <button type="button" onClick={startWalk}>
                    Restart
                  </button>
                </div>
                {savedFlash ? (
                  <p className="inspector-saved-hint" role="status">
                    Run saved — persisted for {selectedProfile?.name}.
                  </p>
                ) : null}
              </>
            )}
          </div>
        )}

        <div className="exec-modal-actions">
          <button type="button" className="exec-modal-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
