import { useState } from "react";
import type {
  EventDefinition,
  EventDefinitionInput,
  EventIdType,
  EventTimeoutUnit,
} from "@/lib/api/mockApi";
import {
  useCreateEventMutation,
  useDeleteEventMutation,
  useEventDefinitionsQuery,
  useUpdateEventMutation,
} from "@/hooks/queries/useJourneyQueries";

const NEW_EVENT_ID = "__new__";

function blankForm(): EventDefinitionInput {
  return {
    name: "",
    description: "",
    type: "unitary",
    eventIdType: "system-generated",
    timeoutEnabled: false,
    timeoutAmount: 1,
    timeoutUnit: "hours",
  };
}

function formFromEvent(ev: EventDefinition): EventDefinitionInput {
  return {
    name: ev.name,
    description: ev.description ?? "",
    type: ev.type,
    eventIdType: ev.eventIdType,
    timeoutEnabled: ev.timeoutEnabled,
    timeoutAmount: ev.timeoutAmount ?? 1,
    timeoutUnit: ev.timeoutUnit ?? "hours",
  };
}

/**
 * The Events landing page: list every event first, then create/edit/delete
 * — same pattern as `JourneysListPage`. Events created here immediately
 * become a `<datalist>` suggestion in the Inspector's event-key field for
 * any event-based node.
 */
export function EventsListPage() {
  const eventsQuery = useEventDefinitionsQuery();
  const createEvent = useCreateEventMutation();
  const updateEvent = useUpdateEventMutation();
  const deleteEvent = useDeleteEventMutation();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<EventDefinitionInput>(blankForm());
  const [formError, setFormError] = useState<string | null>(null);

  const selectedEvent =
    selectedId && selectedId !== NEW_EVENT_ID
      ? eventsQuery.data?.find((e) => e.id === selectedId)
      : undefined;
  const isNew = selectedId === NEW_EVENT_ID;
  const isEditing = selectedId !== null;

  const openNew = () => {
    setForm(blankForm());
    setFormError(null);
    setSelectedId(NEW_EVENT_ID);
  };

  const openExisting = (ev: EventDefinition) => {
    setForm(formFromEvent(ev));
    setFormError(null);
    setSelectedId(ev.id);
  };

  const closeForm = () => {
    setSelectedId(null);
    setFormError(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = form.name.trim();
    if (!trimmed) {
      setFormError("Give the event a label.");
      return;
    }
    const duplicate = (eventsQuery.data ?? []).some(
      (ev) =>
        ev.id !== selectedId &&
        ev.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      setFormError("An event with that label already exists.");
      return;
    }
    setFormError(null);
    const input: EventDefinitionInput = { ...form, name: trimmed };
    if (isNew) {
      createEvent.mutate(input, { onSuccess: () => closeForm() });
    } else if (selectedId) {
      updateEvent.mutate(
        { id: selectedId, input },
        { onSuccess: () => closeForm() },
      );
    }
  };

  const handleDelete = () => {
    if (!selectedId || isNew) return;
    if (!window.confirm("Delete this event? This can't be undone.")) return;
    deleteEvent.mutate(selectedId, { onSuccess: () => closeForm() });
  };

  const isSaving = createEvent.isPending || updateEvent.isPending;

  if (isEditing) {
    return (
      <div className="flex h-full flex-col overflow-y-auto bg-slate-50 p-6">
        <form
          onSubmit={handleSave}
          className="mx-auto w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <h1 className="text-lg font-semibold text-slate-900">
              Events{selectedEvent ? `: ${selectedEvent.name}` : ": New"}
            </h1>
            <div className="flex flex-shrink-0 items-center gap-2">
              {!isNew ? (
                <button
                  type="button"
                  aria-label="Delete event"
                  title="Delete event"
                  onClick={handleDelete}
                  disabled={deleteEvent.isPending}
                  className="rounded-md px-2 py-1.5 text-slate-400 hover:text-red-600"
                >
                  🗑
                </button>
              ) : null}
              <button
                type="button"
                onClick={closeForm}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          <label htmlFor="ev-label" className="events-manager-field-label">
            Label
          </label>
          <input
            id="ev-label"
            placeholder="Add a label"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoFocus
          />

          {selectedEvent ? (
            <div className="events-manager-meta">
              <div>
                <span className="events-manager-field-label">Author</span>
                <p>{selectedEvent.author}</p>
              </div>
              <div>
                <span className="events-manager-field-label">Created</span>
                <p>{new Date(selectedEvent.createdAt).toLocaleString()}</p>
              </div>
            </div>
          ) : null}

          <label
            htmlFor="ev-description"
            className="events-manager-field-label"
          >
            Description
          </label>
          <input
            id="ev-description"
            placeholder="Add a description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <div className="events-manager-form-grid">
            <div>
              <label htmlFor="ev-type" className="events-manager-field-label">
                Type <span aria-hidden="true">*</span>
              </label>
              <select
                id="ev-type"
                value={form.type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    type: e.target.value as EventDefinitionInput["type"],
                  })
                }
              >
                <option value="unitary">Unitary</option>
                <option value="business">Business</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="ev-id-type"
                className="events-manager-field-label"
              >
                Event id type <span aria-hidden="true">*</span>
              </label>
              <select
                id="ev-id-type"
                value={form.eventIdType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    eventIdType: e.target.value as EventIdType,
                  })
                }
              >
                <option value="system-generated">System generated</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          <div className="events-manager-timeout">
            <p className="events-manager-section-title">Timeout</p>
            <label className="inspector-checkbox events-manager-timeout-checkbox">
              <input
                type="checkbox"
                checked={form.timeoutEnabled}
                onChange={(e) =>
                  setForm({ ...form, timeoutEnabled: e.target.checked })
                }
              />
              Define the event timeout
            </label>
            {form.timeoutEnabled ? (
              <div className="inspector-wait-row events-manager-timeout-fields">
                <input
                  type="number"
                  min={1}
                  aria-label="Timeout amount"
                  value={form.timeoutAmount ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      timeoutAmount: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                />
                <select
                  aria-label="Timeout unit"
                  value={form.timeoutUnit ?? "hours"}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      timeoutUnit: e.target.value as EventTimeoutUnit,
                    })
                  }
                >
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </div>
            ) : null}
          </div>

          {formError ? <p className="test-mode-error">{formError}</p> : null}
        </form>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-50 p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Events</h1>
          <p className="mt-1 text-sm text-slate-500">
            Events created here are available to pick from in any event-based
            node's Inspector. This is a real, persisted catalog — unlike
            Audiences and Message templates, which are still a fixed mock
            list.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="flex-shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + New event
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Label</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Description</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {eventsQuery.isPending ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  Loading events…
                </td>
              </tr>
            ) : null}
            {eventsQuery.data && eventsQuery.data.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  No events yet — create one to get started.
                </td>
              </tr>
            ) : null}
            {(eventsQuery.data ?? []).map((ev) => (
              <tr
                key={ev.id}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
              >
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => openExisting(ev)}
                    className="font-medium text-slate-900 hover:text-blue-600 hover:underline"
                  >
                    {ev.name}
                  </button>
                </td>
                <td className="px-4 py-2.5">
                  <span className="events-manager-type-chip">
                    {ev.type === "unitary" ? "Unitary" : "Business"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-500">
                  {ev.description ?? "—"}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openExisting(ev)}
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
