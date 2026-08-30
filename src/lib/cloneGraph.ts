import type { Edge, Node } from "@xyflow/react";
import type { JourneyNodeData } from "@/lib/journeySchema";
import { isEntryNodeType } from "@/lib/journeySchema";

export type NodeIdFactory = () => string;

/**
 * Clones a node/edge subgraph with fresh ids and an optional position
 * offset — the shared logic behind both canvas copy/paste and inserting a
 * Journey Fragment (see README → Backlog). Entry-point nodes are always
 * dropped from the clone: a journey can only have one entry point, so
 * duplicating one would immediately break validation rather than produce
 * something useful.
 *
 * Only edges whose *both* endpoints survive the clone (i.e., weren't an
 * entry node, and were actually part of the input node set) are kept —
 * an edge reaching outside the cloned set wouldn't have anywhere to
 * reconnect to.
 */
export function cloneNodesAndEdges(
  nodes: Node<JourneyNodeData>[],
  edges: Edge[],
  offset: { x: number; y: number },
  makeId: NodeIdFactory,
): { nodes: Node<JourneyNodeData>[]; edges: Edge[]; skippedEntryCount: number } {
  const keepable = nodes.filter((n) => !isEntryNodeType(n.type));
  const skippedEntryCount = nodes.length - keepable.length;

  const idMap = new Map<string, string>();
  for (const n of keepable) {
    idMap.set(n.id, makeId());
  }

  const clonedNodes: Node<JourneyNodeData>[] = keepable.map((n) => ({
    ...n,
    id: idMap.get(n.id)!,
    position: { x: n.position.x + offset.x, y: n.position.y + offset.y },
    selected: true,
    data: { ...n.data },
  }));

  const clonedEdges: Edge[] = edges
    .filter((e) => idMap.has(e.source) && idMap.has(e.target))
    .map((e) => ({
      ...e,
      id: makeId(),
      source: idMap.get(e.source)!,
      target: idMap.get(e.target)!,
    }));

  return { nodes: clonedNodes, edges: clonedEdges, skippedEntryCount };
}

/**
 * Shifts a node set so its top-left bounding corner sits at (0, 0) —
 * used when saving a Journey Fragment so it drops near wherever the person
 * drags it later, rather than wherever it happened to be drawn originally.
 */
export function normalizePositions(
  nodes: Node<JourneyNodeData>[],
): Node<JourneyNodeData>[] {
  if (nodes.length === 0) return nodes;
  const minX = Math.min(...nodes.map((n) => n.position.x));
  const minY = Math.min(...nodes.map((n) => n.position.y));
  return nodes.map((n) => ({
    ...n,
    position: { x: n.position.x - minX, y: n.position.y - minY },
  }));
}
