import { useMemo, useState, type DragEvent } from "react";
import type { JourneyNodeType } from "@/lib/journeySchema";
import { ENTRY_NODE_LABELS, ENTRY_NODE_TYPES } from "@/lib/journeySchema";

type PaletteItem = {
  type: JourneyNodeType;
  label: string;
  subtitle: string;
  icon: string;
};

/**
 * Per README → "UI layout reference (target)" → palette section: only two
 * accordion groups for now, Events and Actions. Orchestration (Condition /
 * Wait / Jump) stays a Phase 2 roadmap item and deliberately has no empty
 * accordion group here yet — there's nothing to put in it until those node
 * types exist.
 *
 * "End" is structural (like the removed "Start"), not a palette concept in
 * AJO's own model, so it's listed separately below the two accordions
 * rather than folded into either category.
 */
const EVENTS_ITEMS: PaletteItem[] = [
  ...ENTRY_NODE_TYPES.map((type) => ({
    type,
    label: ENTRY_NODE_LABELS[type].label,
    subtitle: ENTRY_NODE_LABELS[type].subtitle,
    icon:
      type === "entry-unitary-event"
        ? "🌐"
        : type === "entry-business-event"
          ? "📣"
          : type === "entry-audience-qualification"
            ? "🎯"
            : "👥",
  })),
  {
    type: "audience",
    label: "Audience",
    subtitle: "Mid-journey audience check",
    icon: "👥",
  },
  {
    type: "event",
    label: "Event",
    subtitle: "Mid-journey event signal",
    icon: "⚡",
  },
];

const ACTIONS_ITEMS: PaletteItem[] = [
  { type: "email", label: "Email", subtitle: "Send an email", icon: "✉️" },
];

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

type Props = {
  width: number;
};

export function Palette({ width }: Props) {
  const [query, setQuery] = useState("");

  const { events, actions } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (item: PaletteItem) =>
      !q ||
      item.label.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q);
    return {
      events: EVENTS_ITEMS.filter(matches),
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
        <AccordionSection title="Actions" items={actions} defaultOpen />
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
