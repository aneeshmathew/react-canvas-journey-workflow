import { describe, expect, it } from "vitest";
import { filterBySearch, paginate, sortItems, toggleSort } from "./listControls";

type Row = { id: string; name: string; note?: string; count: number };

const rows: Row[] = [
  { id: "1", name: "Welcome series", note: "onboarding", count: 3 },
  { id: "2", name: "Cart abandonment", count: 10 },
  { id: "3", name: "Winback", note: "re-engagement", count: 1 },
];

describe("filterBySearch", () => {
  it("returns everything for an empty or whitespace query", () => {
    expect(filterBySearch(rows, "", (r) => [r.name])).toHaveLength(3);
    expect(filterBySearch(rows, "   ", (r) => [r.name])).toHaveLength(3);
  });

  it("matches case-insensitively across multiple fields", () => {
    const result = filterBySearch(rows, "WIN", (r) => [r.name, r.note]);
    expect(result.map((r) => r.id)).toEqual(["3"]);
  });

  it("matches on a secondary field even when the primary field doesn't match", () => {
    const result = filterBySearch(rows, "onboarding", (r) => [r.name, r.note]);
    expect(result.map((r) => r.id)).toEqual(["1"]);
  });

  it("tolerates undefined fields without throwing", () => {
    const result = filterBySearch(rows, "cart", (r) => [r.name, r.note]);
    expect(result.map((r) => r.id)).toEqual(["2"]);
  });

  it("returns no results when nothing matches", () => {
    expect(filterBySearch(rows, "zzz", (r) => [r.name])).toHaveLength(0);
  });
});

describe("sortItems", () => {
  it("returns items unchanged when sort is null", () => {
    expect(sortItems(rows, null, (r) => r.name)).toEqual(rows);
  });

  it("sorts ascending and descending by a numeric column", () => {
    const asc = sortItems(rows, { column: "count", direction: "asc" }, (r, c) => r[c]);
    expect(asc.map((r) => r.id)).toEqual(["3", "1", "2"]);

    const desc = sortItems(rows, { column: "count", direction: "desc" }, (r, c) => r[c]);
    expect(desc.map((r) => r.id)).toEqual(["2", "1", "3"]);
  });

  it("sorts alphabetically by a string column", () => {
    const asc = sortItems(rows, { column: "name", direction: "asc" }, (r, c) => r[c]);
    expect(asc.map((r) => r.id)).toEqual(["2", "1", "3"]);
  });

  it("keeps ties in original order (stable sort)", () => {
    const tied: Row[] = [
      { id: "a", name: "Same", count: 5 },
      { id: "b", name: "Same", count: 5 },
      { id: "c", name: "Same", count: 5 },
    ];
    const sorted = sortItems(tied, { column: "name", direction: "asc" }, (r, c) => r[c]);
    expect(sorted.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 25 }, (_, i) => i);

  it("slices the requested page at the given page size", () => {
    const { pageItems, totalPages, clampedPage } = paginate(items, 1, 10);
    expect(pageItems).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(totalPages).toBe(3);
    expect(clampedPage).toBe(1);
  });

  it("returns the partial last page", () => {
    const { pageItems } = paginate(items, 3, 10);
    expect(pageItems).toEqual([20, 21, 22, 23, 24]);
  });

  it("clamps a page beyond the end back to the last page", () => {
    const { pageItems, clampedPage } = paginate(items, 99, 10);
    expect(clampedPage).toBe(3);
    expect(pageItems).toEqual([20, 21, 22, 23, 24]);
  });

  it("clamps a page below 1 up to page 1", () => {
    const { clampedPage } = paginate(items, 0, 10);
    expect(clampedPage).toBe(1);
  });

  it("treats an empty list as a single empty page, not zero pages", () => {
    const { totalPages, clampedPage, pageItems } = paginate([], 1, 10);
    expect(totalPages).toBe(1);
    expect(clampedPage).toBe(1);
    expect(pageItems).toEqual([]);
  });
});

describe("toggleSort", () => {
  it("starts a fresh column at ascending", () => {
    expect(toggleSort(null, "name")).toEqual({ column: "name", direction: "asc" });
  });

  it("cycles asc -> desc -> null on the same column", () => {
    const asc = toggleSort(null, "name");
    const desc = toggleSort(asc, "name");
    expect(desc).toEqual({ column: "name", direction: "desc" });
    expect(toggleSort(desc, "name")).toBeNull();
  });

  it("switching to a different column restarts at ascending", () => {
    const nameDesc = { column: "name" as const, direction: "desc" as const };
    expect(toggleSort(nameDesc, "count")).toEqual({
      column: "count",
      direction: "asc",
    });
  });
});
