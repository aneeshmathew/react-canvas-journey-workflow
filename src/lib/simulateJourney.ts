import type { Edge, Node } from "@xyflow/react";
import type { JourneyNodeData } from "@/lib/journeySchema";
import { isEntryNodeType } from "@/lib/journeySchema";

export type SimulationStep = {
  id: string;
  label: string;
  type: string;
  /** Set when this step was reached via a named Condition branch (or the error/timeout fallback handle). */
  branchLabel?: string;
};

export type SimulationPath = {
  steps: SimulationStep[];
};

export type SimulationResult =
  | { ok: true; paths: SimulationPath[]; warnings: string[] }
  | { ok: false; error: string };

const MAX_PATHS = 200;
const MAX_DEPTH = 300;

/**
 * Walks every branch from the single entry-point node to an End node,
 * enumerating one `SimulationPath` per distinct route. This replaced the
 * old "follow the first edge only" single-path walk once Condition nodes
 * (real branching, via named source handles) landed — see README → Roadmap
 * → Phase 2.
 *
 * A true cycle (a node revisited within the *same* root-to-leaf path) is an
 * error. Two branches re-converging on the same downstream node is normal
 * and NOT a cycle — each path walks it independently.
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

  type OutEdge = { target: string; branchLabel?: string };
  const adj = new Map<string, OutEdge[]>();
  for (const e of edges) {
    const list = adj.get(e.source) ?? [];
    // "out" is the default single-output handle id used by every
    // non-branching node (see journeyNodes.tsx's `Base` component) — it
    // isn't a meaningful branch name, so don't surface it as one. Only
    // Condition branches and the error/timeout fallback handle carry a
    // real label.
    const branchLabel =
      e.sourceHandle && e.sourceHandle !== "out" ? e.sourceHandle : undefined;
    list.push({ target: e.target, branchLabel });
    adj.set(e.source, list);
  }
  // Deterministic order: by target id (named branches don't need special
  // ordering since each becomes its own path in the result set anyway).
  for (const [, list] of adj) {
    list.sort((a, b) => a.target.localeCompare(b.target));
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const warnings: string[] = [];
  const paths: SimulationPath[] = [];
  let truncated = false;

  /** DFS from `nodeId`; returns a fatal error string, or null on success. */
  function walk(
    nodeId: string,
    stepsSoFar: SimulationStep[],
    onStack: Set<string>,
    branchLabel: string | undefined,
  ): string | null {
    if (truncated) return null;
    if (paths.length >= MAX_PATHS) {
      truncated = true;
      return null;
    }
    if (stepsSoFar.length >= MAX_DEPTH) {
      return `Path exceeded ${MAX_DEPTH} steps — check for an unintended loop near "${stepsSoFar.at(-1)?.label}".`;
    }
    if (onStack.has(nodeId)) {
      const n = nodeById.get(nodeId);
      return `Cycle detected at "${String(n?.data.label ?? nodeId)}".`;
    }
    const n = nodeById.get(nodeId);
    if (!n) return `Missing node for id "${nodeId}".`;

    const step: SimulationStep = {
      id: nodeId,
      label: String(n.data.label ?? nodeId),
      type: String(n.type),
      branchLabel,
    };
    const nextSteps = stepsSoFar.concat(step);

    if (n.type === "end") {
      paths.push({ steps: nextSteps });
      return null;
    }

    const outEdges = adj.get(nodeId) ?? [];
    if (outEdges.length === 0) {
      return `Dead end after "${String(n.data.label ?? nodeId)}" — connect toward an End node.`;
    }

    // Condition nodes are *meant* to fan out via named branches; anything
    // else with multiple outgoing edges is unmodeled ambiguity worth
    // flagging, even though we now simulate every branch either way.
    if (n.type !== "condition" && outEdges.length > 1) {
      warnings.push(
        `Branch at "${String(n.data.label ?? nodeId)}": ${outEdges.length} outgoing edges; simulating all of them.`,
      );
    }

    const nextOnStack = new Set(onStack);
    nextOnStack.add(nodeId);

    for (const out of outEdges) {
      const err = walk(out.target, nextSteps, nextOnStack, out.branchLabel);
      if (err) return err;
    }
    return null;
  }

  const entryId = entries[0]!.id;
  const err = walk(entryId, [], new Set(), undefined);
  if (err) {
    return { ok: false, error: err };
  }
  if (paths.length === 0) {
    return { ok: false, error: "No path from the entry point reached End." };
  }
  if (truncated) {
    warnings.push(
      `Simulation stopped after ${MAX_PATHS} paths — this journey branches into more paths than that; showing a subset.`,
    );
  }
  return { ok: true, paths, warnings };
}
