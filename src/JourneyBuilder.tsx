import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  ConnectionLineType,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ExecutionDryRunModal } from "@/components/ExecutionDryRunModal";
import { TestModeModal } from "@/components/TestModeModal";
import { Inspector } from "@/components/Inspector";
import { InspectorLeavePrompt } from "@/components/InspectorLeavePrompt";
import { PanelResizeHandle } from "@/components/PanelResizeHandle";
import { AppShell } from "@/components/shell/AppShell";
import { JourneyEditorHeader } from "@/components/shell/JourneyEditorHeader";
import { JourneyPropertiesPanel } from "@/components/shell/JourneyPropertiesPanel";
import { PublishHistoryModal } from "@/components/shell/PublishHistoryModal";
import {
  ActionNode,
  AudienceNode,
  ConditionNode,
  EndNode,
  EntryNode,
  EventNode,
  EventReactionNode,
  WaitNode,
} from "@/components/nodes/journeyNodes";
import { Palette, FRAGMENT_DRAG_MIME } from "@/components/palette/Palette";
import { cloneNodesAndEdges, normalizePositions } from "@/lib/cloneGraph";
import {
  ACTION_NODE_LABELS,
  DEFAULT_CONDITION_BRANCHES,
  defaultJourney,
  ERROR_FALLBACK_HANDLE,
  ERROR_FALLBACK_LABEL,
  isActionNodeType,
  isEntryNodeType,
  parseJourney,
  serializeJourney,
  ENTRY_NODE_LABELS,
  type JourneyDocument,
  type JourneyNodeData,
  type JourneyNodeType,
} from "@/lib/journeySchema";
import { JourneyValidationProvider } from "@/context/JourneyValidationContext";
import { buildPublishBundle, serializePublishBundle } from "@/lib/publishBundle";
import { validateJourney, type JourneyValidationResult } from "@/lib/journeyValidation";
import { simulateJourney, type SimulationPath } from "@/lib/simulateJourney";
import { downloadJson, readFileAsText } from "@/lib/storage";
import { useJourneyStore, type JourneyNode } from "@/store/journeyStore";
import {
  useJourneyQuery,
  usePublishJourneyMutation,
  useSaveJourneyMutation,
  useFragmentsQuery,
  useSaveFragmentMutation,
} from "@/hooks/queries/useJourneyQueries";

const nodeTypes = {
  // Defensive fallback: any hand-crafted or pre-migration document that still
  // has a literal "start"/"email" node renders fine — `parseJourney`/
  // `defaultJourney` never produce either anymore (see journeySchema.ts).
  start: EntryNode,
  "entry-read-audience": EntryNode,
  "entry-audience-qualification": EntryNode,
  "entry-unitary-event": EntryNode,
  "entry-business-event": EntryNode,
  audience: AudienceNode,
  event: EventNode,
  "event-reaction": EventReactionNode,
  condition: ConditionNode,
  wait: WaitNode,
  email: ActionNode,
  "action-email": ActionNode,
  "action-push": ActionNode,
  "action-sms": ActionNode,
  "action-inapp": ActionNode,
  "action-web": ActionNode,
  "action-code": ActionNode,
  "action-content-card": ActionNode,
  "action-custom": ActionNode,
  end: EndNode,
} satisfies NodeTypes;

function defaultData(type: JourneyNodeType): JourneyNodeData {
  if (isEntryNodeType(type)) {
    return { ...ENTRY_NODE_LABELS[type] };
  }
  if (isActionNodeType(type)) {
    return { ...ACTION_NODE_LABELS[type] };
  }
  switch (type) {
    case "end":
      return { label: "End" };
    case "audience":
      return { label: "Audience", subtitle: "Who enters" };
    case "event":
      return {
        label: "Event",
        subtitle: "When it happens",
        eventKey: "event.name",
      };
    case "event-reaction":
      return {
        label: "Reaction event",
        subtitle: "Opened / clicked / bounced / unsubscribed",
      };
    case "condition":
      return {
        label: "Condition",
        subtitle: "Branch the journey",
        branches: [...DEFAULT_CONDITION_BRANCHES],
      };
    case "wait":
      return {
        label: "Wait",
        waitAmount: 1,
        waitUnit: "days",
      };
    default:
      return { label: "Node" };
  }
}

