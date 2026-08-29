import { useEffect, useMemo, useState } from "react";

const STEP_MS = 520;

export type ExecutionStep = {
  id: string;
  label: string;
  type: string;
  branchLabel?: string;
};
export type ExecutionPath = { steps: ExecutionStep[] };

type Props = {
  open: boolean;
  onClose: () => void;
  paths: ExecutionPath[];
  warnings: string[];
};

/**
 * Animates one simulated path at a time. Since `simulateJourney` now
 * enumerates every branch (Phase 2), a journey with a Condition node can
 * produce several paths — the tab bar lets the person step through each one
 * rather than only ever seeing the first.
 */
export function ExecutionDryRunModal({ open, onClose, paths, warnings }: Props) {
  const [pathIndex, setPathIndex] = useState(0);
  const steps = useMemo(
    () => paths[pathIndex]?.steps ?? [],
    [paths, pathIndex],
  );

  /** Index of the step currently “running”; `steps.length` means all finished. */
  const [cursor, setCursor] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!open) {
      setPathIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open || steps.length === 0) {
      setCursor(0);
      setFinished(false);
      return;
    }
    setCursor(0);
    setFinished(false);
    let next = 1;
    const id = window.setInterval(() => {
      if (next >= steps.length) {
        setCursor(steps.length);
        setFinished(true);
        window.clearInterval(id);
        return;
      }
      setCursor(next);
      next += 1;
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [open, steps]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || paths.length === 0) return null;

  return (
    <div
      className="exec-modal-overlay"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="presentation"
    >
      <div
        className="exec-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exec-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="exec-modal-title">Dry run</h2>
        <p className="exec-modal-note">
          Preview only — nothing is sent to email, webhooks, or n8n. Use <strong>Publish</strong> to
          download a bundle for n8n; activate the workflow there for real runs.
        </p>
        {paths.length > 1 ? (
          <div
            className="exec-modal-path-tabs"
            role="tablist"
            aria-label="Simulated paths"
          >
            {paths.map((p, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === pathIndex}
                className={
                  i === pathIndex
                    ? "exec-modal-path-tab exec-modal-path-tab--active"
                    : "exec-modal-path-tab"
                }
                onClick={() => setPathIndex(i)}
              >
                Path {i + 1}
                {p.steps.some((s) => s.branchLabel) ? (
                  <span className="exec-modal-path-tab__branches">
                    {p.steps
                      .filter((s) => s.branchLabel)
                      .map((s) => s.branchLabel)
                      .join(" → ")}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
        <ol className="exec-modal-steps">
          {steps.map((s, idx) => {
            const done = idx < cursor;
            const current = idx === cursor && cursor < steps.length;
            return (
              <li
                key={s.id}
                className={
                  done
                    ? "exec-modal-step exec-modal-step--done"
                    : current
                      ? "exec-modal-step exec-modal-step--current"
                      : "exec-modal-step exec-modal-step--pending"
                }
              >
                <span className="exec-modal-step__mark" aria-hidden>
                  {done ? "✓" : current ? "▶" : "○"}
                </span>
                {s.branchLabel ? (
                  <span className="exec-modal-step__branch">
                    [{s.branchLabel}]
                  </span>
                ) : null}
                <span className="exec-modal-step__label">{s.label}</span>
                <span className="exec-modal-step__type">{s.type}</span>
              </li>
            );
          })}
        </ol>
        {warnings.length > 0 ? (
          <ul className="exec-modal-warnings">
            {warnings.map((w, i) => (
              <li key={`${i}-${w.slice(0, 32)}`}>{w}</li>
            ))}
          </ul>
        ) : null}
        {finished ? (
          <p className="exec-modal-done" role="status">
            Dry run finished.
          </p>
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
