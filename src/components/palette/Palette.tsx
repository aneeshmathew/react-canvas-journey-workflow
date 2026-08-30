import { useMemo, useState, type DragEvent } from "react";
import type { JourneyNodeType } from "@/lib/journeySchema";
import { ACTION_NODE_LABELS, ACTION_NODE_TYPES, ENTRY_NODE_LABELS } from "@/lib/journeySchema";
import {
  useDeleteFragmentMutation,
  useFragmentsQuery,
} from "@/hooks/queries/useJourneyQueries";

/** dataTransfer key used to distinguish "drop a Journey Fragment" from "drop a single node type" in `JourneyBuilder.onDrop`. */
export const FRAGMENT_DRAG_MIME = "application/journey-fragment";

type PaletteItem = {
  type: JourneyNodeType;
  label: string;
  subtitle: string;
  icon: string;
};

/**
 * Per README → "UI layout reference (target)" → palette section, corrected
 * against Adobe's "Design your journey" doc: Read Audience is actually an
 * **Orchestration** activity in AJO, not an Events one — the doc's own
 * screenshot shows "ORCHESTRATION (3)", which lines up with exactly three
 * items once Condition and Wait exist: Read Audience, Condition, Wait.
 * (An earlier pass here had Read Audience under Events — that was wrong
 * and is fixed by this grouping.)
 */
const EVENTS_ITEMS: PaletteItem[] = [
  {
    type: "entry-unitary-event",
    label: ENTRY_NODE_LABELS["entry-unitary-event"].label,
    subtitle: ENTRY_NODE_LABELS["entry-unitary-event"].subtitle,
    icon: "🌐",
  },
  {
    type: "entry-business-event",
    label: ENTRY_NODE_LABELS["entry-business-event"].label,
    subtitle: ENTRY_NODE_LABELS["entry-business-event"].subtitle,
    icon: "📣",
  },
  {
    type: "entry-audience-qualification",
    label: ENTRY_NODE_LABELS["entry-audience-qualification"].label,
    subtitle: ENTRY_NODE_LABELS["entry-audience-qualification"].subtitle,
    icon: "🎯",
  },
  {
    type: "audience",
    label: "Audience",
    subtitle: "Mid-journey audience check (legacy — not a real AJO activity)",
    icon: "👥",
  },
  {
    type: "event",
    label: "Event",
    subtitle: "Mid-journey event signal",
    icon: "⚡",
  },
  {
    type: "event-reaction",
    label: "Reaction event",
    subtitle: "Opened / clicked / bounced / unsubscribed",
    icon: "👆",
  },
];

const ORCHESTRATION_ITEMS: PaletteItem[] = [
  {
    type: "entry-read-audience",
    label: ENTRY_NODE_LABELS["entry-read-audience"].label,
    subtitle: ENTRY_NODE_LABELS["entry-read-audience"].subtitle,
    icon: "👥",
  },
  {
    type: "condition",
    label: "Condition",
    subtitle: "Branch the journey",
    icon: "🔀",
  },
  {
    type: "wait",
    label: "Wait",
    subtitle: "Pause before continuing",
    icon: "⏱",
  },
];

const ACTIONS_ITEMS: PaletteItem[] = ACTION_NODE_TYPES.map((type) => ({
  type,
  label: ACTION_NODE_LABELS[type].label,
  subtitle: ACTION_NODE_LABELS[type].subtitle,
  icon: ACTION_NODE_LABELS[type].icon,
}));

const STRUCTURAL_ITEMS: PaletteItem[] = [
  { type: "end", label: "End", subtitle: "Journey exit", icon: "🏁" },
];

function onDragStart(ev: DragEvent, nodeType: JourneyNodeType) {
  ev.dataTransfer.setData("application/reactflow", nodeType);
  ev.dataTransfer.effectAllowed = "move";
}

