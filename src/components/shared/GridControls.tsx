import type { SortState } from "@/lib/listControls";

type SortableHeaderProps<TColumn extends string> = {
  column: TColumn;
  label: string;
  sort: SortState<TColumn>;
  onToggle: (column: TColumn) => void;
  align?: "left" | "right";
  className?: string;
};

/**
 * A `<th>` that toggles sort on click (asc -> desc -> unsorted) and shows a
 * caret for whichever direction is active. Shared by JourneysListPage and
 * EventsListPage so both grids get identical sort affordances/behavior.
 */
export function SortableHeader<TColumn extends string>({
  column,
  label,
  sort,
  onToggle,
  align = "left",
  className = "",
}: SortableHeaderProps<TColumn>) {
  const isActive = sort?.column === column;
  const caret = isActive ? (sort!.direction === "asc" ? "▲" : "▼") : "";
  return (
    <th className={`px-4 py-2.5 ${className}`}>
      <button
        type="button"
        onClick={() => onToggle(column)}
        aria-sort={
          isActive
            ? sort!.direction === "asc"
              ? "ascending"
              : "descending"
            : "none"
        }
        className={`flex items-center gap-1 font-semibold uppercase tracking-wide hover:text-slate-800 ${
          align === "right" ? "ml-auto flex-row-reverse" : ""
        } ${isActive ? "text-slate-800" : "text-slate-500"}`}
      >
        {label}
        <span className="w-2.5 text-[9px] leading-none text-slate-400">
          {caret}
        </span>
      </button>
    </th>
  );
}

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

/** The search box shown above a grid, next to its "+ New ..." button. */
export function GridSearchInput({
  value,
  onChange,
  placeholder = "Search…",
}: SearchInputProps) {
  return (
    <div className="relative w-full max-w-xs">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 pl-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
      >
        🔍
      </span>
    </div>
  );
}

type PaginationFooterProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalCount: number;
  filteredCount: number;
  itemLabel: string;
};

/**
 * Footer row shown under a grid's `<table>`: an "N of M items" summary plus
 * Previous/Next controls, only rendered when there's more than one page.
 */
export function PaginationFooter({
  page,
  totalPages,
  onPageChange,
  totalCount,
  filteredCount,
  itemLabel,
}: PaginationFooterProps) {
  if (totalCount === 0) return null;
  const isFiltered = filteredCount !== totalCount;
  return (
    <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
      <span>
        {isFiltered
          ? `${filteredCount} of ${totalCount} ${itemLabel}`
          : `${totalCount} ${itemLabel}`}
      </span>
      {totalPages > 1 ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="rounded border border-slate-300 px-2 py-1 font-medium text-slate-600 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="rounded border border-slate-300 px-2 py-1 font-medium text-slate-600 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
