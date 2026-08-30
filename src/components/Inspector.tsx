import { useState } from "react";
import type { Node } from "@xyflow/react";
import type {
  JourneyNodeData,
  JourneyNodeType,
  WaitUnit,
} from "@/lib/journeySchema";
import {
  ACTION_DATA_FIELD,
  ACTION_NODE_LABELS,
  DEFAULT_CONDITION_BRANCHES,
  isActionNodeType,
} from "@/lib/journeySchema";
import {
  useAudiencesQuery,
  useEventsQuery,
  useMessageTemplatesQuery,
} from "@/hooks/queries/useJourneyQueries";

type Props = {
  selected: Node<JourneyNodeData> | null;
  onChange: (id: string, data: Partial<JourneyNodeData>) => void;
  validationMessages?: string[];
  onClose: () => void;
  onSave: () => void;
  panelWidth: number;
  /** Keeps a Condition node's edges attached when a branch is renamed. */
  onRenameConditionBranch?: (
    nodeId: string,
    oldLabel: string,
    newLabel: string,
  ) => void;
  /** Drops edges left dangling when a Condition branch is removed. */
  onRemoveConditionBranchEdges?: (nodeId: string, label: string) => void;
};

export function Inspector({
  selected,
  onChange,
  validationMessages = [],
  onClose,
  onSave,
  panelWidth,
  onRenameConditionBranch,
  onRemoveConditionBranchEdges,
}: Props) {
  const [savedFlash, setSavedFlash] = useState(false);
  // Phase 0: these come from the mock API via TanStack Query — real catalogs
  // (Adobe Experience Platform audiences, configured events, message
  // templates) slot in behind the same hooks later without touching this
  // component. For now they're offered as <datalist> suggestions rather
  // than hard selects, since the field itself is still a free-text hint.
  const audiencesQuery = useAudiencesQuery();
  const eventsQuery = useEventsQuery();
  const templatesQuery = useMessageTemplatesQuery();

  if (!selected) {
    return null;
  }

  const d = selected.data;
  const kind = selected.type as JourneyNodeType;
  const branches =
    d.branches && d.branches.length > 0
      ? d.branches
      : [...DEFAULT_CONDITION_BRANCHES];
  // "email" is the deprecated pre-Phase-3 literal; treat it exactly like
  // action-email in the Inspector too (parseJourney migrates it on load,
  // but a node dropped before that migration ran in this session should
  // still get a sensible form).
  const actionKind = isActionNodeType(kind) ? kind : "action-email";
  const actionField = ACTION_DATA_FIELD[actionKind];

  const handleSave = () => {
    onSave();
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2000);
  };

  const handleBranchRename = (index: number, newLabel: string) => {
    const oldLabel = branches[index];
    const next = branches.map((b, i) => (i === index ? newLabel : b));
    onChange(selected.id, { branches: next });
    if (oldLabel && oldLabel !== newLabel) {
      onRenameConditionBranch?.(selected.id, oldLabel, newLabel);
    }
  };

  const handleRemoveBranch = (index: number) => {
    if (branches.length <= 2) return;
    const removed = branches[index];
    const next = branches.filter((_, i) => i !== index);
    onChange(selected.id, { branches: next });
    if (removed) onRemoveConditionBranchEdges?.(selected.id, removed);
  };

  const handleAddBranch = () => {
    let n = branches.length + 1;
    while (branches.includes(`Path${n}`)) n += 1;
    onChange(selected.id, { branches: [...branches, `Path${n}`] });
  };

  return (
    <aside
      className="inspector"
      style={{ width: panelWidth, flexShrink: 0 }}
    >
      <div className="inspector-header">
        <h2>Properties</h2>
        <button
          type="button"
          className="inspector-close"
          onClick={onClose}
          aria-label="Close properties"
        >
          Close
        </button>
      </div>
      <div className="inspector-body">
      {validationMessages.length > 0 ? (
        <ul className="inspector-validation">
          {validationMessages.map((m, i) => (
            <li key={`${i}-${m.slice(0, 40)}`}>{m}</li>
          ))}
        </ul>
      ) : null}
      <label htmlFor="label">Label</label>
      <input
        id="label"
        value={d.label}
        onChange={(e) => onChange(selected.id, { label: e.target.value })}
      />
      <label htmlFor="subtitle">Subtitle</label>
      <textarea
        id="subtitle"
        rows={2}
        value={d.subtitle ?? ""}
        onChange={(e) =>
          onChange(selected.id, { subtitle: e.target.value || undefined })
        }
      />
      {kind === "audience" ||
      kind === "entry-read-audience" ||
      kind === "entry-audience-qualification" ? (
        <>
          <label htmlFor="seg">Audience</label>
          <input
            id="seg"
            list="audience-catalog"
            value={d.segmentHint ?? ""}
            onChange={(e) =>
              onChange(selected.id, { segmentHint: e.target.value || undefined })
            }
          />
          <datalist id="audience-catalog">
            {(audiencesQuery.data ?? []).map((a) => (
              <option key={a.id} value={a.name} />
            ))}
          </datalist>
        </>
      ) : null}
      {kind === "event" ||
      kind === "entry-unitary-event" ||
      kind === "entry-business-event" ? (
        <>
          <label htmlFor="ev">Event</label>
          <input
            id="ev"
            list="event-catalog"
            value={d.eventKey ?? ""}
            onChange={(e) =>
              onChange(selected.id, { eventKey: e.target.value || undefined })
            }
          />
          <datalist id="event-catalog">
            {(eventsQuery.data ?? []).map((ev) => (
              <option key={ev.id} value={ev.name} />
            ))}
          </datalist>
        </>
      ) : null}
      {kind === "wait" ? (
        <>
          <label htmlFor="wait-amount">Wait for</label>
          <div className="inspector-wait-row">
            <input
              id="wait-amount"
              type="number"
              min={1}
              value={d.waitAmount ?? ""}
              onChange={(e) =>
                onChange(selected.id, {
                  waitAmount: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
            />
            <select
              aria-label="Wait unit"
              value={d.waitUnit ?? ""}
              onChange={(e) =>
                onChange(selected.id, {
                  waitUnit: (e.target.value || undefined) as
                    | WaitUnit
                    | undefined,
                })
              }
            >
              <option value="">Select unit…</option>
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </div>
        </>
      ) : null}
      {kind === "condition" ? (
        <>
          <label>Branches</label>
          <div className="inspector-branches">
            {branches.map((b, i) => (
              <div key={i} className="inspector-branch-row">
                <input
                  aria-label={`Branch ${i + 1} name`}
                  value={b}
                  onChange={(e) => handleBranchRename(i, e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveBranch(i)}
                  disabled={branches.length <= 2}
                  aria-label={`Remove branch ${b}`}
                  title={
                    branches.length <= 2
                      ? "A Condition needs at least two branches"
                      : "Remove branch"
                  }
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="inspector-branch-add"
              onClick={handleAddBranch}
            >
              + Add branch
            </button>
          </div>
        </>
      ) : null}
      {kind === "email" || isActionNodeType(kind) ? (
        <>
          {isActionNodeType(kind) ? (
            <p className="inspector-channel-hint">
              Channel: {ACTION_NODE_LABELS[kind].label}
            </p>
          ) : null}
          {kind === "action-email" ? (
            <>
              <label htmlFor="subject">Subject</label>
              <input
                id="subject"
                value={d.subject ?? ""}
                onChange={(e) =>
                  onChange(selected.id, { subject: e.target.value || undefined })
                }
              />
            </>
          ) : null}
          {actionField === "templateName" ? (
            <>
              <label htmlFor="tpl">Template</label>
              <input
                id="tpl"
                list="template-catalog"
                value={d.templateName ?? ""}
                onChange={(e) =>
                  onChange(selected.id, {
                    templateName: e.target.value || undefined,
                  })
                }
              />
              <datalist id="template-catalog">
                {(templatesQuery.data ?? []).map((t) => (
                  <option key={t.id} value={t.name} />
                ))}
              </datalist>
            </>
          ) : null}
          {actionField === "messageBody" ? (
            <>
              <label htmlFor="msg">Message text</label>
              <textarea
                id="msg"
                rows={3}
                value={d.messageBody ?? ""}
                onChange={(e) =>
                  onChange(selected.id, {
                    messageBody: e.target.value || undefined,
                  })
                }
              />
            </>
          ) : null}
          {actionField === "customPayload" ? (
            <>
              <label htmlFor="payload">
                {kind === "action-web"
                  ? "Destination / config"
                  : kind === "action-code"
                    ? "Code snippet"
                    : "Custom payload"}
              </label>
              <textarea
                id="payload"
                rows={4}
                value={d.customPayload ?? ""}
                onChange={(e) =>
                  onChange(selected.id, {
                    customPayload: e.target.value || undefined,
                  })
                }
              />
            </>
          ) : null}
        </>
      ) : null}
      {kind === "condition" || kind === "email" || isActionNodeType(kind) ? (
        <label className="inspector-checkbox">
          <input
            type="checkbox"
            checked={Boolean(d.hasErrorFallback)}
            onChange={(e) =>
              onChange(selected.id, { hasErrorFallback: e.target.checked })
            }
          />
          Add an alternative path in case of a timeout or an error
        </label>
      ) : null}
      </div>
      <div className="inspector-actions">
        <button type="button" className="inspector-save" onClick={handleSave}>
          Save
        </button>
        <button type="button" className="inspector-close-secondary" onClick={onClose}>
          Close
        </button>
      </div>
      {savedFlash ? (
        <p className="inspector-saved-hint" role="status">
          Saved to this browser
        </p>
      ) : null}
    </aside>
  );
}