function useDebouncedEffect(
  fn: () => void,
  deps: unknown[],
  ms: number,
): void {
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(t.current);
    t.current = setTimeout(fn, ms);
    return () => clearTimeout(t.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce bundle
  }, deps);
}

function ValidationStatusBanner({ v }: { v: JourneyValidationResult }) {
  if (v.isValid) {
    return (
      <div className="validation-banner validation-banner--ok" role="status">
        All checks passed. Dry run, Publish, and Export are allowed.
      </div>
    );
  }
  const nodeIssueCount = Object.entries(v.byNode).filter(
    ([, msgs]) => msgs.length > 0,
  ).length;
  return (
    <div className="validation-banner validation-banner--bad" role="alert">
      <strong>Fix issues below to enable Dry run &amp; Publish.</strong> Export is
      blocked until validation passes.
      {v.global.length > 0 ? (
        <ul>
          {v.global.map((g, i) => (
            <li key={`${i}-${g.slice(0, 24)}`}>{g}</li>
          ))}
        </ul>
      ) : null}
      {nodeIssueCount > 0 ? (
        <p>
          {nodeIssueCount} node(s) have errors (red outline). Hover a node for
          details.
        </p>
      ) : null}
    </div>
  );
}

function FlowCanvas() {
  const journeyQuery = useJourneyQuery();
  const saveMutation = useSaveJourneyMutation();
  const publishMutation = usePublishJourneyMutation();
  const fragmentsQuery = useFragmentsQuery();
  const saveFragmentMutation = useSaveFragmentMutation();

  const {
    screenToFlowPosition,
    setViewport: setReactFlowViewport,
    getViewport,
    zoomIn,
    zoomOut,
    fitView,
  } = useReactFlow();

  // --- store-backed state (replaces the old useState/useNodesState cluster) ---
  const hydrated = useJourneyStore((s) => s.hydrated);
  const nodes = useJourneyStore((s) => s.nodes);
  const edges = useJourneyStore((s) => s.edges);
  const journeyName = useJourneyStore((s) => s.journeyName);
  const journeyDescription = useJourneyStore((s) => s.journeyDescription);
  const selectedId = useJourneyStore((s) => s.selectedId);
  const paletteWidth = useJourneyStore((s) => s.paletteWidth);
  const inspectorWidth = useJourneyStore((s) => s.inspectorWidth);
  const canUndo = useJourneyStore((s) => s.past.length > 0);
  const canRedo = useJourneyStore((s) => s.future.length > 0);
  const canPaste = useJourneyStore(
    (s) => (s.clipboard?.nodes.length ?? 0) > 0,
  );

  const hydrate = useJourneyStore((s) => s.hydrate);
  const setJourneyName = useJourneyStore((s) => s.setJourneyName);
  const setJourneyDescription = useJourneyStore((s) => s.setJourneyDescription);
  const setStoreViewport = useJourneyStore((s) => s.setViewport);
  const onNodesChangeStore = useJourneyStore((s) => s.onNodesChange);
  const onEdgesChangeStore = useJourneyStore((s) => s.onEdgesChange);
  const addNode = useJourneyStore((s) => s.addNode);
  const connectEdgeStore = useJourneyStore((s) => s.connectEdge);
  const setEdgesDirect = useJourneyStore((s) => s.setEdgesDirect);
  const updateNodeDataStore = useJourneyStore((s) => s.updateNodeData);
  const renameSourceHandle = useJourneyStore((s) => s.renameSourceHandle);
  const removeEdgesForSourceHandle = useJourneyStore(
    (s) => s.removeEdgesForSourceHandle,
  );
  const setSelectedIdStore = useJourneyStore((s) => s.setSelectedId);
  const markNodesSelected = useJourneyStore((s) => s.markNodesSelected);
  const setPaletteWidth = useJourneyStore((s) => s.setPaletteWidth);
  const setInspectorWidth = useJourneyStore((s) => s.setInspectorWidth);
  const beginEditSession = useJourneyStore((s) => s.beginEditSession);
  const commitEditSession = useJourneyStore((s) => s.commitEditSession);
  const discardEditSession = useJourneyStore((s) => s.discardEditSession);
  const isEditSessionDirty = useJourneyStore((s) => s.isEditSessionDirty);
  const undo = useJourneyStore((s) => s.undo);
  const redo = useJourneyStore((s) => s.redo);
  const copySelection = useJourneyStore((s) => s.copySelection);
  const pasteClipboard = useJourneyStore((s) => s.pasteClipboard);
  const insertSubgraph = useJourneyStore((s) => s.insertSubgraph);
  const toDocument = useJourneyStore((s) => s.toDocument);

  const [error, setError] = useState<string | null>(null);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [testModeOpen, setTestModeOpen] = useState(false);
  const [copyNote, setCopyNote] = useState<string | null>(null);
  const [inspectorNavPrompt, setInspectorNavPrompt] = useState<{
    nextId: string | null;
    fromNodeId: string;
  } | null>(null);

  const handleCopy = useCallback(() => {
    const { copiedCount, skippedEntryCount } = copySelection();
    if (copiedCount === 0 && skippedEntryCount === 0) {
      setCopyNote("Select a node first — nothing was copied.");
    } else if (skippedEntryCount > 0) {
      setCopyNote(
        `Copied ${copiedCount} node(s). Entry points can't be duplicated, so ${skippedEntryCount} was skipped.`,
      );
    } else {
      setCopyNote(`Copied ${copiedCount} node(s).`);
    }
  }, [copySelection]);

  const handlePaste = useCallback(() => {
    pasteClipboard();
  }, [pasteClipboard]);

  // Ctrl/Cmd+C / Ctrl/Cmd+V for canvas copy/paste (see also the Copy/Paste
  // toolbar buttons for discoverability). Skipped while focus is in a text
  // field so it doesn't hijack normal text copy/paste in the Inspector, the
  // journey-name field, etc.
  useEffect(() => {
    const isTextInput = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (isTextInput(e.target)) return;
      if (e.key === "c" || e.key === "C") {
        handleCopy();
      } else if (e.key === "v" || e.key === "V") {
        handlePaste();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleCopy, handlePaste]);

  useEffect(() => {
    if (!copyNote) return;
    const t = window.setTimeout(() => setCopyNote(null), 3000);
    return () => window.clearTimeout(t);
  }, [copyNote]);

  const selectedIdRef = useRef<string | null>(null);
  const inspectorPromptOpenRef = useRef(false);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
  useEffect(() => {
    inspectorPromptOpenRef.current = inspectorNavPrompt !== null;
  }, [inspectorNavPrompt]);

  // Begin/track an "edit session" baseline whenever selection changes, so
  // the store can tell (a) whether the leave-prompt should fire and (b)
  // whether a single history entry should be committed on save/close.
  useLayoutEffect(() => {
    if (selectedId) beginEditSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per selection change
  }, [selectedId]);

  const selected = nodes.find((n) => n.id === selectedId) ?? null;
  const [viewTick, setViewTick] = useState(0);
  const [simulation, setSimulation] = useState<
    | { kind: "success"; paths: SimulationPath[]; warnings: string[] }
    | { kind: "error"; message: string }
    | null
  >(null);
  const [dryRunModal, setDryRunModal] = useState<{
    paths: SimulationPath[];
    warnings: string[];
  } | null>(null);
  const [dryRunError, setDryRunError] = useState<string | null>(null);

  // --- hydrate the store once the journey query resolves ---
  useEffect(() => {
    if (journeyQuery.data && !hydrated) {
      hydrate(journeyQuery.data);
      if (journeyQuery.data.viewport) {
        void setReactFlowViewport(journeyQuery.data.viewport);
      }
    }
  }, [journeyQuery.data, hydrated, hydrate, setReactFlowViewport]);

  const validation = useMemo(
    () => validateJourney(nodes, edges),
    [nodes, edges],
  );

  // Condition/error-fallback edges carry their branch name as `sourceHandle`
  // rather than a stored label — derive the display label here so renaming a
  // branch (or toggling the fallback) is reflected immediately without a
  // separate "keep edge labels in sync" write path.
  const displayEdges = useMemo(
    () =>
      edges.map((e) => {
        if (!e.sourceHandle || e.sourceHandle === "out") return e;
        const label =
          e.sourceHandle === ERROR_FALLBACK_HANDLE
            ? ERROR_FALLBACK_LABEL
            : e.sourceHandle;
        return { ...e, label };
      }),
    [edges],
  );

  const needsInspectorLeavePrompt = useCallback(
    (nodeId: string) => {
      const dirty = isEditSessionDirty();
      const hasVal = (validation.byNode[nodeId]?.length ?? 0) > 0;
      return dirty || hasVal;
    },
    [isEditSessionDirty, validation],
  );

  useEffect(() => {
    if (
      validation.isValid &&
      error === "Resolve all validation issues before exporting."
    ) {
      setError(null);
    }
  }, [validation.isValid, error]);

  // --- autosave, now via the save mutation instead of a raw localStorage call ---
  useDebouncedEffect(
    () => {
      if (!hydrated) return;
      saveMutation.mutate(toDocument());
    },
    [nodes, edges, journeyName, viewTick, hydrated],
    450,
  );

  const applyDocument = useCallback(
    (doc: JourneyDocument) => {
      hydrate(doc);
      if (doc.viewport) {
        void setReactFlowViewport(doc.viewport);
      }
      setError(null);
      setSimulation(null);
      setDryRunModal(null);
      setDryRunError(null);
    },
    [hydrate, setReactFlowViewport],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      connectEdgeStore({
        id: crypto.randomUUID(),
        source: c.source,
        target: c.target,
        sourceHandle: c.sourceHandle,
        targetHandle: c.targetHandle,
      });
    },
    [connectEdgeStore],
  );

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      setEdgesDirect(
        edges.map((e) =>
          e.id === oldEdge.id
            ? {
                ...e,
                source: newConnection.source,
                target: newConnection.target,
                sourceHandle: newConnection.sourceHandle,
                targetHandle: newConnection.targetHandle,
              }
            : e,
        ),
      );
    },
    [edges, setEdgesDirect],
  );

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const fragmentId = e.dataTransfer.getData(FRAGMENT_DRAG_MIME);
      if (fragmentId) {
        const fragment = fragmentsQuery.data?.find((f) => f.id === fragmentId);
        if (!fragment) return;
        const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        insertSubgraph(fragment.nodes, fragment.edges, pos);
        return;
      }
      const type = e.dataTransfer.getData(
        "application/reactflow",
      ) as JourneyNodeType;
      if (!type || !(type in nodeTypes)) return;
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addNode({
        id: crypto.randomUUID(),
        type,
        position: pos,
        data: defaultData(type),
      } satisfies JourneyNode);
    },
    [screenToFlowPosition, addNode, fragmentsQuery.data, insertSubgraph],
  );

  const handleSaveFragment = useCallback(() => {
    const selected = nodes.filter((n) => n.selected);
    const extracted = cloneNodesAndEdges(selected, edges, { x: 0, y: 0 }, () =>
      crypto.randomUUID(),
    );
    if (extracted.nodes.length === 0) {
      setCopyNote(
        extracted.skippedEntryCount > 0
          ? "Entry points can't be saved as a fragment — select a different node."
          : "Select at least one node first — nothing was saved.",
      );
      return;
    }
    const name = window.prompt("Name this fragment:", "");
    if (!name) return;
    const normalized = normalizePositions(extracted.nodes);
    saveFragmentMutation.mutate(
      { name, nodes: normalized, edges: extracted.edges },
      {
        onSuccess: () =>
          setCopyNote(
            `Saved fragment "${name}" (${normalized.length} node(s)).`,
          ),
      },
    );
  }, [nodes, edges, saveFragmentMutation]);

  const onNodeData = useCallback(
    (id: string, patch: Partial<JourneyNodeData>) => {
      updateNodeDataStore(id, patch);
    },
    [updateNodeDataStore],
  );

  const requestCloseInspector = useCallback(() => {
    const prevId = selectedIdRef.current;
    if (!prevId) return;
    if (needsInspectorLeavePrompt(prevId)) {
      setInspectorNavPrompt({ nextId: null, fromNodeId: prevId });
      return;
    }
    setSelectedIdStore(null);
    markNodesSelected(() => false);
  }, [needsInspectorLeavePrompt, setSelectedIdStore, markNodesSelected]);

  const handleInspectorSaveAndClose = useCallback(() => {
    commitEditSession();
    saveMutation.mutate(toDocument());
    setSelectedIdStore(null);
    markNodesSelected(() => false);
  }, [commitEditSession, saveMutation, toDocument, setSelectedIdStore, markNodesSelected]);

  const handleInspectorPromptSave = useCallback(() => {
    if (!inspectorNavPrompt) return;
    const { nextId } = inspectorNavPrompt;
    commitEditSession();
    saveMutation.mutate(toDocument());
    setInspectorNavPrompt(null);
    setSelectedIdStore(nextId);
    markNodesSelected((id) => (nextId ? id === nextId : false));
  }, [inspectorNavPrompt, commitEditSession, saveMutation, toDocument, setSelectedIdStore, markNodesSelected]);

  const handleInspectorPromptDiscard = useCallback(() => {
    if (!inspectorNavPrompt) return;
    const { nextId } = inspectorNavPrompt;
    discardEditSession();
    setInspectorNavPrompt(null);
    setSelectedIdStore(nextId);
    markNodesSelected((id) => (nextId ? id === nextId : false));
  }, [inspectorNavPrompt, discardEditSession, setSelectedIdStore, markNodesSelected]);

  const handleInspectorPromptCancel = useCallback(() => {
    setInspectorNavPrompt(null);
  }, []);

  const onSelectionChange = useCallback(
    ({ nodes: sel }: { nodes: Node<JourneyNodeData>[] }) => {
      if (inspectorPromptOpenRef.current) return;
      const nextId = sel[0]?.id ?? null;
      const prevId = selectedIdRef.current;
      if (prevId === nextId) return;
      if (prevId && needsInspectorLeavePrompt(prevId)) {
        setInspectorNavPrompt({ nextId, fromNodeId: prevId });
        markNodesSelected((id) => id === prevId);
        return;
      }
      setSelectedIdStore(nextId);
    },
    [needsInspectorLeavePrompt, setSelectedIdStore, markNodesSelected],
  );

  const exportFile = () => {
    if (!validation.isValid) {
      setError("Resolve all validation issues before exporting.");
      return;
    }
    setError(null);
    const doc = toDocument();
    const safe =
      journeyName.replace(/[^\w\d-]+/g, "-").replace(/^-|-$/g, "") ||
      "journey";
    downloadJson(`${safe}.json`, serializeJourney(doc));
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      applyDocument(parseJourney(JSON.parse(text)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON file");
    }
  };

  const newJourney = () => {
    setSimulation(null);
    setDryRunModal(null);
    setDryRunError(null);
    applyDocument(defaultJourney());
  };

  const runSimulation = () => {
    const result = simulateJourney(nodes, edges);
    if (result.ok) {
      setSimulation({
        kind: "success",
        paths: result.paths,
        warnings: result.warnings,
      });
      setError(null);
    } else {
      setSimulation({ kind: "error", message: result.error });
    }
  };

  const runDryRun = () => {
    if (!validation.isValid) return;
    const result = simulateJourney(nodes, edges);
    if (result.ok) {
      setDryRunError(null);
      setDryRunModal({ paths: result.paths, warnings: result.warnings });
    } else {
      setDryRunModal(null);
      setDryRunError(result.error);
    }
  };

  const publishBundle = () => {
    if (!validation.isValid) return;
    const doc = toDocument();
    const bundle = buildPublishBundle(doc);
    publishMutation.mutate(bundle, {
      onSuccess: () => {
        const safe =
          journeyName.replace(/[^\w\d-]+/g, "-").replace(/^-|-$/g, "") ||
          "journey";
        downloadJson(`${safe}-publish.json`, serializePublishBundle(bundle));
      },
    });
  };

  const fromId = inspectorNavPrompt?.fromNodeId;
  const inspectorPromptDirty = Boolean(fromId && isEditSessionDirty());
  const inspectorPromptHasVal = Boolean(
    fromId && (validation.byNode[fromId]?.length ?? 0) > 0,
  );

  if (journeyQuery.isPending) {
    return (
      <div className="app-loading" role="status">
        Loading journey…
      </div>
    );
  }

  if (journeyQuery.isError) {
    return (
      <div className="error-banner" role="alert">
        Failed to load journey.{" "}
        <button type="button" onClick={() => void journeyQuery.refetch()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <JourneyValidationProvider value={validation}>
      <>
      <JourneyEditorHeader
        journeyName={journeyName}
        onJourneyNameChange={setJourneyName}
        isSaving={saveMutation.isPending}
        alertsCount={
          validation.global.length +
          Object.values(validation.byNode).filter((m) => m.length > 0).length
        }
        onTogglePropertiesPanel={() => setPropertiesOpen((o) => !o)}
        propertiesPanelOpen={propertiesOpen}
        onDelete={() => {
          if (
            window.confirm(
              "Clear this journey and start a new one? This can't be undone.",
            )
          ) {
            newJourney();
          }
        }}
        onOpenTestMode={() => setTestModeOpen(true)}
      />
      <TestModeModal
        open={testModeOpen}
        onClose={() => setTestModeOpen(false)}
        nodes={nodes}
        edges={edges}
      />
      <JourneyPropertiesPanel
        open={propertiesOpen}
        name={journeyName}
        description={journeyDescription}
        onNameChange={setJourneyName}
        onDescriptionChange={setJourneyDescription}
        onClose={() => setPropertiesOpen(false)}
      />
      <div className="app-toolbar" role="toolbar" aria-label="Authoring tools">
        <button type="button" onClick={newJourney}>
          New
        </button>
        <label className="file-btn">
          Import
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => void importFile(e.target.files?.[0])}
          />
        </label>
        <button
          type="button"
          onClick={exportFile}
          disabled={!validation.isValid}
          title={
            validation.isValid
              ? "Export journey JSON"
              : "Fix validation issues before export"
          }
        >
          Export
        </button>
        <button
          type="button"
          onClick={runSimulation}
          title="Simulation: ephemeral, walks every branch automatically, nothing saved"
        >
          Simulation
        </button>
        <button
          type="button"
          onClick={runDryRun}
          disabled={!validation.isValid}
          title={
            validation.isValid
              ? "Dry run: production-shaped preview, no real sends, walks every branch"
              : "Fix validation issues first"
          }
        >
          Dry run
        </button>
        <button
          type="button"
          onClick={publishBundle}
          disabled={!validation.isValid || publishMutation.isPending}
          title={
            validation.isValid
              ? "Publish (mock) and download bundle (journey + n8n stub)"
              : "Fix validation issues first"
          }
        >
          {publishMutation.isPending ? "Publishing…" : "Publish"}
        </button>
        <div className="toolbar-history" role="group" aria-label="Undo / redo">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            title="Undo last structural change"
            aria-label="Undo"
          >
            ↶ Undo
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            title="Redo"
            aria-label="Redo"
          >
            ↷ Redo
          </button>
        </div>
        <div className="toolbar-history" role="group" aria-label="Copy / paste">
          <button
            type="button"
            onClick={handleCopy}
            title="Copy selected node(s) (Ctrl/Cmd+C)"
            aria-label="Copy"
          >
            ⧉ Copy
          </button>
          <button
            type="button"
            onClick={handlePaste}
            disabled={!canPaste}
            title="Paste copied node(s) (Ctrl/Cmd+V)"
            aria-label="Paste"
          >
            📋 Paste
          </button>
          <button
            type="button"
            onClick={handleSaveFragment}
            title="Save the selected node(s) as a reusable Journey Fragment"
            aria-label="Save as Fragment"
          >
            🧩 Save as Fragment
          </button>
        </div>
        <div className="toolbar-zoom" role="group" aria-label="Canvas zoom">
          <button
            type="button"
            onClick={() => zoomOut({ duration: 200 })}
            title="Zoom out"
            aria-label="Zoom out canvas"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => void fitView({ padding: 0.2, duration: 200 })}
            title="Zoom to fit journey in view"
            aria-label="Zoom to fit journey in view"
          >
            Zoom
          </button>
          <button
            type="button"
            onClick={() => zoomIn({ duration: 200 })}
            title="Zoom in"
            aria-label="Zoom in canvas"
          >
            +
          </button>
        </div>
      </div>
      <ValidationStatusBanner v={validation} />
      {copyNote ? (
        <div className="sim-banner sim-banner--success" role="status">
          {copyNote}
        </div>
      ) : null}
      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}
      {simulation?.kind === "success" ? (
        <div className="sim-banner sim-banner--success" role="status">
          <strong>
            Simulation: {simulation.paths.length} path
            {simulation.paths.length === 1 ? "" : "s"} found (ephemeral — not
            saved; use Test mode to save a run):
          </strong>
          <ul className="sim-paths">
            {simulation.paths.map((p, i) => (
              <li key={i}>
                {p.steps
                  .map((s) =>
                    s.branchLabel ? `[${s.branchLabel}] ${s.label}` : s.label,
                  )
                  .join(" → ")}
              </li>
            ))}
          </ul>
          {simulation.warnings.length > 0 ? (
            <ul className="sim-warnings">
              {simulation.warnings.map((w, i) => (
                <li key={`${i}-${w.slice(0, 24)}`}>{w}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {simulation?.kind === "error" ? (
        <div className="error-banner" role="alert">
          {simulation.message}
        </div>
      ) : null}
      {dryRunError ? (
        <div className="error-banner" role="alert">
          Dry run: {dryRunError}
        </div>
      ) : null}
      <ExecutionDryRunModal
        open={dryRunModal !== null}
        onClose={() => setDryRunModal(null)}
        paths={dryRunModal?.paths ?? []}
        warnings={dryRunModal?.warnings ?? []}
      />
      <InspectorLeavePrompt
        open={inspectorNavPrompt !== null}
        hasUnsavedEdits={inspectorPromptDirty}
        hasValidationIssues={inspectorPromptHasVal}
        onSave={handleInspectorPromptSave}
        onDiscard={handleInspectorPromptDiscard}
        onCancel={handleInspectorPromptCancel}
      />
      <div className="app-body">
        <Palette width={paletteWidth} />
        <PanelResizeHandle
          ariaLabel="Resize palette"
          onResizeDelta={(delta) => setPaletteWidth((w) => w + delta)}
        />
        <div className="canvas-wrap">
          <ReactFlow
            nodes={nodes}
            edges={displayEdges}
            onNodesChange={onNodesChangeStore}
            onEdgesChange={onEdgesChangeStore}
            onConnect={onConnect}
            onReconnect={onReconnect}
            edgesReconnectable
            onMoveEnd={() => {
              setViewTick((t) => t + 1);
              setStoreViewport(getViewport());
            }}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            onSelectionChange={onSelectionChange}
            fitView
            minZoom={0.08}
            maxZoom={2.5}
            connectionLineType={ConnectionLineType.Bezier}
            snapToGrid
            snapGrid={[12, 12]}
            defaultEdgeOptions={{
              animated: true,
              /* Bezier curves — smooth “free-flow” links vs step/smoothstep */
              type: "default",
              reconnectable: true,
            }}
          >
            <Controls showZoom showFitView showInteractive={false} />
            <MiniMap zoomable pannable />
          </ReactFlow>
        </div>
        {selected ? (
          <>
            <PanelResizeHandle
              ariaLabel="Resize properties panel"
              onResizeDelta={(delta) => setInspectorWidth((w) => w - delta)}
            />
            <Inspector
              selected={selected}
              onChange={onNodeData}
              validationMessages={
                validation.byNode[selected.id] ?? []
              }
              onClose={requestCloseInspector}
              onSave={handleInspectorSaveAndClose}
              panelWidth={inspectorWidth}
              onRenameConditionBranch={renameSourceHandle}
              onRemoveConditionBranchEdges={removeEdgesForSourceHandle}
            />
          </>
        ) : null}
      </div>
      </>
    </JourneyValidationProvider>
  );
}

export function JourneyBuilder() {
  const [journeysModalOpen, setJourneysModalOpen] = useState(false);
  return (
    <ReactFlowProvider>
      <AppShell onJourneysClick={() => setJourneysModalOpen(true)}>
        <FlowCanvas />
      </AppShell>
      <PublishHistoryModal
        open={journeysModalOpen}
        onClose={() => setJourneysModalOpen(false)}
      />
    </ReactFlowProvider>
  );
}
