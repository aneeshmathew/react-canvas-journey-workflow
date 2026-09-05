import { useMemo, useState } from "react";
import {
  filterBySearch,
  paginate,
  sortItems,
  toggleSort,
  type SortState,
} from "@/lib/listControls";

type Options<T, TColumn extends string> = {
  items: T[];
  /** Fields to match the search query against, e.g. `(j) => [j.name, j.description]`. */
  getSearchableText: (item: T) => Array<string | undefined>;
  /** Value to compare when sorting by `column`. */
  getSortValue: (item: T, column: TColumn) => string | number;
  pageSize?: number;
};

/**
 * Backs a data-grid page (Journeys, Events, ...) with search + sortable
 * columns + pagination, using the pure helpers in `lib/listControls.ts`.
 * Changing the search query or the sort column resets to page 1 so a person
 * doesn't land on a now-empty page.
 */
export function useListControls<T, TColumn extends string>({
  items,
  getSearchableText,
  getSortValue,
  pageSize = 10,
}: Options<T, TColumn>) {
  const [query, setQueryState] = useState("");
  const [sort, setSort] = useState<SortState<TColumn>>(null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () => filterBySearch(items, query, getSearchableText),
    [items, query, getSearchableText],
  );

  const sorted = useMemo(
    () => sortItems(filtered, sort, getSortValue),
    [filtered, sort, getSortValue],
  );

  const { pageItems, totalPages, clampedPage } = useMemo(
    () => paginate(sorted, page, pageSize),
    [sorted, page, pageSize],
  );

  const setQuery = (value: string) => {
    setQueryState(value);
    setPage(1);
  };

  const toggleColumnSort = (column: TColumn) => {
    setSort((current) => toggleSort(current, column));
    setPage(1);
  };

  return {
    query,
    setQuery,
    sort,
    toggleColumnSort,
    page: clampedPage,
    setPage,
    totalPages,
    totalCount: items.length,
    filteredCount: sorted.length,
    pageItems,
  };
}
