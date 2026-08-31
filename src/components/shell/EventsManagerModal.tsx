import { useState } from "react";
import {
  useCreateEventMutation,
  useDeleteEventMutation,
  useEventsQuery,
} from "@/hooks/queries/useJourneyQueries";

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * A real, persisted catalog of events — distinct from Audiences/Templates,
 * which are still a static mock list (see `mockApi.ts`). Creating an event
 * here immediately becomes a `<datalist>` suggestion in the Inspector's
 * event-key field for any event-based node (Unitary event, Business event,
 * the legacy `event` node), since both read from the same
 * `useEventsQuery`/`catalogKeys.events` cache.
 */
export function EventsManagerModal({ open, onClose }: Props) {
  const eventsQuery = useEventsQuery();
  const createEvent = useCreateEventMutation();
  const deleteEvent = useDeleteEventMutation();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  if (!open) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError("Give the event a name.");
      return;
    }
    const existing = eventsQuery.data ?? [];
    if (existing.some((ev) => ev.name.toLowerCase() === trimmed.toLowerCase())) {
      setFormError("An event with that name already exists.");
      return;
    }
    setFormError(null);
    createEvent.mutate(
      { name: trimmed, description: description.trim() || undefined },
      {
        onSuccess: () => {
          setName("");
          setDescription("");
        },
      },
    );
  };

  return (
    <div className="exec-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="exec-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="events-manager-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="events-manager-title">Events</h2>
        <p className="exec-modal-note">
          Events created here are available to pick from in any event-based
          node's Inspector (Unitary event, Business event, and the legacy
          Event node). This is a real, persisted catalog — unlike Audiences
          and Message templates, which are still a fixed mock list.
        </p>

        <form onSubmit={handleCreate} className="events-manager-form">
          <div className="events-manager-form-row">
            <label htmlFor="new-event-name" className="sr-only">
              Event name
            </label>
            <input
              id="new-event-name"
              placeholder="Event name (e.g. Trial started)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <label htmlFor="new-event-desc" className="sr-only">
              Description
            </label>
            <input
              id="new-event-desc"
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button
              type="submit"
              className="events-manager-add"
              disabled={createEvent.isPending}
            >
              {createEvent.isPending ? "Adding…" : "Add event"}
            </button>
          </div>
          {formError ? <p className="test-mode-error">{formError}</p> : null}
        </form>

        {eventsQuery.isPending ? <p>Loading events…</p> : null}
        {eventsQuery.data && eventsQuery.data.length === 0 ? (
          <p className="test-mode-history-empty">
            No events yet — add one above.
          </p>
        ) : null}
        {eventsQuery.data && eventsQuery.data.length > 0 ? (
          <ul className="publish-history-list">
            {eventsQuery.data.map((ev) => (
              <li key={ev.id} className="publish-history-row">
                <div className="publish-history-row__main">
                  <strong>{ev.name}</strong>
                  <button
                    type="button"
                    aria-label={`Delete event ${ev.name}`}
                    title="Delete event"
                    className="events-manager-delete"
                    onClick={() => deleteEvent.mutate(ev.id)}
                  >
                    ×
                  </button>
                </div>
                {ev.description ? (
                  <p className="events-manager-desc">{ev.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="exec-modal-actions">
          <button type="button" className="exec-modal-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
