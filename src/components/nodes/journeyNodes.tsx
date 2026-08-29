import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { useNodeValidation } from "@/hooks/useNodeValidation";
import type {
  EntryNodeType,
  JourneyNodeData,
  JourneyNodeType,
} from "@/lib/journeySchema";
import { ENTRY_NODE_LABELS } from "@/lib/journeySchema";

const ICONS: Partial<Record<JourneyNodeType, string>> = {
  "entry-read-audience": "👥",
  "entry-audience-qualification": "🎯",
  "entry-unitary-event": "🌐",
  "entry-business-event": "📣",
  audience: "👥",
  event: "⚡",
  email: "✉️",
  end: "🏁",
  start: "🌐",
};

function Base({
  kind,
  title,
  subtitle,
  target,
  source,
  ok,
  validationTitle,
}: {
  kind: JourneyNodeType;
  title: string;
  subtitle?: string;
  target?: boolean;
  source?: boolean;
  ok: boolean;
  validationTitle: string;
}) {
  return (
    <div
      className={`journey-node journey-node--${kind} ${ok ? "journey-node--ok" : "journey-node--err"}`}
      title={validationTitle}
    >
      {target ? (
        <Handle type="target" position={Position.Left} id="in" />
      ) : null}
      <div className="journey-node__row">
        <span className="journey-node__icon" aria-hidden="true">
          {ICONS[kind] ?? "◆"}
        </span>
        <div className="journey-node__text">
          <div className="journey-node__title">{title}</div>
          {subtitle ? (
            <div className="journey-node__sub">{subtitle}</div>
          ) : null}
        </div>
      </div>
      {source ? (
        <Handle type="source" position={Position.Right} id="out" />
      ) : null}
    </div>
  );
}

function validationTooltip(ok: boolean, messages: string[]): string {
  if (ok) return "Valid";
  return messages.join("\n");
}

type EntryNodeReactType = Node<JourneyNodeData, EntryNodeType>;
type End = Node<JourneyNodeData, "end">;
type Audience = Node<JourneyNodeData, "audience">;
type Ev = Node<JourneyNodeData, "event">;
type Email = Node<JourneyNodeData, "email">;

/**
 * Renders any of the four entry-point activities (see `ENTRY_NODE_TYPES`).
 * One component covers all four kinds since they only differ in icon,
 * default subtitle, and which data field (`segmentHint` vs `eventKey`)
 * they collect — see `Inspector.tsx` for the per-kind field switch.
 */
export function EntryNode(props: NodeProps<EntryNodeReactType>) {
  const d = props.data;
  const { ok, messages } = useNodeValidation(props.id);
  const kind = props.type;
  const defaults = ENTRY_NODE_LABELS[kind];
  return (
    <Base
      kind={kind}
      title={d.label || defaults.label}
      subtitle={d.subtitle ?? defaults.subtitle}
      source
      ok={ok}
      validationTitle={validationTooltip(ok, messages)}
    />
  );
}

export function EndNode(props: NodeProps<End>) {
  const d = props.data;
  const { ok, messages } = useNodeValidation(props.id);
  return (
    <Base
      kind="end"
      title={d.label || "End"}
      subtitle={d.subtitle}
      target
      ok={ok}
      validationTitle={validationTooltip(ok, messages)}
    />
  );
}

export function AudienceNode(props: NodeProps<Audience>) {
  const d = props.data;
  const { ok, messages } = useNodeValidation(props.id);
  return (
    <Base
      kind="audience"
      title={d.label || "Audience"}
      subtitle={d.subtitle ?? d.segmentHint}
      target
      source
      ok={ok}
      validationTitle={validationTooltip(ok, messages)}
    />
  );
}

export function EventNode(props: NodeProps<Ev>) {
  const d = props.data;
  const { ok, messages } = useNodeValidation(props.id);
  return (
    <Base
      kind="event"
      title={d.label || "Event"}
      subtitle={d.subtitle ?? d.eventKey}
      target
      source
      ok={ok}
      validationTitle={validationTooltip(ok, messages)}
    />
  );
}

export function EmailNode(props: NodeProps<Email>) {
  const d = props.data;
  const { ok, messages } = useNodeValidation(props.id);
  return (
    <Base
      kind="email"
      title={d.label || "Email"}
      subtitle={d.subtitle ?? d.templateName}
      target
      source
      ok={ok}
      validationTitle={validationTooltip(ok, messages)}
    />
  );
}
