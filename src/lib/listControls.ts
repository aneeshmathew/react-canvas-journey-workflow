// Pure, generic helpers behind search/sort/pagination on the Journeys and
// Events data grids (README → Remaining work, item 4). Kept as plain
// functions — not hook-coupled — so they're unit-testable the same way every
// other `lib/` module is, and reusable by both grids (and any future one)
// without duplicating the logic.

export type SortDirection = "asc" | "desc";

export type SortState<TColumn extends string> = {
  column: TColumn;
  direction: SortDirection;
} | null;

/** Case-insensitive substring match across one or more text fields per item. */
export function filterBySearch<T>(
  items: T[],
  query: string,
  getSearchableText: (item: T) => Array<string | undefined>,
): T[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return items;
  return items.filter((item) =>
    getSearchableText(item).some((text) =>
      (text ?? "").toLowerCase().includes(trimmed),
    ),
  );
}

/** Stable sort (ties keep their relative order) by one column at a time. */
export function sortItems<T, TColumn extends string>(
  items: T[],
  sort: SortState<TColumn>,
  getSortValue: (item: T, column: TColumn) => string | number,
): T[] {
  if (!sort) return items;
  const { column, direction } = sort;
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const av = getSortValue(a.item, column);
      const bv = getSortValue(b.item, column);
      let cmp = 0;
      if (av < bv) cmp = -1;
      else if (av > bv) cmp = 1;
      if (cmp === 0) return a.index - b.index; // stable tie-break
      return direction === "asc" ? cmp : -cmp;
    })
    .map(({ item }) => item);
}

/**
 * Clamps the requested page into range (e.g. after a search shrinks the
 * result set below the current page) rather than rendering an empty page.
 */
export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
): { pageItems: T[]; totalPages: number; clampedPage: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const start = (clampedPage - 1) * pageSize;
  return {
    pageItems: items.slice(start, start + pageSize),
    totalPages,
    clampedPage,
  };
}

/**
 * Three-state header click cycle: unsorted -> asc -> desc -> unsorted.
 * Clicking a different column always starts that column at asc.
 */
export function toggleSort<TColumn extends string>(
  current: SortState<TColumn>,
  column: TColumn,
): SortState<TColumn> {
  if (!current || current.column !== column) {
    return { column, direction: "asc" };
  }
  if (current.direction === "asc") {
    return { column, direction: "desc" };
  }
  return null;
}
