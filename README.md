# Journey Flow

A **multi-journey builder** web app: manage journeys from a landing page (create/edit/delete), then on any journey — drag activities from a categorized palette onto a canvas, connect them, edit properties, validate the graph, simulate and test paths, and publish a compiled bundle. Events (and other catalog data) get their own landing page too. The UI is built with **React** and **React Flow** (`@xyflow/react`), with **Zustand** for canvas state, **TanStack Query** over a mock API layer for async data, and **Tailwind CSS** for new UI. Authoring happens entirely in this app; **n8n** is a **planned runtime target** via a compiler (see [n8n in this project](#n8n-in-this-project)).

> **Status: all phases (0–5), the initial backlog, and a follow-up multi-journey/UI pass are implemented.** See [Roadmap / what's built](#roadmap--whats-built) for what shipped in each phase, [Gap analysis](#gap-analysis-known-limitations) for what's still simplified or missing, and [Non-goals](#non-goals) for what's intentionally out of scope. Read those sections before making changes so new work lands in the right place and doesn't quietly re-simplify something that was a deliberate call.

---

## Tech stack

| Layer | Technology |
|--------|------------|
| UI | React 19, TypeScript (strict) |
| Graph / canvas | [@xyflow/react](https://reactflow.dev/) v12 (`ReactFlow`, nodes, edges, viewport, controls, minimap) |
| Global / canvas state | **Zustand** (`src/store/journeyStore.ts`) — nodes/edges/journey name & description/viewport/selection/panel widths/undo-redo/clipboard |
| Server / async state | **TanStack Query** (`src/hooks/queries/useJourneyQueries.ts`) over a mock API (`src/lib/api/mockApi.ts`) — journey load/save/publish, audience/event/template catalogs, test profiles & runs, Journey Fragments, publish history — all still backed by `localStorage`, not a real backend |
| Styling | **Tailwind CSS** (`@tailwindcss/vite`), used for all newer components; coexists with the original hand-written `index.css` for older ones (an intentional incremental migration, not a stray inconsistency) |
| Testing | Vitest + React Testing Library — unit tests for every pure `lib/` module and the store |
| Build | Vite 6, `@vitejs/plugin-react` |
| Lint | ESLint 9, TypeScript ESLint, React Hooks plugin |

---

## Getting started

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

```bash
npm run build   # production build
npm run lint    # ESLint
npm run test    # Vitest (add -- --watch for watch mode)
```

---

## Project layout

```
src/
├── main.tsx                        # React root; QueryClientProvider
├── App.tsx                         # Owns top-level navigation: Journeys list / Events list / editor, one shared AppShell
├── JourneyBuilder.tsx              # Header, toolbar, FlowCanvas: palette | canvas | inspector, all wiring
├── index.css                       # Legacy hand-written styles (coexists with Tailwind)
├── store/
│   └── journeyStore.ts             # Zustand: nodes/edges/meta/selection/undo-redo/clipboard (one journey's canvas at a time)
├── hooks/
│   ├── useNodeValidation.ts        # Per-node messages from context (node outline ok/error)
│   └── queries/
│       └── useJourneyQueries.ts    # TanStack Query hooks over lib/api/mockApi.ts
├── context/
│   └── JourneyValidationContext.tsx # Shares validation result with node components
├── components/
│   ├── shell/
│   │   ├── AppShell.tsx            # Left nav rail (Journeys / Events) + content area, shared by every view
│   │   ├── JourneyEditorHeader.tsx # Back-to-Journeys, name, status, Alerts, Test mode, Delete, properties toggle
│   │   ├── JourneyPropertiesPanel.tsx # Name + description panel
│   │   └── PublishHistoryModal.tsx # Publish history for the journey currently open in the editor
│   ├── journeys/
│   │   └── JourneysListPage.tsx    # Landing page: data grid of every journey, create/edit/delete
│   ├── events/
│   │   └── EventsListPage.tsx      # Events landing page: list first, then create/edit/delete
│   ├── catalogs/
│   │   └── CatalogsPage.tsx        # Audiences + Message templates landing page (two tabs), same list-first pattern
│   ├── palette/
│   │   └── Palette.tsx             # Accordion: Events / Orchestration / Actions / Fragments + search
│   ├── nodes/
│   │   └── journeyNodes.tsx        # Custom React Flow nodes: Entry, Audience, Event, Reaction event, Condition, Wait, Action, End
│   ├── Inspector.tsx               # Selected node property editor (per-kind fields)
│   ├── InspectorLeavePrompt.tsx    # Unsaved-edits / validation-issue prompt on selection change
│   ├── PanelResizeHandle.tsx       # Resize palette / properties panels
│   ├── ExecutionDryRunModal.tsx    # Multi-path animated preview (Simulation banner + Dry run modal)
│   └── TestModeModal.tsx           # Interactive, persisted per-profile test walkthrough
└── lib/
    ├── journeySchema.ts            # Types, JSON parse/serialize + legacy-type migration, JourneyDocument
    ├── journeyValidation.ts        # Rules, reachability, branch/fallback checks, simulation gate
    ├── simulateJourney.ts          # Multi-path DFS walk for Simulation / Dry run
    ├── testModeWalk.ts             # Pure helpers for Test mode's step-by-step walkthrough
    ├── cloneGraph.ts               # Subgraph cloning with fresh ids — shared by copy/paste and Fragments
    ├── publishBundle.ts            # Publish artifact: journey + compiled n8n workflow + compiler warnings
    ├── adapters/n8n.ts             # Journey → n8n workflow JSON compiler
    ├── storage.ts                  # localStorage read/write, file import/export helpers
    ├── panelWidths.ts              # Resizable panel widths persisted locally
    └── api/mockApi.ts              # Mock backend: multi-journey CRUD, catalogs, test profiles/runs, fragments, publish history
```

---

## Main components (roles)

- **`App`** — Owns which top-level view is showing (`journeys` | `events` | `editor`), all inside one shared `AppShell` so the nav rail's active state stays consistent. This is the app's only "router" — there's no URL-based routing library; view state is plain React state.
- **`JourneysListPage`** — The landing page: a data grid of every journey (name, last updated, node/edge counts) with Create/Edit/Delete. Opening or creating a journey hands its id to `JourneyBuilder`.
- **`EventsListPage`** — Same list-first pattern as Journeys: a data grid of events, "+ New event," and click-a-row-to-edit. Not a modal — a full page, consistent with Journeys.
- **`CatalogsPage`** — Audiences and Message templates, each with their own tab and the same list-first-then-create/edit/delete pattern. One page with two tabs rather than two separate nav items, since both are small, closely-related reference-data types.
- **`JourneyBuilder`** — Wraps one journey's editor in `ReactFlowProvider`, given a `journeyId` and an `onBack` callback. Hosts `JourneyEditorHeader`, `JourneyPropertiesPanel`, the secondary authoring toolbar (Clear canvas/Import/Export/Simulation/Dry run/Publish/History/Undo/Redo/Copy/Paste/Save as Fragment), and **`FlowCanvas`**, which owns all canvas rendering and wires the Zustand store to React Flow for that specific journey.
- **`journeyStore`** (Zustand) — `nodes`, `edges`, journey name/description, viewport, selection, panel widths, undo/redo history, and the copy/paste clipboard, for **one journey's canvas at a time**. It's a module-level singleton, so switching journeys re-hydrates it explicitly (guarded by a `journeyId`-keyed ref in `JourneyBuilder`, not the store's own `hydrated` flag) rather than assuming a fresh store per journey.
- **`Palette`** — Four accordion groups (Events, Orchestration, Actions, Fragments) plus a pinned structural "End" item, with a search filter across all of them. Drags use `dataTransfer` with either `application/reactflow` (a single node type) or a dedicated Fragment mime type (a whole saved subgraph). Drops are handled on the React Flow pane (`onDrop`/`onDragOver`).
- **Custom nodes** (`journeyNodes.tsx`) — `EntryNode` (all 4 entry-point kinds), `AudienceNode`, `EventNode`, `EventReactionNode`, `ConditionNode` (dynamic per-branch handles), `WaitNode`, `ActionNode` (all 8 channel kinds), `EndNode`. Each uses **`useNodeValidation`** for valid/invalid styling.
- **`Inspector`** — Edits `data` for the selected node with per-type fields (audience/event catalogs, channel-specific content field, Condition branch editor, Wait duration, Reaction-event kind), plus the shared error/timeout-fallback checkbox.
- **`ExecutionDryRunModal`** — Multi-path animated preview with a path-tab selector, used by both the Simulation banner data and the Dry run modal.
- **`TestModeModal`** — Named, persistent test profiles walked through the journey one branch decision at a time, scoped to the journey currently open; completed runs are saved and shown again next time that profile is tested against that journey.
- **`PublishHistoryModal`** — A history of past publishes of the journey currently open in the editor, opened from the toolbar's "History" button.

---

## Data model

- **`JourneyDocument`** (`lib/journeySchema.ts`): versioned JSON with `meta` (name, description, updatedAt), `nodes` (React Flow nodes with `JourneyNodeData`), `edges`, optional `viewport`.
- **Node types**, by category:
  - **Entry** (exactly one per journey, no incoming edges): `entry-read-audience`, `entry-audience-qualification`, `entry-unitary-event`, `entry-business-event`
  - **Events**: `audience`, `event` (legacy mid-journey placeholders), `event-reaction` (opened/clicked/bounced/unsubscribed)
  - **Orchestration**: `condition` (named branches, one source handle each), `wait` (duration + unit)
  - **Actions**: `action-email`, `action-push`, `action-sms`, `action-inapp`, `action-web`, `action-code`, `action-content-card`, `action-custom`
  - **Structural**: `end`
  - **Deprecated-but-recognized** (migrated on load, never produced by new code): `start` → `entry-unitary-event`, `email` → `action-email`
- **`JourneyNodeData`** fields, by what uses them: `label`/`subtitle` (all), `segmentHint` (audience-based entries + legacy `audience`), `eventKey` (event-based entries + legacy `event`), `branches`/`hasErrorFallback` (Condition), `waitAmount`/`waitUnit` (Wait), `templateName`/`subject`/`messageBody`/`customPayload` (Actions, one field per channel — see `ACTION_DATA_FIELD`), `reactionKind`/`reactsToHint` (Reaction event), `hasErrorFallback` (Condition + all Actions).

The canvas (via the store) is the source of truth while editing; `toDocument()` snapshots it for export, publish, and autosave.

---

## Execution flow (behavior)

1. **Authoring** — From the Journeys landing page, create a new journey or open an existing one (its id is threaded into `JourneyBuilder`/the store). Add nodes via palette drag (single node type or a whole Journey Fragment) or copy/paste (`Ctrl/Cmd+C/V`), connect edges (`onConnect`, `onReconnect`), pan/zoom. Changes autosave (debounced, via a TanStack Query mutation scoped to that journey's id) and commit undo history at each structural edit.
2. **`validateJourney`** (`lib/journeyValidation.ts`) enforces:
   - Exactly one **entry-point** node, with **no incoming edges**
   - Exactly one **End** node
   - Unique non-empty **labels**
   - Required fields per node kind (audience/event/channel content/wait duration/branch connectivity/reaction kind)
   - Every Condition branch has an outgoing connection; no edge references a since-removed branch
   - The error/timeout fallback, once enabled, is connected
   - All nodes **reachable** from the entry point
   - **`simulateJourney`** must complete (every path reaches End; no true cycles) once there's exactly one entry point and one End node
3. **`simulateJourney`** (`lib/simulateJourney.ts`) — DFS from the entry point, walking **every** branch (not just the first), returning one `SimulationPath` per route to End. Detects true cycles (a node revisited within the same path) without flagging legitimate reconvergence (two branches landing back on a shared downstream node).
4. **Three testing modes**:
   - **Simulation** — the inline banner version of the above: ephemeral, every branch, nothing saved.
   - **Dry run** — the same walk in `ExecutionDryRunModal` with an animated, tabbed multi-path preview; framed as "production-shaped data, no real sends."
   - **Test mode** — a named, persistent profile walked one step at a time in `TestModeModal`, scoped to the journey currently open; a person picks the branch by hand at each Condition (there's no rule-expression engine behind branch names), and the completed run is saved for that profile against that journey.
5. **Export** — Downloads journey JSON (`serializeJourney`), gated on full validity.
6. **Publish** — Compiles the journey to an n8n workflow shape (`lib/adapters/n8n.ts`) and downloads a bundle containing the journey, the compiled workflow, and a list of compiler caveats; also records a lightweight entry in that journey's publish history (viewable via the toolbar's "History" button).
7. **Autosave** — Debounced, via `useSaveJourneyMutation(journeyId)`, persisted to `localStorage` under that journey's own key (see [Local storage keys](#local-storage-keys)) and reflected back into the Journeys landing page's list (name/updated-at/counts).

---

## n8n in this project

**n8n is not installed or executed by this app.** It's modeled as a **future deployment/runtime**:

- **`lib/adapters/n8n.ts`** — `journeyToN8nWorkflow(journey)` compiles a `JourneyDocument` into an n8n-shaped workflow: entry points become `webhook`/`scheduleTrigger` nodes, Condition becomes a `switch` node with one output per branch, Wait becomes a `wait` node, Actions become `emailSend`/`httpRequest` nodes, End becomes a `noOp`. Connections are built from the real edge graph, including a second output port for the error/timeout fallback handle.
- This is a **best-effort structural scaffold, not a verified n8n import** — the compiler returns a `warnings` array (surfaced in the publish bundle as `compilerWarnings`) stating plainly that: named Condition branches aren't evaluated rule conditions, the error/timeout fallback isn't wired to n8n's real error-output mechanism, and credentials/parameters need review before activating.
- **`lib/publishBundle.ts`** — Publish builds a JSON bundle containing the full `journey` document, the compiled `n8nWorkflow`, and `compilerWarnings`.

So: **authoring** = this UI; **running in production** = envisioned as importing the published bundle into n8n (or similar) once a person reviews and finishes the compiled workflow — not using n8n's own visual editor as the source of truth.

---

## Local storage keys

| Key | Purpose |
|-----|--------|
| `journey-builder:journeys-index` | Lightweight summary list (name/updatedAt/counts) for the Journeys landing page's data grid |
| `journey-builder:journey:<id>` | One key per journey, holding its full document |
| `journey-builder:last` | Legacy single-journey key — no longer written by new code, but read once (and migrated into the index above) if `journeys-index` doesn't exist yet, so upgrading doesn't silently lose whatever was being worked on |
| `journey-builder:palette-width` | Palette panel width |
| `journey-builder:inspector-width` | Properties panel width |
| `journey-builder:test-runs` | Saved Test mode runs, keyed by journey id + profile |
| `journey-builder:fragments` | Saved Journey Fragments |
| `journey-builder:publish-history` | Publish history records, each tagged with the journey id it belongs to |
| `journey-builder:events` | User-created events catalog |
| `journey-builder:audiences` | User-created audiences catalog |
| `journey-builder:templates` | User-created message templates catalog |

---

## Product direction: the journey-orchestration model this app follows

This app's design follows patterns common across customer-journey orchestration tools generally (the kind of product category that includes visual journey/flow builders for marketing and lifecycle messaging): a canvas-based journey has a **Create** step (name/description up front), a **Design** step (a categorized palette, one entry point, branching/wait orchestration, and channel actions), a **Test** step (multiple distinct validation modes before anything goes live), and a **Publish** step (blocked on validation errors). The sections below describe how this app implements each of those, and where it simplifies.

### Entry-point model

Exactly one entry point per journey, with no incoming edges:

| Entry kind | Behavior | Palette group |
|---|---|---|
| Read Audience | Batch audience, scheduled or one-shot | Orchestration |
| Audience Qualification | Real-time, profile enters/exits a streaming audience | Events |
| Unitary event | Real-time, one profile per trigger | Events |
| Business event | Non-profile event fanning out to many profiles | Events |

Read Audience sits under **Orchestration** rather than Events: a scheduled/batch audience pull behaves like an orchestration step (alongside Condition and Wait) rather than an inbound signal, which is also why the Orchestration group has exactly 3 items (Read Audience, Condition, Wait).

### Palette categories

- **Events** — entry + mid-journey signals: Unitary Event, Business Event, Audience Qualification, Reaction event, plus two legacy generic `audience`/`event` placeholder nodes kept for backward compatibility with this app's earliest version (they don't correspond to a specific modeled activity the way the others do).
- **Orchestration** — Read Audience, Condition (named branches), Wait (duration).
- **Actions** — all 8 channels: Email, Push, SMS, In-app, Web, Code-based experience, Content card, Custom action.
- **Fragments** — a separate, dynamically-populated group for saved Journey Fragments (see Backlog below), listed alongside but structurally distinct from the three built-in categories.

`End` is structural, not a palette concept in this model, so it's pinned in its own small "Canvas" section rather than folded into any category.

### Layout

- **Left nav rail** (`AppShell`) — three destinations, all real landing pages: "Journeys" (a data grid of every journey — see `JourneysListPage`), "Events" (a list-then-create/edit/delete catalog page — see `EventsListPage`), and "Catalogs" (Audiences + Message templates, two tabs — see `CatalogsPage`). This app builds journeys and manages the catalog data they reference, and nothing else, so there's no reason to build out placeholder nav sections for capabilities that don't exist yet.
- **Journey editor header** (`JourneyEditorHeader`) — a working Back button (returns to the Journeys landing page), name, Draft/Version/saved status, Alerts (wired to real validation output), Test mode, Delete, and a properties-panel toggle. "Manage access" is an intentionally disabled stub — there's no multi-user/permissions model in this authoring tool.
- **Secondary toolbar** — the authoring conveniences that aren't part of the header concept above: Clear canvas/Import/Export, Simulation/Dry run/Publish/History, Undo/Redo, Copy/Paste/Save as Fragment. Every button pairs an icon with its label. No dedicated zoom controls here — React Flow's own `<Controls>` (bottom-left of the canvas) already covers zoom in/out/fit-view, so a second zoom control in the toolbar was redundant.

---

## Gap analysis: known limitations

Honest status of every area this app's design touches, so nothing reads as more finished than it is.

| Area | What exists | Known limitation |
|---|---|---|
| Journey properties | Name + description via `JourneyPropertiesPanel` | No priority/frequency-capping-style settings |
| Entry points | All 4 kinds modeled, with per-kind Inspector fields and validation | — |
| Orchestration | Condition (named branches) + Wait (duration); `simulateJourney` walks every branch | Journey Fragments are a separate reusable-bundle mechanism, not an orchestration node type — see Backlog |
| Actions / channels | All 8 channel types, with per-kind Inspector forms and validation | Each channel collects one content field (`templateName`/`messageBody`/`customPayload`) rather than a full real per-channel schema (e.g. no rich Push title+body+deep-link split, no real code editor for Code-based experiences) |
| Palette organization | 3 categories (Events/Orchestration/Actions) + a dynamic Fragments group | — |
| Validation | Entry-point, branch-connectivity, Wait-field, fallback-connectivity, and per-channel required-field rules | No cross-field or semantic validation beyond "is this required field non-empty" |
| Testing | 3 distinct modes: Simulation, Test mode, Dry run | Test mode's branch resolution is manual (a person clicks the path) since Condition branches are named, not rule-expressions — there's nothing to evaluate a profile against automatically |
| Publish | Compiles a real (best-effort) n8n workflow structurally; publish history view | Nothing "goes live" — there's no execution backend, real or mock, for a published journey to actually run against |
| Reporting | — | Not built, and not faked — see Non-goals |
| Data model | Events, Audiences, and Message templates are all real, persisted, user-manageable catalogs with create/edit/delete (`EventsListPage`, `CatalogsPage`) | No real typed *reference* for any of them — a node stores a catalog entry's *name* as free text, not a link to its id, so renaming an entry doesn't update journeys that already reference the old name. Event id type and Timeout fields on Events are captured but not used by validation/simulation yet. |
| Journey Fragments | Save-selection-as-fragment, browse/drag from palette, insert with fresh ids | No rename/edit of a saved fragment after creation (delete only) |
| Reaction events | Modeled with a reaction kind (opened/clicked/bounced/unsubscribed) | No structural link to the specific prior Action node it reacts to — only a free-text hint |
| State management | Zustand store with undo/redo, copy/paste clipboard | Undo/redo covers structural edits and Inspector save/close, not every keystroke while a field is focused |
| Async data | TanStack Query + mock API layer throughout | Backed by `localStorage`, not a real backend |
| Styling system | Tailwind used for all newer components | Coexists with the original hand-written CSS for older ones rather than having fully replaced it |
| Multi-journey support | ✅ Real: a data grid (`JourneysListPage`) lists every journey, each with its own full document under its own `localStorage` key; create/edit/delete all work; navigation persists across refresh via a hash-based URL (`lib/route.ts`) | No search/filter/sort/pagination on the grid yet; no folders or tags |

---

## Roadmap / what's built

Built in phases so each one shipped something usable; architecture work came first because branching, new node types, and async data all get much harder to retrofit later. Every phase below is verified with `npx tsc -b`, `npm run build`, `npm run lint`, and `npm run test` passing clean at the time it shipped.

### Phase 0 — Foundations
Added Tailwind CSS (coexisting with the original CSS), a Zustand store (`journeyStore.ts`) replacing the old `useState`/`useNodesState`/`useEdgesState` cluster, TanStack Query + a mock API module (`fetchJourney`/`saveJourney`/`publishJourney`/catalog endpoints), autosave moved to a debounced mutation, Vitest + React Testing Library, and undo/redo scoped to structural edits (add/delete/connect/reconnect, and one commit per Inspector save/close — not per keystroke).

### Phase 1 — Journey properties, entry points, shell layout
Added the Journey Properties panel (name + description); extended `JourneyNodeType` with the four entry-point kinds (`entry-read-audience`, `entry-audience-qualification`, `entry-unitary-event`, `entry-business-event`), with the old `"start"` literal migrated automatically on load; validation now requires exactly one entry point with no incoming edges; built `AppShell`, `JourneyEditorHeader`, and the first version of the accordion `Palette`.

Known scope calls made here: palette item counts were small since few node types existed yet; the header's "Back" arrow and "Manage access" were visual-only stubs; entry-node icons/colors were a first pass.

### Phase 2 — Orchestration primitives (branching)
Added the Condition node type with configurable named branches (each its own source handle — renaming/removing a branch in the Inspector keeps connected edges in sync rather than orphaning them), rewrote `simulateJourney` from "follow the first edge" to a full multi-path DFS (the single highest-value gap at the time), added the Wait node (duration + unit), and added the error/timeout-fallback checkbox on Condition and Email.

Mid-phase correction, made after closer research into how comparable products categorize these activities: Read Audience moved from the Events palette group to Orchestration, since a batch/scheduled audience read behaves like an orchestration step rather than an inbound signal. Also clarified that "Jump to another journey" (originally planned for this phase) isn't the right shape for reusable content — that became the separate Journey Fragments backlog item instead of being bolted onto Condition/Wait.

### Phase 3 — Channel actions
Generalized the single `email` node into 8 Action types (`action-email`, `action-push`, `action-sms`, `action-inapp`, `action-web`, `action-code`, `action-content-card`, `action-custom`), each mapped to one of three shared data fields (`ACTION_DATA_FIELD`: `templateName`, `messageBody`, or `customPayload`) rather than a bespoke field per channel — Email additionally keeps its own `subject` field. One `ActionNode` component renders all eight kinds. `"email"` is kept as a deprecated-but-recognized literal, migrated to `"action-email"` on load — this phase caught and fixed a real gap where the validator's action-field and fallback-connectivity checks needed to treat a raw pre-migration `"email"` node the same as `"action-email"`, not just the rendering/Inspector layers (see `asActionType()` in `journeyValidation.ts`).

### Phase 4 — Testing modes
Split the single dry-run flow into three distinct modes: **Simulation** (the existing ephemeral, every-branch walk, relabeled and reframed explicitly), **Test mode** (new — named, persistent test profiles walked one branch decision at a time in `TestModeModal`, with completed runs saved and shown again next time), and **Dry run** (same multi-path modal, reframed as "production-shaped data, no sends"). The header's "Test mode" button, a disabled stub since Phase 1, was wired up here.

Stated plainly: Test mode's branch resolution is manual because this app's Condition nodes have named branches with no rule-expression logic behind them — there's nothing to evaluate a profile's attributes against, so a person decides the branch by hand and that decision is what gets persisted.

### Phase 5 — Publish & monitoring
Replaced the Phase 0 n8n stub (which always emitted empty `nodes`/`connections`) with a real structural compiler now that node types had stabilized across Phases 1–3 (see [n8n in this project](#n8n-in-this-project)), and added a publish-history view.

Scope correction, stated directly: the original plan called for "a minimal journey list." This app remained single-journey — giving it real multi-journey CRUD would mean threading a journey id through the store, the query hooks, and the editor that the previous four phases were built around, a materially bigger change than a Phase 5 add-on. What shipped instead is a **publish history** view (structural facts — node/edge counts, compiler-warning count — not fabricated business metrics), labeled as exactly that rather than implying multi-journey support that doesn't exist. A reporting placeholder was considered and deliberately not built, for the same reason: inventing numbers like "1,234 emails sent" would look like real functionality with nothing behind it.

**Superseded below** — real multi-journey CRUD was explicitly requested afterward and built; see "Post-request: multi-journey support, Events landing page, and UI polish."

### Backlog — all three items addressed
- **Journey Fragments** — a reusable node/edge library. "Save as Fragment" extracts the current canvas selection (`lib/cloneGraph.ts`), persists it via the mock API, and a Fragments palette group lists them for drag-and-drop insertion (fresh ids, dropped near the cursor). Entry-point nodes are excluded from extraction, since duplicating one would immediately break the single-entry-point rule.
- **Node copy/paste** — `Ctrl/Cmd+C/V` plus toolbar buttons, built on the same subgraph-cloning helper as Journey Fragments so both features share one tested implementation rather than two.
- **Reaction events** — a new `event-reaction` node type for opened/clicked/bounced/unsubscribed engagement signals, with a stated limitation: there's no structural link to the specific prior Action node it reacts to, only a free-text note.

### Post-backlog: Events catalog management
The nav rail's "Journeys" item had no counterpart for managing the catalog data journeys reference. Added an **Events** nav item opening `EventsManagerModal`, backed by a real (if `localStorage`-only) persisted catalog with full create/edit/delete — the first catalog type to move off the static mock-list pattern that Audiences and Message templates still use. A real bug surfaced and was fixed while adding this: the mock API's "no events saved yet" fallback returned the shared default-events constant *by reference* rather than a copy, so the first `createEvent` call would silently mutate that shared constant instead of the intended list — caught by a new test (`mockApi.test.ts`) before it shipped, not after.

Revised after feedback that the first pass's modal was too cramped (a 3-input inline row overflowed a 420px-wide modal): widened it (`.exec-modal--wide`) and expanded the event record itself — Label, Description, Type (Unitary/Business), Event id type (System generated/Custom), a Timeout section (checkbox + conditional duration), plus read-only Author/Created metadata — modeled on the layout common to event-configuration panels in journey-orchestration tools generally, not just a name+description pair. Existing events are now editable in place (click a row to open its form), not just deletable.

Known limitations, stated directly:
- An event-based node stores an event's *name* as free text, not a reference to its catalog id — renaming an event won't update nodes that already reference the old name.
- "Author" is a fixed placeholder ("You") — there's no real identity system in this single-user tool, so it's a display field for layout fidelity, not a real feature.
- "Event id type" and the Timeout fields are captured and persisted but not wired into validation or simulation anywhere yet — they exist because the reference layout has them, not because journey behavior currently depends on them.

Audiences and Message templates followed the same real-catalog-with-edit pattern shortly after — see "Post-request: multi-journey support, Events landing page, and UI polish" → item 3 below.

### Post-request: multi-journey support, Events landing page, and UI polish

Four changes requested together, addressed as one pass since they touch the same navigation/layout surface:

1. **Real multi-journey CRUD.** This reverses the Phase 5 scope correction above — that decision was right for what was known at the time, and this supersedes it now that it was explicitly requested. `mockApi.ts` moved from one document under a fixed key to a real collection: each journey's full document lives under its own key (`journey-builder:journey:<id>`), plus a lightweight index (`journey-builder:journeys-index`) for the list page so it doesn't have to load every document just to show a grid. **`JourneysListPage`** is the new landing page (data grid: name, last updated, node/edge counts, Edit/Delete). A **migration** runs once on first read: if the old single-journey key has data but the new index doesn't exist yet, that journey is adopted as the first entry rather than silently discarded — covered by dedicated tests, including one confirming it doesn't run twice and duplicate the journey. Test mode runs and publish history are now genuinely scoped per journey id (they always accepted a journey-key parameter; it was previously a hardcoded constant standing in for "the one journey," now it's a real id).
2. **Events also became a landing page, not a modal** (`EventsListPage`), for the same list-first-then-create/edit/delete pattern as Journeys — consistent navigation model across both catalog types. `AppShell` now owns navigation between three views (Journeys list / Events list / one journey's editor) as plain React state in `App.tsx`, not a router library; the old `EventsManagerModal` was removed.
3. **Toolbar buttons got icons + labels**, and the **separate zoom control was removed** from the toolbar — React Flow's own `<Controls>` (bottom-left of the canvas) already provides zoom in/out/fit-view, so a second one in the toolbar was redundant, not an intentional two-tier zoom design.
4. **Canvas nodes were rendering oversized.** The actual CSS-defined node size (`.journey-node`, ~120px wide) wasn't the problem; `fitView`'s default behavior zooms in as far as `maxZoom` allows to fill the viewport, and with only one or two small nodes on an empty canvas it was zooming in close to the 2.5x ceiling — a real node rendering ~300px on screen. Fixed by capping the *initial fit's* zoom specifically (`fitViewOptions={{ maxZoom: 1 }}`) rather than lowering the canvas's overall `maxZoom`, which would have made intentional zooming-in less useful. Node CSS was also trimmed modestly (smaller padding/font) for a denser look independent of the zoom fix.

---

## Remaining work (prioritized)

Everything below is also reflected in the Gap analysis table above; this is the same list turned into an actionable, ordered checklist so it's clear what's being worked on next rather than just "known to be incomplete." Checked off as each ships, with a note on how — not silently marked done.

1. [x] **URL/refresh persistence for navigation.** Fixed: `lib/route.ts` reads/writes `window.location.hash` (`#/journeys`, `#/events`, `#/journey/<id>`) — no routing library, just `App.tsx` syncing state to `history.pushState` and listening for `hashchange` (covers back/forward too). Refreshing, bookmarking, or sharing a journey's URL now reopens that exact journey instead of dropping back to the list. 10 new tests in `route.test.ts` for the parse/serialize round-trip, including malformed-hash fallback.
2. [x] **Clarify "New" vs. "+ New journey."** Fixed, and a real bug came with it: the toolbar button was renamed **"Clear canvas"** (resets *this* journey's canvas to a blank entry node — same underlying action as before, just honestly labeled) with a tooltip explicitly contrasting it with the landing page's "+ New journey." While fixing this, found that the header's **"Delete" button didn't actually delete anything** — it silently called the same clear-canvas action, so "Delete" and the old "New" were the exact same operation under two different labels. Now Delete calls `useDeleteJourneyMutation` for real, removes the journey from the collection, and navigates back to the Journeys list — distinct from Clear canvas in both label and behavior, not just label.
3. [x] **Audiences and Message templates as real catalogs.** Fixed: both now follow the exact Events pattern — persisted (`journey-builder:audiences` / `journey-builder:templates`), with real create/edit/delete. They share one **Catalogs** landing page (`CatalogsPage`, two tabs) rather than getting their own nav items each, since splitting two small, closely-related reference-data types into separate top-level destinations would clutter the rail. Kept intentionally simpler than Events: Audiences are just Label + Description (no invented "audience size" or membership-rule fields), and Templates add one genuinely meaningful field — Channel, reusing the real `ActionNodeType` union rather than a parallel enum. 12 new tests.
4. [ ] **Search/filter/sort/pagination on the Journeys and Events grids.** Fine at the current scale (a handful of rows); would matter once either list grows.
5. [ ] **Catalog → node linkage by id, not name.** A node stores a catalog entry's *name* as free text (events, audiences, templates alike); renaming an entry in its catalog doesn't update journeys that already reference the old name.
6. [ ] **Richer per-channel Action schemas.** Each of the 8 channels collects one generic content field; real per-channel config (Push title+body+deep-link, a real code editor for Code-based experiences, etc.) is deeper than this app models today.
7. [ ] **Journey Fragment rename/edit after creation** (currently delete-only).
8. [ ] **Reaction-event structural linkage** to the specific prior Action node it reacts to (currently a free-text note only).

Lower priority / larger architectural lifts, not next in line but tracked:
- Test mode's automatic branch resolution (would require a real rule-expression engine behind Condition branches, not just names)
- An execution backend for published journeys (nothing "goes live" today)
- Full reporting/analytics (see [Non-goals](#non-goals) — deliberately not faked in the meantime)

---

## Non-goals

Things this app deliberately does **not** do, so they don't get mistaken for oversights:

- **A real execution/runtime backend.** Nothing "goes live" — Publish compiles a structural n8n workflow and downloads it; nothing here calls n8n or any other runtime. See [n8n in this project](#n8n-in-this-project).
- **Fabricated reporting/analytics.** No "emails sent," "open rate," or similar business metrics anywhere. Publish history shows only structural facts (node/edge counts, compiler-warning count) that the app can actually vouch for.
- **A rule-expression engine for Condition branches.** Branches are named, not evaluated against profile attributes — Test mode's branch resolution is intentionally manual (a person picks the path) rather than simulating a fake evaluator.
- **Multi-user / permissions.** This is a single-user authoring tool. "Manage access" in the journey header is an intentionally disabled stub, and Event "Author" is a fixed placeholder, not a real identity system.
- **A routing library.** Navigation (`journeys` / `events` / `editor` views, plus which journey is open) is plain React state in `App.tsx`, synced to `window.location.hash` by `lib/route.ts` for refresh/back-forward support — not React Router or similar.
- **Real n8n installation or execution.** The n8n adapter is a best-effort structural compiler only; nothing in this repo installs, imports into, or talks to an n8n instance.

---