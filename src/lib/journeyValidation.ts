import type { Edge, Node } from "@xyflow/react";
import type { JourneyNodeData } from "@/lib/journeySchema";
import {
  ACTION_DATA_FIELD,
  DEFAULT_CONDITION_BRANCHES,
  ERROR_FALLBACK_HANDLE,
  isActionNodeType,
  isEntryNodeType,
} from "@/lib/journeySchema";
import { simulateJourney } from "@/lib/simulateJourney";

const ACTION_FIELD_MESSAGE: Record<
  (typeof ACTION_DATA_FIELD)[keyof typeof ACTION_DATA_FIELD],
  string
> = {
  templateName: "Template is required.",
  messageBody: "Message text is required.",
  customPayload: "Configuration is required.",
};

/**
 * Treats the deprecated `"email"` literal as `"action-email"` for
 * validation purposes too — `parseJourney` migrates it on load, but a node
 * that reaches `validateJourney` before that (or via test data / a
 * hand-crafted document) should still get the right rule rather than
 * silently skipping validation.
 */
function asActionType(type: string | undefined) {
  if (type === "email") return "action-email" as const;
  return isActionNodeType(type) ? type : undefined;
}

export type JourneyValidationResult = {
  /** True when there are no global issues and every node has zero messages. */
  isValid: boolean;
  /** Validation messages per node id. */
  byNode: Record<string, string[]>;
  /** Journey-level issues (structure, path, etc.). */
  global: string[];
};

function add(map: Record<string, string[]>, id: string, message: string) {
  if (!map[id]) map[id] = [];
  map[id].push(message);
}

/**
 * Validates journey structure, unique labels, required fields per node type,
 * reachability from the entry point, and a complete path from entry to End.
 */
export function validateJourney(
  nodes: Node<JourneyNodeData>[],
  edges: Edge[],
): JourneyValidationResult {
  const byNode: Record<string, string[]> = {};
  const global: string[] = [];

  const entries = nodes.filter((n) => isEntryNodeType(n.type));
  const ends = nodes.filter((n) => n.type === "end");

  if (entries.length === 0) {
    global.push(
      "Add exactly one entry point (Read Audience, Audience Qualification, Unitary Event, or Business Event).",
    );
  }
  if (entries.length > 1) {
    global.push("Only one entry point is allowed.");
    for (const s of entries) {
      add(byNode, s.id, "Journey must have a single entry point.");
    }
  }
  for (const s of entries) {
    const hasIncoming = edges.some((e) => e.target === s.id);
    if (hasIncoming) {
      add(
        byNode,
        s.id,
        "Entry points can't have incoming connections — nothing may lead into the start of a journey.",
      );
      global.push("The entry point has an incoming connection — remove it.");
    }
  }

  if (ends.length === 0) {
    global.push("Add exactly one End node.");
  }
  if (ends.length > 1) {
    global.push("Only one End node is allowed.");
    for (const e of ends) {
      add(byNode, e.id, "Journey must have a single End node.");
    }
  }

  const labelToIds = new Map<string, string[]>();
  for (const n of nodes) {
    const t = String(n.data.label ?? "")
      .trim()
      .toLowerCase();
    if (!t) continue;
    if (!labelToIds.has(t)) labelToIds.set(t, []);
    labelToIds.get(t)!.push(n.id);
  }
  for (const [, ids] of labelToIds) {
    if (ids.length > 1) {
      const msg = "Duplicate label — each node must have a unique name.";
      for (const id of ids) add(byNode, id, msg);
    }
  }

  for (const n of nodes) {
    const label = String(n.data.label ?? "").trim();
    if (!label) {
      add(byNode, n.id, "Label is required.");
    }

    switch (n.type) {
      case "audience":
      case "entry-read-audience":
      case "entry-audience-qualification":
        if (!String(n.data.segmentHint ?? "").trim()) {
          add(byNode, n.id, "Audience is required.");
        }
        break;
      case "event":
      case "entry-unitary-event":
      case "entry-business-event":
        if (!String(n.data.eventKey ?? "").trim()) {
          add(byNode, n.id, "Event is required.");
        }
        break;
      case "event-reaction":
        if (!n.data.reactionKind) {
          add(byNode, n.id, "Reaction type is required.");
        }
        break;
      case "wait":
        if (!n.data.waitAmount || n.data.waitAmount <= 0) {
          add(byNode, n.id, "Wait duration must be greater than zero.");
        }
        if (!n.data.waitUnit) {
          add(byNode, n.id, "Wait unit is required.");
        }
        break;
      case "condition": {
        const branches =
          n.data.branches && n.data.branches.length > 0
            ? n.data.branches
            : [...DEFAULT_CONDITION_BRANCHES];
        if (branches.length < 2) {
          add(byNode, n.id, "A Condition needs at least two branches.");
        }
        const outgoingHandles = new Set(
          edges.filter((e) => e.source === n.id).map((e) => e.sourceHandle),
        );
        for (const b of branches) {
          if (!outgoingHandles.has(b)) {
            add(byNode, n.id, `Branch "${b}" has no outgoing connection.`);
          }
        }
        const validHandles = new Set<string | null | undefined>([
          ...branches,
          n.data.hasErrorFallback ? ERROR_FALLBACK_HANDLE : undefined,
        ]);
        for (const e of edges) {
          if (e.source === n.id && !validHandles.has(e.sourceHandle)) {
            add(
              byNode,
              n.id,
              `A connection points from a branch ("${e.sourceHandle}") that no longer exists — reconnect or remove it.`,
            );
          }
        }
        break;
      }
      default: {
        const actionKind = asActionType(n.type);
        if (actionKind) {
          const field = ACTION_DATA_FIELD[actionKind];
          if (!String(n.data[field] ?? "").trim()) {
            add(byNode, n.id, ACTION_FIELD_MESSAGE[field]);
          }
        }
        break;
      }
    }

    if (
      (n.type === "condition" || asActionType(n.type) !== undefined) &&
      n.data.hasErrorFallback
    ) {
      const hasFallbackEdge = edges.some(
        (e) => e.source === n.id && e.sourceHandle === ERROR_FALLBACK_HANDLE,
      );
      if (!hasFallbackEdge) {
        add(
          byNode,
          n.id,
          "The error/timeout fallback is enabled but not connected to a path.",
        );
      }
    }
  }

  if (entries.length === 1) {
    const entryId = entries[0]!.id;
    const reachable = new Set<string>();
    const adj = new Map<string, string[]>();
    for (const e of edges) {
      if (!adj.has(e.source)) adj.set(e.source, []);
      adj.get(e.source)!.push(e.target);
    }
    reachable.add(entryId);
    const stack = [entryId];
    while (stack.length) {
      const id = stack.pop()!;
      for (const t of adj.get(id) ?? []) {
        if (!reachable.has(t)) {
          reachable.add(t);
          stack.push(t);
        }
      }
    }
    for (const n of nodes) {
      if (!reachable.has(n.id)) {
        add(
          byNode,
          n.id,
          "Not reachable from the entry point — connect this node.",
        );
      }
    }
  }

  if (entries.length === 1 && ends.length === 1) {
    const sim = simulateJourney(nodes, edges);
    if (!sim.ok) {
      global.push(sim.error);
    }
  }

  const hasNodeIssue = nodes.some((n) => (byNode[n.id]?.length ?? 0) > 0);
  const isValid = global.length === 0 && !hasNodeIssue;

  return { isValid, byNode, global };
}
