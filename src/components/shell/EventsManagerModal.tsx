import { useEffect, useState } from "react";
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

type Props = {
  open: boolean;
  onClose: () => void;
};

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
 * A real, persisted catalog of events — distinct from Audiences/Templates,
 * which are still a static mock list (see `mockApi.ts`). Creating an event
 * here immediately becomes a `<datalist>` suggestion in the Inspector's
 * event-key field for any event-based node.
 *
 * Layout note: the detail form's field set (Label, Author, Created,
 * Description, Type, Event id type, Timeout) matches a layout common to
 * event-configuration panels in journey-orchestration tools generally.
 * "Author" and "Created" are read-only display fields — this is a
 * single-user mock app, so Author is always the same placeholder rather
 * than a real identity system.
 */
export function EventsManagerModal({ open, onClose }: Props) {
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

  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      setFormError(null);
    }
  }, [open]);

  if (!open) return null;

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
    deleteEvent.mutate(selectedId, { onSuccess: () => closeForm() });
  };

  const isSaving = createEvent.isPending || updateEvent.isPending;

  return (
    <div className="exec-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="exec-modal exec-modal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="events-manager-title"
        onClick={(e) => e.stopPropagation()}
      >
        {!isEditing ? (
          <>
            <div className="events-manager-header">
              <div>
                <h2 id="events-manager-title">Events</h2>
                <p className="exec-modal-note">
                  Events created here are available to pick from in any
                  event-based node's Inspector. This is a real, persisted
                  catalog — unlike Audiences and Message templates, which are
                  still a fixed mock list.
                </p>
              </div>
              <button
                type="button"
                className="events-manager-add"
                onClick={openNew}
              >
                + New event
              </button>
            </div>

            {eventsQuery.isPending ? <p>Loading events…</p> : null}
            {eventsQuery.data && eventsQuery.data.length === 0 ? (
              <p className="test-mode-history-empty">
                No events yet — add one above.
              </p>
            ) : null}
            {eventsQuery.data && eventsQuery.data.length > 0 ? (
              <ul className="publish-history-list">
                {eventsQuery.data.map((ev) => (
                  <li key={ev.id}>
                    <button
                      type="button"
                      className="events-manager-row"
                      onClick={() => openExisting(ev)}
                    >
                      <div className="publish-history-row__main">
                        <strong>{ev.name}</strong>
                        <span className="events-manager-type-chip">
                          {ev.type === "unitary" ? "Unitary" : "Business"}
                        </span>
                      </div>
                      {ev.description ? (
                        <p className="events-manager-desc">{ev.description}</p>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="exec-modal-actions">
              <button
                type="button"
                className="exec-modal-close"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSave}>
            <div className="events-manager-header">
              <h2 id="events-manager-title">
                Events{selectedEvent ? `: ${selectedEvent.name}` : ": New"}
              </h2>
              <div className="events-manager-form-actions">
                {!isNew ? (
                  <button
                    type="button"
                    aria-label="Delete event"
                    title="Delete event"
                    className="events-manager-icon-btn"
                    onClick={handleDelete}
                    disabled={deleteEvent.isPending}
                  >
                    🗑
                  </button>
                ) : null}
                <button type="button" onClick={closeForm}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="events-manager-save"
                  disabled={isSaving}
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
                <label
                  htmlFor="ev-type"
                  className="events-manager-field-label"
                >
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
        )}
      </div>
    </div>
  );
}
