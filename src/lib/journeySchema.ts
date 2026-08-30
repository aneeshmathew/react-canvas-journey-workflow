import type { Edge, Node } from "@xyflow/react";

export const JOURNEY_VERSION = 1 as const;

/**
 * Entry-point activities, modeled after AJO's four entry types (see
 * README → Product direction → Entry-point model). Exactly one of these
 * must exist per journey, with no incoming edges — enforced in
 * `journeyValidation.ts`.
 */
export const ENTRY_NODE_TYPES = [
  "entry-read-audience",
  "entry-audience-qualification",
  "entry-unitary-event",
  "entry-business-event",
] as const;
export type EntryNodeType = (typeof ENTRY_NODE_TYPES)[number];

export function isEntryNodeType(
  type: string | undefined,
): type is EntryNodeType {
  return (ENTRY_NODE_TYPES as readonly string[]).includes(type ?? "");
}

/** Human-readable subtitle for each entry kind, used as the default node subtitle and in the palette. */
export const ENTRY_NODE_LABELS: Record<
  EntryNodeType,
  { label: string; subtitle: string }
> = {
  "entry-read-audience": { label: "Read Audience", subtitle: "Read Audience" },
  "entry-audience-qualification": {
    label: "Audience Qualification",
    subtitle: "Audience Qualification",
  },
  "entry-unitary-event": { label: "Unitary Event", subtitle: "Unitary event" },
  "entry-business-event": { label: "Business Event", subtitle: "Business event" },
};

/**
 * Action (channel) activities, generalized in Phase 3 from the original
 * single `"email"` node into AJO's full family. Each differs in icon,
 * default subtitle, and which data field(s) it collects — see
 * `ACTION_DATA_FIELD` below and `Inspector.tsx` for the per-kind field
 * switch.
 */
export const ACTION_NODE_TYPES = [
  "action-email",
  "action-push",
  "action-sms",
  "action-inapp",
  "action-web",
  "action-code",
  "action-content-card",
  "action-custom",
] as const;
export type ActionNodeType = (typeof ACTION_NODE_TYPES)[number];

export function isActionNodeType(
  type: string | undefined,
): type is ActionNodeType {
  return (ACTION_NODE_TYPES as readonly string[]).includes(type ?? "");
}

export const ACTION_NODE_LABELS: Record<
  ActionNodeType,
  { label: string; subtitle: string; icon: string }
> = {
  "action-email": { label: "Email", subtitle: "Send an email", icon: "✉️" },
  "action-push": {
    label: "Push notification",
    subtitle: "Send a push notification",
    icon: "🔔",
  },
  "action-sms": { label: "SMS", subtitle: "Send a text message", icon: "💬" },
  "action-inapp": {
    label: "In-app message",
    subtitle: "Show an in-app message",
    icon: "📱",
  },
  "action-web": {
    label: "Web (personalized)",
    subtitle: "Personalize a web experience",
    icon: "🌍",
  },
  "action-code": {
    label: "Code-based experience",
    subtitle: "Run a custom code snippet",
    icon: "🧩",
  },
  "action-content-card": {
    label: "Content card",
    subtitle: "Deliver a content card",
    icon: "🗂️",
  },
  "action-custom": {
    label: "Custom action",
    subtitle: "Call a custom action/webhook",
    icon: "🔧",
  },
};

/**
 * Which `JourneyNodeData` field each action kind's Inspector form edits and
 * validates as required, so `journeyValidation.ts` and `Inspector.tsx` stay
 * in lockstep instead of maintaining two separate switch statements that
 * could drift.
 */
export const ACTION_DATA_FIELD: Record<
  ActionNodeType,
  "templateName" | "messageBody" | "customPayload"
> = {
  "action-email": "templateName",
  "action-push": "messageBody",
  "action-sms": "messageBody",
  "action-inapp": "templateName",
  "action-web": "customPayload",
  "action-code": "customPayload",
  "action-content-card": "templateName",
  "action-custom": "customPayload",
};

