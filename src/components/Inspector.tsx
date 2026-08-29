import { useState } from "react";
import type { Node } from "@xyflow/react";
import type { JourneyNodeData, JourneyNodeType } from "@/lib/journeySchema";
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
};

export function Inspector({
  selected,
  onChange,
  validationMessages = [],
  onClose,
  onSave,
  panelWidth,
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

  const handleSave = () => {
    onSave();
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2000);
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
      {kind === "email" ? (
        <>
          <label htmlFor="tpl">Template name</label>
          <input
            id="tpl"
            list="template-catalog"
            value={d.templateName ?? ""}
            onChange={(e) =>
              onChange(selected.id, { templateName: e.target.value || undefined })
            }
          />
          <datalist id="template-catalog">
            {(templatesQuery.data ?? []).map((t) => (
              <option key={t.id} value={t.name} />
            ))}
          </datalist>
        </>
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
