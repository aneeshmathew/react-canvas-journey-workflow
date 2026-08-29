type Props = {
  open: boolean;
  name: string;
  description: string;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onClose: () => void;
};

/**
 * Journey-level properties, per AJO's "Create" step (name + description
 * before/alongside canvas design — see README → Roadmap → Phase 1).
 *
 * Scope note: entry-point *type* selection is deliberately NOT here.
 * In AJO's actual model the entry point is the first canvas activity
 * (dragged from the Events palette), not a field in a properties dialog —
 * the screenshot's "LobbyBeacon / Unitary event" node is a canvas node, not
 * a form field. Putting entry-type selection here too would just create a
 * second, conflicting way to set the same thing, so this panel only owns
 * name + description.
 */
export function JourneyPropertiesPanel({
  open,
  name,
  description,
  onNameChange,
  onDescriptionChange,
  onClose,
}: Props) {
  if (!open) return null;
  return (
    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Journey properties
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close journey properties"
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          ✕
        </button>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="journey-props-name"
            className="mb-1 block text-xs font-medium text-slate-600"
          >
            Name
          </label>
          <input
            id="journey-props-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label
            htmlFor="journey-props-description"
            className="mb-1 block text-xs font-medium text-slate-600"
          >
            Description
          </label>
          <textarea
            id="journey-props-description"
            rows={1}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="What is this journey for?"
            className="w-full resize-y rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