/**
 * `"start"` and `"email"` are kept as recognized-but-deprecated literals
 * purely so old exported/saved journeys keep parsing — `parseJourney`
 * migrates `"start"` → `"entry-unitary-event"` and `"email"` →
 * `"action-email"` on load. New code should never produce either; see
 * `migrateLegacyNodeType` below.
 */
export type JourneyNodeType =
  | EntryNodeType
  | ActionNodeType
  | "start"
  | "audience"
  | "event"
  | "condition"
  | "wait"
  | "email"
  | "end";

export const DEFAULT_CONDITION_BRANCHES = ["Yes", "No"] as const;

export type WaitUnit = "minutes" | "hours" | "days";

export type JourneyNodeData = {
  label: string;
  subtitle?: string;
  segmentHint?: string;
  eventKey?: string;
  templateName?: string;
  /** Email action only. */
  subject?: string;
  /** SMS/Push action: short message text. */
  messageBody?: string;
  /** Web/Code-based/Custom action: freeform config, snippet, or destination. */
  customPayload?: string;
  /** Condition node: named outgoing branches. Each is rendered as its own source handle. */
  branches?: string[];
  /** Condition/Action nodes: AJO's "Add an alternative path in case of a timeout or an error." */
  hasErrorFallback?: boolean;
  /** Wait node: fixed-duration wait before continuing. */
  waitAmount?: number;
  waitUnit?: WaitUnit;
} & Record<string, unknown>;

/** Handle id used for the optional timeout/error fallback output on Condition and Action nodes. */
export const ERROR_FALLBACK_HANDLE = "error-fallback";
export const ERROR_FALLBACK_LABEL = "Error/Timeout";

export type JourneyDocument = {
  version: typeof JOURNEY_VERSION;
  meta?: { name?: string; description?: string; updatedAt?: string };
  nodes: Node<JourneyNodeData>[];
  edges: Edge[];
  viewport?: { x: number; y: number; zoom: number };
};

export function defaultJourney(): JourneyDocument {
  return {
    version: JOURNEY_VERSION,
    meta: {
      name: "Untitled journey",
      description: "",
      updatedAt: new Date().toISOString(),
    },
    nodes: [
      {
        id: "entry-1",
        type: "entry-unitary-event",
        position: { x: 120, y: 120 },
        data: {
          label: "Start",
          subtitle: ENTRY_NODE_LABELS["entry-unitary-event"].subtitle,
        },
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

/** Rewrites legacy node types (`"start"`, `"email"`) to their modern equivalents in place. */
function migrateLegacyNodeType(node: Node<JourneyNodeData>): Node<JourneyNodeData> {
  if (node.type === "start") {
    return { ...node, type: "entry-unitary-event" };
  }
  if (node.type === "email") {
    return { ...node, type: "action-email" };
  }
  return node;
}

export function parseJourney(raw: unknown): JourneyDocument {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Invalid journey: not an object");
  }
  const o = raw as Record<string, unknown>;
  if (o.version !== JOURNEY_VERSION) {
    throw new Error(`Unsupported journey version: ${String(o.version)}`);
  }
  if (!Array.isArray(o.nodes)) {
    throw new Error("Invalid journey: nodes must be an array");
  }
  if (!Array.isArray(o.edges)) {
    throw new Error("Invalid journey: edges must be an array");
  }
  return {
    version: JOURNEY_VERSION,
    meta: o.meta as JourneyDocument["meta"],
    nodes: (o.nodes as Node<JourneyNodeData>[]).map(migrateLegacyNodeType),
    edges: o.edges as Edge[],
    viewport: o.viewport as JourneyDocument["viewport"],
  };
}

export function serializeJourney(doc: JourneyDocument): string {
  return JSON.stringify(
    {
      ...doc,
      meta: { ...doc.meta, updatedAt: new Date().toISOString() },
    },
    null,
    2,
  );
}

export function toJourneyDocument(
  nodes: Node<JourneyNodeData>[],
  edges: Edge[],
  meta?: JourneyDocument["meta"],
  viewport?: JourneyDocument["viewport"],
): JourneyDocument {
  return {
    version: JOURNEY_VERSION,
    meta,
    nodes,
    edges,
    viewport,
  };
}
