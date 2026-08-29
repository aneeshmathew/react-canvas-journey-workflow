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
 * `"start"` is kept as a recognized-but-deprecated literal purely so old
 * exported/saved journeys keep parsing — `parseJourney` migrates any
 * `"start"` node to `"entry-unitary-event"` on load. New code should never
 * produce a `"start"` node; see `migrateLegacyNodeType` below.
 */
export type JourneyNodeType =
  | EntryNodeType
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
  /** Condition node: named outgoing branches. Each is rendered as its own source handle. */
  branches?: string[];
  /** Condition/Email(Action): AJO's "Add an alternative path in case of a timeout or an error." */
  hasErrorFallback?: boolean;
  /** Wait node: fixed-duration wait before continuing. */
  waitAmount?: number;
  waitUnit?: WaitUnit;
} & Record<string, unknown>;

/** Handle id used for the optional timeout/error fallback output on Condition and Email nodes. */
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

/** Rewrites the legacy `"start"` node type to its modern equivalent in place. */
function migrateLegacyNodeType(node: Node<JourneyNodeData>): Node<JourneyNodeData> {
  if (node.type === "start") {
    return { ...node, type: "entry-unitary-event" };
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
