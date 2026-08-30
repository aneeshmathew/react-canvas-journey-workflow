import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { useNodeValidation } from "@/hooks/useNodeValidation";
import type {
  ActionNodeType,
  EntryNodeType,
  JourneyNodeData,
  JourneyNodeType,
} from "@/lib/journeySchema";
import {
  ACTION_DATA_FIELD,
  ACTION_NODE_LABELS,
  DEFAULT_CONDITION_BRANCHES,
  ENTRY_NODE_LABELS,
  ERROR_FALLBACK_HANDLE,
  ERROR_FALLBACK_LABEL,
  REACTION_KIND_LABELS,
} from "@/lib/journeySchema";

const ICONS: Partial<Record<JourneyNodeType, string>> = {
  "entry-read-audience": "👥",
  "entry-audience-qualification": "🎯",
  "entry-unitary-event": "🌐",
  "entry-business-event": "📣",
  audience: "👥",
  event: "⚡",
  "event-reaction": "👆",
  condition: "🔀",
  wait: "⏱",
  end: "🏁",
  start: "🌐",
  email: "✉️",
};

function Base({
  kind,
  title,
  subtitle,
  target,
  source,
  extraHandle,
  icon,
  ok,
  validationTitle,
}: {
  kind: JourneyNodeType;
  title: string;
  subtitle?: string;
  target?: boolean;
  source?: boolean;
  /** Optional second output (AJO's "alternative path on timeout/error"), rendered off the bottom edge so it reads as distinct from the main flow. */
  extraHandle?: { id: string; label: string };
  /** Overrides the static `ICONS` lookup — used by node families (Entry, Action) whose icon varies per sub-kind rather than per top-level `type`. */
  icon?: string;
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
          {icon ?? ICONS[kind] ?? "◆"}
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
      {extraHandle ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id={extraHandle.id}
            style={{ background: "#dc2626" }}
          />
          <div className="journey-node__fallback-tag">
            ⚠ {extraHandle.label}
          </div>
        </>
      ) : null}
    </div>
  );
}

function validationTooltip(ok: boolean, messages: string[]): string {
  if (ok) return "Valid";
  return messages.join("\n");
}

type EntryNodeReactType = Node<JourneyNodeData, EntryNodeType>;
type ActionNodeReactType = Node<JourneyNodeData, ActionNodeType>;
type End = Node<JourneyNodeData, "end">;
type Audience = Node<JourneyNodeData, "audience">;
type Ev = Node<JourneyNodeData, "event">;
type ReactionEvent = Node<JourneyNodeData, "event-reaction">;
type Condition = Node<JourneyNodeData, "condition">;
type Wait = Node<JourneyNodeData, "wait">;

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

export function EventReactionNode(props: NodeProps<ReactionEvent>) {
  const d = props.data;
  const { ok, messages } = useNodeValidation(props.id);
  const kindLabel = d.reactionKind ? REACTION_KIND_LABELS[d.reactionKind] : undefined;
  return (
    <Base
      kind="event-reaction"
      title={d.label || "Reaction event"}
      subtitle={
        d.subtitle ??
        (kindLabel
          ? d.reactsToHint
            ? `${kindLabel} · ${d.reactsToHint}`
            : kindLabel
          : "Not configured")
      }
      target
      source
      ok={ok}
      validationTitle={validationTooltip(ok, messages)}
    />
  );
}

export function WaitNode(props: NodeProps<Wait>) {
  const d = props.data;
  const { ok, messages } = useNodeValidation(props.id);
  const computed =
    d.waitAmount && d.waitUnit
      ? `Wait ${d.waitAmount} ${d.waitUnit}`
      : "Not configured";
  return (
    <Base
      kind="wait"
      title={d.label || "Wait"}
      subtitle={d.subtitle ?? computed}
      target
      source
      ok={ok}
      validationTitle={validationTooltip(ok, messages)}
    />
  );
}

/**
 * Condition node: one target handle in, one named source handle per branch
 * (plus an optional error/timeout fallback handle). Branches are edited in
 * the Inspector; renaming/removing a branch there also updates any
 * connected edges (see `useJourneyStore.renameSourceHandle` /
 * `removeEdgesForSourceHandle`) so connections don't silently orphan.
 */
export function ConditionNode(props: NodeProps<Condition>) {
  const d = props.data;
  const { ok, messages } = useNodeValidation(props.id);
  const branches =
    d.branches && d.branches.length > 0
      ? d.branches
      : [...DEFAULT_CONDITION_BRANCHES];
  const rowCount = branches.length + (d.hasErrorFallback ? 1 : 0);

  return (
    <div
      className={`journey-node journey-node--condition ${ok ? "journey-node--ok" : "journey-node--err"}`}
      title={validationTooltip(ok, messages)}
    >
      <Handle type="target" position={Position.Left} id="in" />
      <div className="journey-node__row">
        <span className="journey-node__icon" aria-hidden="true">
          {ICONS.condition}
        </span>
        <div className="journey-node__text">
          <div className="journey-node__title">{d.label || "Condition"}</div>
          <div className="journey-node__sub">
            {branches.length} branch{branches.length === 1 ? "" : "es"}
          </div>
        </div>
      </div>
      <div className="journey-node__chips">
        {branches.map((b) => (
          <span key={b} className="journey-node__chip">
            {b}
          </span>
        ))}
        {d.hasErrorFallback ? (
          <span className="journey-node__chip journey-node__chip--fallback">
            ⚠ {ERROR_FALLBACK_LABEL}
          </span>
        ) : null}
      </div>
      {branches.map((b, i) => (
        <Handle
          key={b}
          type="source"
          position={Position.Right}
          id={b}
          style={{ top: `${((i + 1) / (rowCount + 1)) * 100}%` }}
        />
      ))}
      {d.hasErrorFallback ? (
        <Handle
          type="source"
          position={Position.Right}
          id={ERROR_FALLBACK_HANDLE}
          style={{
            top: `${((branches.length + 1) / (rowCount + 1)) * 100}%`,
            background: "#dc2626",
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Renders any of the eight Action (channel) node kinds (see
 * `ACTION_NODE_TYPES`) — Email, Push, SMS, In-app, Web, Code-based
 * experience, Content card, Custom action. One component covers all eight
 * since they only differ in icon, default subtitle, and which single data
 * field (`ACTION_DATA_FIELD`) they collect — see `Inspector.tsx` for the
 * per-kind field switch. Generalized in Phase 3 from the original
 * single-purpose `EmailNode`.
 */
export function ActionNode(props: NodeProps<ActionNodeReactType>) {
  const d = props.data;
  const { ok, messages } = useNodeValidation(props.id);
  const kind = props.type;
  // Defensive fallback for the deprecated "email" literal reaching this
  // component directly (bypassing `parseJourney`'s migration) — behave like
  // action-email rather than crashing on an unmapped lookup.
  const defaults = ACTION_NODE_LABELS[kind] ?? ACTION_NODE_LABELS["action-email"];
  const field = ACTION_DATA_FIELD[kind] ?? "templateName";
  return (
    <Base
      kind={kind}
      icon={defaults.icon}
      title={d.label || defaults.label}
      subtitle={d.subtitle ?? (d[field] as string | undefined) ?? defaults.subtitle}
      target
      source
      extraHandle={
        d.hasErrorFallback
          ? { id: ERROR_FALLBACK_HANDLE, label: ERROR_FALLBACK_LABEL }
          : undefined
      }
      ok={ok}
      validationTitle={validationTooltip(ok, messages)}
    />
  );
}
