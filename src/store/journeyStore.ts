/**
 * Journey canvas store (Phase 0).
 *
 * Replaces the local `useState` / `useNodesState` / `useEdgesState` cluster
 * that used to live inside `FlowCanvas` (see `JourneyBuilder.tsx`) with a
 * single Zustand store. Goals for this first pass:
 *
 *  - One place for `nodes` / `edges` / journey name / viewport / selection /
 *    panel widths, instead of ~10 separate `useState` calls plus refs used
 *    to work around stale-closure issues.
 *  - Undo/redo, which did not exist at all before this migration.
 *
 * Scope note: undo/redo here covers **structural** edits — add node,
 * delete node/edge, connect, reconnect, and "commit" of an Inspector
 * editing session. It intentionally does *not* snapshot on every keystroke
 * while a field is focused (that would flood the history stack and undo
 * would feel like it does nothing, one character at a time). Field-level
 * undo granularity is left as a future refinement — see README → Roadmap.
 */
import { create } from "zustand";
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import type { JourneyDocument, JourneyNodeData } from "@/lib/journeySchema";
import { JOURNEY_VERSION } from "@/lib/journeySchema";
import {
  INSPECTOR_PANEL,
  PALETTE_PANEL,
  clampWidth,
  loadPanelWidth,
  savePanelWidth,
} from "@/lib/panelWidths";

export type JourneyNode = Node<JourneyNodeData>;

type GraphSnapshot = {
  nodes: JourneyNode[];
  edges: Edge[];
};

const MAX_HISTORY = 50;

function cloneSnapshot(nodes: JourneyNode[], edges: Edge[]): GraphSnapshot {
  // Structural clone via JSON is fine here: JourneyNodeData is plain
  // JSON-serializable data, and history snapshots are taken infrequently
  // (on structural edits only), not per-frame.
  return {
    nodes: JSON.parse(JSON.stringify(nodes)) as JourneyNode[],
    edges: JSON.parse(JSON.stringify(edges)) as Edge[],
  };
}

