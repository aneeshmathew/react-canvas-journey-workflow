import type { Edge, Node } from "@xyflow/react";
import type { JourneyNodeData } from "@/lib/journeySchema";
import { isEntryNodeType } from "@/lib/journeySchema";

export type WalkOption = {
  /** Id of the edge this option represents — pass back to `advance` unchanged. */
  edgeId: string;
  targetId: string;
  targetLabel: string;
  /** Named branch (Condition) or fallback handle, when the edge carries one. */
  branchLabel?: string;
};

/**
 * Finds the journey's single entry node, for starting a Test mode walk.
 * Returns null if there isn't exactly one (Test mode requires a valid
 * journey — the "Test mode" button itself doesn't block on validity, but a
 * walk can't start without an unambiguous entry point).
 */
export function findSingleEntryNode(
  nodes: Node<JourneyNodeData>[],
): Node<JourneyNodeData> | null {
  const entries = nodes.filter((n) => isEntryNodeType(n.type));
  return entries.length === 1 ? entries[0]! : null;
}

/**
 * Lists the choices available from `nodeId`, each labeled with its branch
 * name when the outgoing edge carries one (Condition branches, or the
 * error/timeout fallback handle) and with the target node's own label
 * otherwise. Used to render "which way did this profile go?" buttons in
 * `TestModeModal` — unlike `simulateJourney`, this doesn't walk everything
 * automatically, since Test mode is a person choosing one path by hand.
 */
export function getWalkOptions(
  nodeId: string,
  nodes: Node<JourneyNodeData>[],
  edges: Edge[],
): WalkOption[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  return edges
    .filter((e) => e.source === nodeId)
    .map((e) => {
      const target = nodeById.get(e.target);
      const branchLabel =
        e.sourceHandle && e.sourceHandle !== "out" ? e.sourceHandle : undefined;
      return {
        edgeId: e.id,
        targetId: e.target,
        targetLabel: target ? String(target.data.label ?? e.target) : e.target,
        branchLabel,
      };
    })
    .sort((a, b) => a.targetId.localeCompare(b.targetId));
}
