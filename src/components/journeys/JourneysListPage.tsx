import { useState } from "react";
import {
  useCreateJourneyMutation,
  useDeleteJourneyMutation,
  useJourneysListQuery,
} from "@/hooks/queries/useJourneyQueries";
import { useListControls } from "@/hooks/useListControls";
import type { JourneySummary } from "@/lib/api/mockApi";
import {
  GridSearchInput,
  PaginationFooter,
  SortableHeader,
} from "@/components/shared/GridControls";

type Props = {
  onOpenJourney: (journeyId: string) => void;
};

type JourneyColumn = "name" | "updatedAt" | "nodeCount" | "edgeCount";

function getSortValue(journey: JourneySummary, column: JourneyColumn) {
  if (column === "name") return journey.name.toLowerCase();
  if (column === "updatedAt") return journey.updatedAt;
  return journey[column];
}

/**
 * The app's landing page: a data grid of every journey, with create/edit/
 * delete. Replaces the earlier `PublishHistoryModal`-as-stand-in-for-a-list
 * approach — that was an intentional scope simplification at the time (see
 * README → Phase 5), superseded now that real multi-journey CRUD was
 * requested. Journeys are backed by `mockApi.ts`'s `journey-builder:journey:*`
 * keys plus a lightweight index; opening a journey from here hands its id
 * to `JourneyBuilder`, which loads that specific document.
 */
export function JourneysListPage({ onOpenJourney }: Props) {
  const journeysQuery = useJourneysListQuery();
  const createJourney = useCreateJourneyMutation();
  const deleteJourney = useDeleteJourneyMutation();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const {
    query,
    setQuery,
    sort,
    toggleColumnSort,
    page,
    setPage,
    totalPages,
    totalCount,
    filteredCount,
    pageItems,
  } = useListControls<JourneySummary, JourneyColumn>({
    items: journeysQuery.data ?? [],
    getSearchableText: (j) => [j.name, j.description],
    getSortValue,
  });

  const handleCreate = () => {
    createJourney.mutate(undefined, {
      onSuccess: (summary) => onOpenJourney(summary.id),
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (
      window.confirm(`Delete "${name}"? This can't be undone.`)
    ) {
      setPendingDeleteId(id);
      deleteJourney.mutate(id, {
        onSettled: () => setPendingDeleteId(null),
      });
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-50 p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Journeys</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create, open, or delete a journey. Opening one loads it into the
            canvas editor.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          disabled={createJourney.isPending}
          className="flex-shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {createJourney.isPending ? "Creating…" : "+ New journey"}
        </button>
      </div>

      <div className="mb-3">
        <GridSearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search journeys…"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs">
              <SortableHeader
                column="name"
                label="Name"
                sort={sort}
                onToggle={toggleColumnSort}
              />
              <SortableHeader
                column="updatedAt"
                label="Last updated"
                sort={sort}
                onToggle={toggleColumnSort}
              />
              <SortableHeader
                column="nodeCount"
                label="Nodes"
                sort={sort}
                onToggle={toggleColumnSort}
              />
              <SortableHeader
                column="edgeCount"
                label="Edges"
                sort={sort}
                onToggle={toggleColumnSort}
              />
              <th className="px-4 py-2.5 text-right font-semibold uppercase tracking-wide text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {journeysQuery.isPending ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Loading journeys…
                </td>
              </tr>
            ) : null}
            {journeysQuery.data && journeysQuery.data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No journeys yet — create one to get started.
                </td>
              </tr>
            ) : null}
            {journeysQuery.data && journeysQuery.data.length > 0 && filteredCount === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No journeys match "{query}".
                </td>
              </tr>
            ) : null}
            {pageItems.map((j) => (
              <tr
                key={j.id}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
              >
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => onOpenJourney(j.id)}
                    className="font-medium text-slate-900 hover:text-blue-600 hover:underline"
                  >
                    {j.name}
                  </button>
                  {j.description ? (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {j.description}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 text-slate-500">
                  {new Date(j.updatedAt).toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-slate-500">{j.nodeCount}</td>
                <td className="px-4 py-2.5 text-slate-500">{j.edgeCount}</td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenJourney(j.id)}
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(j.id, j.name)}
                      disabled={pendingDeleteId === j.id}
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pendingDeleteId === j.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <PaginationFooter
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalCount={totalCount}
          filteredCount={filteredCount}
          itemLabel={totalCount === 1 ? "journey" : "journeys"}
        />
      </div>
    </div>
  );
}