function DraggableItem({ item }: { item: PaletteItem }) {
  return (
    <div
      className="flex cursor-grab items-start gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs shadow-sm hover:border-slate-300 active:cursor-grabbing"
      data-kind={item.type}
      draggable
      onDragStart={(e) => onDragStart(e, item.type)}
    >
      <span aria-hidden="true" className="mt-0.5 text-sm leading-none">
        {item.icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium text-slate-800">
          {item.label}
        </span>
        <span className="block truncate text-[11px] text-slate-500">
          {item.subtitle}
        </span>
      </span>
    </div>
  );
}

function AccordionSection({
  title,
  items,
  defaultOpen,
}: {
  title: string;
  items: PaletteItem[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-200 py-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-1 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
      >
        <span>
          {title} ({items.length})
        </span>
        <span aria-hidden="true" className="text-slate-400">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? (
        <div className="mt-1.5 flex flex-col gap-1.5 px-0.5">
          {items.length === 0 ? (
            <p className="px-1 py-1 text-[11px] text-slate-400">
              No matches.
            </p>
          ) : (
            items.map((item) => <DraggableItem key={item.type} item={item} />)
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Journey Fragments (see README → Backlog): a small, reusable library of
 * node/edge bundles saved from a canvas selection. Dragging one onto the
 * canvas inserts a full copy (fresh ids, dropped near the cursor) rather
 * than a single node — handled in `JourneyBuilder.onDrop` by checking for
 * `FRAGMENT_DRAG_MIME` before falling back to the single-node-type path.
 */
function FragmentsAccordionSection({ query }: { query: string }) {
  const [open, setOpen] = useState(true);
  const fragmentsQuery = useFragmentsQuery();
  const deleteFragment = useDeleteFragmentMutation();

  const q = query.trim().toLowerCase();
  const fragments = (fragmentsQuery.data ?? []).filter(
    (f) =>
      !q ||
      f.name.toLowerCase().includes(q) ||
      (f.description ?? "").toLowerCase().includes(q),
  );

  return (
    <div className="border-b border-slate-200 py-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-1 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
      >
        <span>Fragments ({fragments.length})</span>
        <span aria-hidden="true" className="text-slate-400">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? (
        <div className="mt-1.5 flex flex-col gap-1.5 px-0.5">
          {fragmentsQuery.isPending ? (
            <p className="px-1 py-1 text-[11px] text-slate-400">Loading…</p>
          ) : null}
          {!fragmentsQuery.isPending && fragments.length === 0 ? (
            <p className="px-1 py-1 text-[11px] text-slate-400">
              None yet — select nodes on the canvas and use "Save as
              Fragment" in the toolbar.
            </p>
          ) : null}
          {fragments.map((f) => (
            <div
              key={f.id}
              className="flex items-start gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs shadow-sm hover:border-slate-300"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(FRAGMENT_DRAG_MIME, f.id);
                e.dataTransfer.effectAllowed = "move";
              }}
            >
              <span
                aria-hidden="true"
                className="mt-0.5 cursor-grab text-sm leading-none active:cursor-grabbing"
              >
                🧩
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-slate-800">
                  {f.name}
                </span>
                <span className="block truncate text-[11px] text-slate-500">
                  {f.nodes.length} node{f.nodes.length === 1 ? "" : "s"}
                  {f.description ? ` · ${f.description}` : ""}
                </span>
              </span>
              <button
                type="button"
                aria-label={`Delete fragment ${f.name}`}
                title="Delete fragment"
                className="flex-shrink-0 text-slate-300 hover:text-red-500"
                onClick={() => deleteFragment.mutate(f.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type Props = {
  width: number;
};

export function Palette({ width }: Props) {
  const [query, setQuery] = useState("");

  const { events, orchestration, actions } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (item: PaletteItem) =>
      !q ||
      item.label.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q);
    return {
      events: EVENTS_ITEMS.filter(matches),
      orchestration: ORCHESTRATION_ITEMS.filter(matches),
      actions: ACTIONS_ITEMS.filter(matches),
    };
  }, [query]);

  return (
    <aside
      className="flex flex-shrink-0 flex-col gap-2 border-r border-slate-200 bg-white p-3"
      style={{ width }}
    >
      <div className="flex items-center gap-1.5 rounded-md border border-slate-300 px-2 py-1.5">
        <span aria-hidden="true" className="text-slate-400">
          🔍
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          aria-label="Search palette"
          className="w-full min-w-0 border-none bg-transparent text-xs text-slate-800 focus:outline-none"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AccordionSection title="Events" items={events} defaultOpen />
        <AccordionSection
          title="Orchestration"
          items={orchestration}
          defaultOpen
        />
        <AccordionSection title="Actions" items={actions} defaultOpen />
        <FragmentsAccordionSection query={query} />
        <div className="pt-2">
          <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Canvas
          </p>
          <div className="flex flex-col gap-1.5 px-0.5">
            {STRUCTURAL_ITEMS.map((item) => (
              <DraggableItem key={item.type} item={item} />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
