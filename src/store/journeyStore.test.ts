import { beforeEach, describe, expect, it } from "vitest";
import { useJourneyStore } from "./journeyStore";
import { defaultJourney } from "@/lib/journeySchema";

function resetStore() {
  useJourneyStore.setState({
    nodes: [],
    edges: [],
    journeyName: "Untitled journey",
    journeyDescription: "",
    viewport: undefined,
    selectedId: null,
    hydrated: false,
    past: [],
    future: [],
    editSessionBaseline: null,
  });
}

describe("journeyStore", () => {
  beforeEach(() => {
    resetStore();
  });

  it("hydrates from a JourneyDocument", () => {
    const doc = defaultJourney();
    useJourneyStore.getState().hydrate(doc);
    const state = useJourneyStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.nodes).toEqual(doc.nodes);
    expect(state.journeyName).toBe(doc.meta?.name);
  });

  it("adds a node and can undo/redo the addition", () => {
    useJourneyStore.getState().hydrate(defaultJourney());
    const before = useJourneyStore.getState().nodes.length;

    useJourneyStore.getState().addNode({
      id: "n2",
      type: "end",
      position: { x: 10, y: 10 },
      data: { label: "End" },
    });
    expect(useJourneyStore.getState().nodes.length).toBe(before + 1);
    expect(useJourneyStore.getState().canUndo()).toBe(true);

    useJourneyStore.getState().undo();
    expect(useJourneyStore.getState().nodes.length).toBe(before);
    expect(useJourneyStore.getState().canRedo()).toBe(true);

    useJourneyStore.getState().redo();
    expect(useJourneyStore.getState().nodes.length).toBe(before + 1);
  });

  it("connecting an edge is undoable", () => {
    useJourneyStore.getState().hydrate(defaultJourney());
    useJourneyStore.getState().addNode({
      id: "n2",
      type: "end",
      position: { x: 10, y: 10 },
      data: { label: "End" },
    });
    useJourneyStore.getState().connectEdge({
      id: "e1",
      source: "entry-1",
      target: "n2",
    });
    expect(useJourneyStore.getState().edges).toHaveLength(1);

    useJourneyStore.getState().undo();
    expect(useJourneyStore.getState().edges).toHaveLength(0);
  });

  it("tracks a dirty edit session and only commits history when something actually changed", () => {
    useJourneyStore.getState().hydrate(defaultJourney());
    useJourneyStore.getState().beginEditSession();
    expect(useJourneyStore.getState().isEditSessionDirty()).toBe(false);

    const nodeId = useJourneyStore.getState().nodes[0]!.id;
    useJourneyStore.getState().updateNodeData(nodeId, { label: "Renamed" });
    expect(useJourneyStore.getState().isEditSessionDirty()).toBe(true);

    const pastBefore = useJourneyStore.getState().past.length;
    useJourneyStore.getState().commitEditSession();
    expect(useJourneyStore.getState().past.length).toBe(pastBefore + 1);
    expect(useJourneyStore.getState().editSessionBaseline).toBeNull();
  });

  it("discardEditSession reverts node data to the session baseline", () => {
    useJourneyStore.getState().hydrate(defaultJourney());
    const nodeId = useJourneyStore.getState().nodes[0]!.id;
    useJourneyStore.getState().setSelectedId(nodeId);
    useJourneyStore.getState().beginEditSession();
    useJourneyStore.getState().updateNodeData(nodeId, { label: "Renamed" });

    useJourneyStore.getState().discardEditSession();
    const reverted = useJourneyStore
      .getState()
      .nodes.find((n) => n.id === nodeId);
    expect(reverted?.data.label).not.toBe("Renamed");
  });

  it("clamps and persists panel widths", () => {
    useJourneyStore.getState().setPaletteWidth(9999);
    expect(useJourneyStore.getState().paletteWidth).toBeLessThanOrEqual(400);

    useJourneyStore.getState().setPaletteWidth((w) => w + 10);
    expect(useJourneyStore.getState().paletteWidth).toBeGreaterThan(0);
  });
});
