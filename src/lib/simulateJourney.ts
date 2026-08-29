import type { Edge, Node } from "@xyflow/react";
import type { JourneyNodeData } from "@/lib/journeySchema";
import { isEntryNodeType } from "@/lib/journeySchema";

export type SimulationResult =
  | {
      ok: true;
      steps: { id: string; label: string; type: string }[];
      warnings: string[];
    }
  | { ok: false; error: string };

/**
 * Walks left-to-right from the single entry-point node, following the first
 * outgoing edge at each branch (targets sorted by id). Detects cycles and
 * dead ends.
 */
export function simulateJourney(
  nodes: Node<JourneyNodeData>[],
  edges: Edge[],
): SimulationResult {
  const entries = nodes.filter((n) => isEntryNodeType(n.type));
  if (entries.length === 0) {
    return {
      ok: false,
      error:
        "Add an entry point (Read Audience, Audience Qualification, Unitary Event, or Business Event) to the canvas.",
    };
  }
  if (entries.length > 1) {
    return { ok: false, error: "Use a single entry point for simulation." };
  }

  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.source) ?? [];
    list.push(e.target);
    adj.set(e.source, list);
  }
  for (const [, list] of adj) {
    list.sort((a, b) => a.localeCompare(b));
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const warnings: string[] = [];
  let current = entries[0]!.id;
  const pathIds: string[] = [];
  const visiting = new Set<string>();

  for (;;) {
    if (visiting.has(current)) {
      return { ok: false, error: "Cycle detected on the journey path." };
    }
    visiting.add(current);
    pathIds.push(current);

    const n = nodeById.get(current);
    if (!n) {
      return { ok: false, error: `Missing node for id "${current}".` };
    }

    if (n.type === "end") {
      const steps = pathIds.map((pid) => {
        const nn = nodeById.get(pid)!;
        return {
          id: pid,
          label: String(nn.data.label ?? pid),
          type: String(nn.type),
        };
      });
      return { ok: true, steps, warnings };
    }

    const next = adj.get(current) ?? [];
    if (next.length === 0) {
      return {
        ok: false,
        error: `Dead end after "${String(n.data.label ?? current)}" — connect toward an End node.`,
      };
    }
    if (next.length > 1) {
      warnings.push(
        `Branch at "${String(n.data.label ?? current)}": ${next.length} outgoing edges; using the first target (alphabetically by id).`,
      );
    }
    current = next[0]!;
  }
}