type JourneyStoreState = {
  nodes: JourneyNode[];
  edges: Edge[];
  journeyName: string;
  journeyDescription: string;
  viewport: JourneyDocument["viewport"];
  selectedId: string | null;
  hydrated: boolean;

  paletteWidth: number;
  inspectorWidth: number;

  past: GraphSnapshot[];
  future: GraphSnapshot[];
  /** Snapshot taken when the Inspector opened, used to detect a dirty edit session to commit to history on save/close. */
  editSessionBaseline: GraphSnapshot | null;

  // --- hydration ---
  hydrate: (doc: JourneyDocument) => void;

  // --- journey-level ---
  setJourneyName: (name: string) => void;
  setJourneyDescription: (description: string) => void;
  setViewport: (vp: JourneyDocument["viewport"]) => void;

  // --- graph mutation (React Flow wiring) ---
  onNodesChange: (changes: NodeChange<JourneyNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  addNode: (node: JourneyNode) => void;
  connectEdge: (edge: Edge) => void;
  setEdgesDirect: (edges: Edge[]) => void;
  updateNodeData: (id: string, patch: Partial<JourneyNodeData>) => void;
  /** Keeps edges attached when a Condition branch is renamed in the Inspector. */
  renameSourceHandle: (nodeId: string, oldHandle: string, newHandle: string) => void;
  /** Drops edges left dangling when a Condition branch is deleted. */
  removeEdgesForSourceHandle: (nodeId: string, handle: string) => void;

  // --- selection ---
  setSelectedId: (id: string | null) => void;
  markNodesSelected: (predicate: (id: string) => boolean) => void;

  // --- panel widths ---
  setPaletteWidth: (updater: number | ((w: number) => number)) => void;
  setInspectorWidth: (updater: number | ((w: number) => number)) => void;

  // --- undo/redo ---
  commitHistory: () => void;
  beginEditSession: () => void;
  commitEditSession: () => void;
  discardEditSession: () => JourneyNodeData | null;
  isEditSessionDirty: () => boolean;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // --- export ---
  toDocument: () => JourneyDocument;
};

export const useJourneyStore = create<JourneyStoreState>((set, get) => ({
  nodes: [],
  edges: [],
  journeyName: "Untitled journey",
  journeyDescription: "",
  viewport: undefined,
  selectedId: null,
  hydrated: false,

  paletteWidth: loadPanelWidth(
    PALETTE_PANEL.storageKey,
    PALETTE_PANEL.default,
    PALETTE_PANEL.min,
    PALETTE_PANEL.max,
  ),
  inspectorWidth: loadPanelWidth(
    INSPECTOR_PANEL.storageKey,
    INSPECTOR_PANEL.default,
    INSPECTOR_PANEL.min,
    INSPECTOR_PANEL.max,
  ),

  past: [],
  future: [],
  editSessionBaseline: null,

  hydrate: (doc) => {
    set({
      nodes: doc.nodes,
      edges: doc.edges,
      journeyName: doc.meta?.name ?? "Untitled journey",
      journeyDescription: doc.meta?.description ?? "",
      viewport: doc.viewport,
      selectedId: null,
      past: [],
      future: [],
      editSessionBaseline: null,
      hydrated: true,
    });
  },

  setJourneyName: (name) => set({ journeyName: name }),
  setJourneyDescription: (description) => set({ journeyDescription: description }),
  setViewport: (vp) => set({ viewport: vp }),

  onNodesChange: (changes) => {
    const hasRemoval = changes.some((c) => c.type === "remove");
    if (hasRemoval) get().commitHistory();
    set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) }));
  },

  onEdgesChange: (changes) => {
    const hasRemoval = changes.some((c) => c.type === "remove");
    if (hasRemoval) get().commitHistory();
    set((state) => ({ edges: applyEdgeChanges(changes, state.edges) }));
  },

  addNode: (node) => {
    get().commitHistory();
    set((state) => ({ nodes: state.nodes.concat(node) }));
  },

  connectEdge: (edge) => {
    get().commitHistory();
    set((state) => ({ edges: state.edges.concat(edge) }));
  },

  setEdgesDirect: (edges) => {
    get().commitHistory();
    set({ edges });
  },

  updateNodeData: (id, patch) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
      ),
    }));
  },

  renameSourceHandle: (nodeId, oldHandle, newHandle) => {
    if (oldHandle === newHandle) return;
    set((state) => ({
      edges: state.edges.map((e) =>
        e.source === nodeId && e.sourceHandle === oldHandle
          ? { ...e, sourceHandle: newHandle }
          : e,
      ),
    }));
  },

  removeEdgesForSourceHandle: (nodeId, handle) => {
    set((state) => ({
      edges: state.edges.filter(
        (e) => !(e.source === nodeId && e.sourceHandle === handle),
      ),
    }));
  },

  setSelectedId: (id) => set({ selectedId: id }),

  markNodesSelected: (predicate) => {
    set((state) => ({
      nodes: state.nodes.map((n) => ({ ...n, selected: predicate(n.id) })),
    }));
  },

  setPaletteWidth: (updater) => {
    set((state) => {
      const next = clampWidth(
        typeof updater === "function" ? updater(state.paletteWidth) : updater,
        PALETTE_PANEL.min,
        PALETTE_PANEL.max,
      );
      savePanelWidth(PALETTE_PANEL.storageKey, next);
      return { paletteWidth: next };
    });
  },

  setInspectorWidth: (updater) => {
    set((state) => {
      const next = clampWidth(
        typeof updater === "function"
          ? updater(state.inspectorWidth)
          : updater,
        INSPECTOR_PANEL.min,
        INSPECTOR_PANEL.max,
      );
      savePanelWidth(INSPECTOR_PANEL.storageKey, next);
      return { inspectorWidth: next };
    });
  },

  commitHistory: () => {
    set((state) => {
      const snapshot = cloneSnapshot(state.nodes, state.edges);
      const past = state.past.concat(snapshot).slice(-MAX_HISTORY);
      return { past, future: [] };
    });
  },

  beginEditSession: () => {
    const { nodes, edges } = get();
    set({ editSessionBaseline: cloneSnapshot(nodes, edges) });
  },

  isEditSessionDirty: () => {
    const { editSessionBaseline, nodes, edges } = get();
    if (!editSessionBaseline) return false;
    return (
      JSON.stringify(nodes) !== JSON.stringify(editSessionBaseline.nodes) ||
      JSON.stringify(edges) !== JSON.stringify(editSessionBaseline.edges)
    );
  },

  commitEditSession: () => {
    const { editSessionBaseline } = get();
    if (editSessionBaseline && get().isEditSessionDirty()) {
      set((state) => ({
        past: state.past.concat(editSessionBaseline).slice(-MAX_HISTORY),
        future: [],
      }));
    }
    set({ editSessionBaseline: null });
  },

  discardEditSession: () => {
    const { editSessionBaseline, selectedId } = get();
    if (!editSessionBaseline) return null;
    set({
      nodes: editSessionBaseline.nodes,
      edges: editSessionBaseline.edges,
      editSessionBaseline: null,
    });
    const reverted =
      editSessionBaseline.nodes.find((n) => n.id === selectedId)?.data ??
      null;
    return reverted;
  },

  undo: () => {
    set((state) => {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1]!;
      const currentSnapshot = cloneSnapshot(state.nodes, state.edges);
      return {
        nodes: previous.nodes,
        edges: previous.edges,
        past: state.past.slice(0, -1),
        future: [currentSnapshot, ...state.future].slice(0, MAX_HISTORY),
        selectedId: null,
      };
    });
  },

  redo: () => {
    set((state) => {
      if (state.future.length === 0) return state;
      const next = state.future[0]!;
      const currentSnapshot = cloneSnapshot(state.nodes, state.edges);
      return {
        nodes: next.nodes,
        edges: next.edges,
        past: state.past.concat(currentSnapshot).slice(-MAX_HISTORY),
        future: state.future.slice(1),
        selectedId: null,
      };
    });
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  toDocument: () => {
    const { nodes, edges, journeyName, journeyDescription, viewport } = get();
    return {
      version: JOURNEY_VERSION,
      meta: {
        name: journeyName,
        description: journeyDescription,
        updatedAt: new Date().toISOString(),
      },
      nodes,
      edges,
      viewport,
    };
  },
}));
