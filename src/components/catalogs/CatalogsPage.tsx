import { useState } from "react";
import type {
  AudienceDefinition,
  AudienceDefinitionInput,
  TemplateDefinition,
  TemplateDefinitionInput,
} from "@/lib/api/mockApi";
import { ACTION_NODE_LABELS, ACTION_NODE_TYPES, type ActionNodeType } from "@/lib/journeySchema";
import {
  useAudienceDefinitionsQuery,
  useCreateAudienceMutation,
  useCreateTemplateMutation,
  useDeleteAudienceMutation,
  useDeleteTemplateMutation,
  useTemplateDefinitionsQuery,
  useUpdateAudienceMutation,
  useUpdateTemplateMutation,
} from "@/hooks/queries/useJourneyQueries";

const NEW_ID = "__new__";

// --- Audiences tab ----------------------------------------------------

function blankAudienceForm(): AudienceDefinitionInput {
  return { name: "", description: "" };
}

function AudiencesTab() {
  const audiencesQuery = useAudienceDefinitionsQuery();
  const createAudience = useCreateAudienceMutation();
  const updateAudience = useUpdateAudienceMutation();
  const deleteAudience = useDeleteAudienceMutation();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<AudienceDefinitionInput>(blankAudienceForm());
  const [formError, setFormError] = useState<string | null>(null);

  const selected =
    selectedId && selectedId !== NEW_ID
      ? audiencesQuery.data?.find((a) => a.id === selectedId)
      : undefined;
  const isNew = selectedId === NEW_ID;
  const isEditing = selectedId !== null;

  const openNew = () => {
    setForm(blankAudienceForm());
    setFormError(null);
    setSelectedId(NEW_ID);
  };

  const openExisting = (a: AudienceDefinition) => {
    setForm({ name: a.name, description: a.description ?? "" });
    setFormError(null);
    setSelectedId(a.id);
  };

  const closeForm = () => {
    setSelectedId(null);
    setFormError(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = form.name.trim();
    if (!trimmed) {
      setFormError("Give the audience a label.");
      return;
    }
    const duplicate = (audiencesQuery.data ?? []).some(
      (a) => a.id !== selectedId && a.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      setFormError("An audience with that label already exists.");
      return;
    }
    setFormError(null);
    const input: AudienceDefinitionInput = { ...form, name: trimmed };
    if (isNew) {
      createAudience.mutate(input, { onSuccess: () => closeForm() });
    } else if (selectedId) {
      updateAudience.mutate({ id: selectedId, input }, { onSuccess: () => closeForm() });
    }
  };

  const handleDelete = () => {
    if (!selectedId || isNew) return;
    if (!window.confirm("Delete this audience? This can't be undone.")) return;
    deleteAudience.mutate(selectedId, { onSuccess: () => closeForm() });
  };

  const isSaving = createAudience.isPending || updateAudience.isPending;

  if (isEditing) {
    return (
      <form
        onSubmit={handleSave}
        className="mx-auto w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Audience{selected ? `: ${selected.name}` : ": New"}
          </h2>
          <div className="flex flex-shrink-0 items-center gap-2">
            {!isNew ? (
              <button
                type="button"
                aria-label="Delete audience"
                title="Delete audience"
                onClick={handleDelete}
                disabled={deleteAudience.isPending}
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

        <label htmlFor="aud-label" className="events-manager-field-label">
          Label
        </label>
        <input
          id="aud-label"
          placeholder="Add a label"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          autoFocus
        />

        {selected ? (
          <div className="events-manager-meta">
            <div>
              <span className="events-manager-field-label">Author</span>
              <p>{selected.author}</p>
            </div>
            <div>
              <span className="events-manager-field-label">Created</span>
              <p>{new Date(selected.createdAt).toLocaleString()}</p>
            </div>
          </div>
        ) : null}

        <label htmlFor="aud-desc" className="events-manager-field-label">
          Description
        </label>
        <input
          id="aud-desc"
          placeholder="Add a description"
          value={form.description ?? ""}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        {formError ? <p className="test-mode-error">{formError}</p> : null}
      </form>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-4">
        <p className="text-sm text-slate-500">
          A real, persisted catalog — this is a mock list of audience names
          only; no real audience membership/size logic exists behind it (see
          README → Gap analysis).
        </p>
        <button
          type="button"
          onClick={openNew}
          className="flex-shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + New audience
        </button>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Label</th>
              <th className="px-4 py-2.5">Description</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {audiencesQuery.isPending ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                  Loading audiences…
                </td>
              </tr>
            ) : null}
            {audiencesQuery.data && audiencesQuery.data.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                  No audiences yet — create one to get started.
                </td>
              </tr>
            ) : null}
            {(audiencesQuery.data ?? []).map((a) => (
              <tr key={a.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => openExisting(a)}
                    className="font-medium text-slate-900 hover:text-blue-600 hover:underline"
                  >
                    {a.name}
                  </button>
                </td>
                <td className="px-4 py-2.5 text-slate-500">{a.description ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openExisting(a)}
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
    </>
  );
}

// --- Templates tab ------------------------------------------------------

function blankTemplateForm(): TemplateDefinitionInput {
  return { name: "", description: "", channel: "action-email" };
}

function TemplatesTab() {
  const templatesQuery = useTemplateDefinitionsQuery();
  const createTemplate = useCreateTemplateMutation();
  const updateTemplate = useUpdateTemplateMutation();
  const deleteTemplate = useDeleteTemplateMutation();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateDefinitionInput>(blankTemplateForm());
  const [formError, setFormError] = useState<string | null>(null);

  const selected =
    selectedId && selectedId !== NEW_ID
      ? templatesQuery.data?.find((t) => t.id === selectedId)
      : undefined;
  const isNew = selectedId === NEW_ID;
  const isEditing = selectedId !== null;

  const openNew = () => {
    setForm(blankTemplateForm());
    setFormError(null);
    setSelectedId(NEW_ID);
  };

  const openExisting = (t: TemplateDefinition) => {
    setForm({ name: t.name, description: t.description ?? "", channel: t.channel });
    setFormError(null);
    setSelectedId(t.id);
  };

  const closeForm = () => {
    setSelectedId(null);
    setFormError(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = form.name.trim();
    if (!trimmed) {
      setFormError("Give the template a label.");
      return;
    }
    const duplicate = (templatesQuery.data ?? []).some(
      (t) => t.id !== selectedId && t.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      setFormError("A template with that label already exists.");
      return;
    }
    setFormError(null);
    const input: TemplateDefinitionInput = { ...form, name: trimmed };
    if (isNew) {
      createTemplate.mutate(input, { onSuccess: () => closeForm() });
    } else if (selectedId) {
      updateTemplate.mutate({ id: selectedId, input }, { onSuccess: () => closeForm() });
    }
  };

  const handleDelete = () => {
    if (!selectedId || isNew) return;
    if (!window.confirm("Delete this template? This can't be undone.")) return;
    deleteTemplate.mutate(selectedId, { onSuccess: () => closeForm() });
  };

  const isSaving = createTemplate.isPending || updateTemplate.isPending;

  if (isEditing) {
    return (
      <form
        onSubmit={handleSave}
        className="mx-auto w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Template{selected ? `: ${selected.name}` : ": New"}
          </h2>
          <div className="flex flex-shrink-0 items-center gap-2">
            {!isNew ? (
              <button
                type="button"
                aria-label="Delete template"
                title="Delete template"
                onClick={handleDelete}
                disabled={deleteTemplate.isPending}
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

        <label htmlFor="tpl-label" className="events-manager-field-label">
          Label
        </label>
        <input
          id="tpl-label"
          placeholder="Add a label"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          autoFocus
        />

        {selected ? (
          <div className="events-manager-meta">
            <div>
              <span className="events-manager-field-label">Author</span>
              <p>{selected.author}</p>
            </div>
            <div>
              <span className="events-manager-field-label">Created</span>
              <p>{new Date(selected.createdAt).toLocaleString()}</p>
            </div>
          </div>
        ) : null}

        <label htmlFor="tpl-desc" className="events-manager-field-label">
          Description
        </label>
        <input
          id="tpl-desc"
          placeholder="Add a description"
          value={form.description ?? ""}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <label htmlFor="tpl-channel" className="events-manager-field-label">
          Channel <span aria-hidden="true">*</span>
        </label>
        <select
          id="tpl-channel"
          value={form.channel}
          onChange={(e) => setForm({ ...form, channel: e.target.value as ActionNodeType })}
        >
          {ACTION_NODE_TYPES.map((t) => (
            <option key={t} value={t}>
              {ACTION_NODE_LABELS[t].label}
            </option>
          ))}
        </select>

        {formError ? <p className="test-mode-error">{formError}</p> : null}
      </form>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-4">
        <p className="text-sm text-slate-500">
          A real, persisted catalog of message templates, each tagged with the
          channel it's for.
        </p>
        <button
          type="button"
          onClick={openNew}
          className="flex-shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + New template
        </button>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Label</th>
              <th className="px-4 py-2.5">Channel</th>
              <th className="px-4 py-2.5">Description</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templatesQuery.isPending ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  Loading templates…
                </td>
              </tr>
            ) : null}
            {templatesQuery.data && templatesQuery.data.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  No templates yet — create one to get started.
                </td>
              </tr>
            ) : null}
            {(templatesQuery.data ?? []).map((t) => (
              <tr key={t.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => openExisting(t)}
                    className="font-medium text-slate-900 hover:text-blue-600 hover:underline"
                  >
                    {t.name}
                  </button>
                </td>
                <td className="px-4 py-2.5">
                  <span className="events-manager-type-chip">
                    {ACTION_NODE_LABELS[t.channel].label}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-500">{t.description ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openExisting(t)}
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
    </>
  );
}

// --- Page shell with tabs ------------------------------------------------

/**
 * The Catalogs landing page: Audiences and Message templates, each with the
 * same list-first-then-create/edit/delete pattern as `EventsListPage`.
 * Kept as one page with two tabs (rather than two separate nav items) since
 * both are small, closely-related pieces of reference data an editor
 * consults — splitting them into their own top-level nav destinations
 * would clutter the rail for what's really one "catalogs" concern.
 */
export function CatalogsPage() {
  const [tab, setTab] = useState<"audiences" | "templates">("audiences");

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-50 p-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-slate-900">Catalogs</h1>
        <p className="mt-1 text-sm text-slate-500">
          Reference data journeys draw from — Audiences and Message
          templates. Events have their own landing page since journeys
          reference them more directly as entry/trigger signals.
        </p>
      </div>
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab("audiences")}
          className={
            tab === "audiences"
              ? "border-b-2 border-blue-600 px-3 py-2 text-sm font-semibold text-blue-600"
              : "border-b-2 border-transparent px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
          }
        >
          Audiences
        </button>
        <button
          type="button"
          onClick={() => setTab("templates")}
          className={
            tab === "templates"
              ? "border-b-2 border-blue-600 px-3 py-2 text-sm font-semibold text-blue-600"
              : "border-b-2 border-transparent px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
          }
        >
          Message templates
        </button>
      </div>
      {tab === "audiences" ? <AudiencesTab /> : <TemplatesTab />}
    </div>
  );
}
