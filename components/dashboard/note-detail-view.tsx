"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { requestJson, type ApiFailure } from "@/lib/api/client";
import type { Note, NoteDetail, NoteSection } from "@/types/note.types";
import type { Project } from "@/types/project.types";
import type { Tag } from "@/types/tag.types";
import { describeFailure, useAllItems } from "./hooks";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  FolderIcon,
  GripIcon,
  PencilIcon,
  PlusIcon,
  TagIcon,
  TrashIcon,
} from "./icons";
import { NoteFormModal } from "./note-form-modal";
import { ConfirmDialog, ErrorBanner, formatDate } from "./ui";

type DraftSection = {
  /** Stable React key. Temp sections use `new-*` until the server assigns an id. */
  key: string;
  id: string | null;
  content: string;
};

function toDraft(sections: NoteSection[]): DraftSection[] {
  return sections.map((section) => ({
    key: `saved-${section.id}`,
    id: section.id,
    content: section.content ?? "",
  }));
}

type ViewState = {
  key: string;
  note: NoteDetail | null;
  sections: DraftSection[];
  baseline: DraftSection[];
  error: string | null;
};

const EMPTY_SECTIONS: DraftSection[] = [];

export function NoteDetailView({ noteId }: { noteId: string }) {
  const router = useRouter();
  const [version, setVersion] = useState(0);
  const [view, setView] = useState<ViewState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const newSectionCount = useRef(0);

  const { items: projects } = useAllItems<Project>("/api/projects");
  const { items: tags } = useAllItems<Tag>("/api/tags");

  const key = `${noteId}#${version}`;
  const loading = view?.key !== key;
  const note = view?.note ?? null;
  const sections = view?.sections ?? EMPTY_SECTIONS;
  const baseline = view?.baseline ?? EMPTY_SECTIONS;
  const loadError = view?.error ?? null;

  useEffect(() => {
    let cancelled = false;

    requestJson<NoteDetail>(`/api/notes/${noteId}`).then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        if (result.status === 401) {
          router.replace("/login");
        }

        setView({
          key,
          note: null,
          sections: EMPTY_SECTIONS,
          baseline: EMPTY_SECTIONS,
          error: describeFailure(result),
        });
        return;
      }

      const draft = toDraft(result.data.sections);

      setView({
        key,
        note: result.data,
        sections: draft,
        baseline: draft,
        error: null,
      });
      setSaved(false);
    });

    return () => {
      cancelled = true;
    };
  }, [noteId, key, router]);

  const isDirty = JSON.stringify(sections) !== JSON.stringify(baseline);

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  function updateSections(
    updater: (current: DraftSection[]) => DraftSection[],
  ) {
    setView((current) =>
      current ? { ...current, sections: updater(current.sections) } : current,
    );
  }

  function updateSectionsAndBaseline(next: DraftSection[]) {
    setView((current) =>
      current ? { ...current, sections: next, baseline: next } : current,
    );
  }

  function updateSection(sectionKey: string, content: string) {
    updateSections((current) =>
      current.map((section) =>
        section.key === sectionKey ? { ...section, content } : section,
      ),
    );
    setSaved(false);
  }

  function addSection() {
    const nextKey = `new-${newSectionCount.current}`;
    newSectionCount.current += 1;

    updateSections((current) => [
      ...current,
      { key: nextKey, id: null, content: "" },
    ]);
    setFocusKey(nextKey);
    setSaved(false);
  }

  function removeSection(sectionKey: string) {
    updateSections((current) =>
      current.filter((section) => section.key !== sectionKey),
    );
    setSaved(false);
  }

  function moveSection(from: number, to: number) {
    if (from === to) {
      return;
    }

    updateSections((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setSaved(false);
  }

  function discardChanges() {
    updateSections(() => baseline);
    setSaveError(null);
    setSaved(false);
  }

  function failSave(result: ApiFailure) {
    if (result.status === 401) {
      router.replace("/login");
    }

    setSaveError(describeFailure(result));
    setSaving(false);
  }

  /**
   * A save can fail halfway through. Fold the writes that already landed into
   * the draft so retrying does not delete the same section twice or create a
   * duplicate of a section that was already saved.
   */
  function syncProgress(
    createdByKey: Map<string, string>,
    deletedIds: Set<string>,
  ) {
    setView((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        sections: current.sections.map((section) => {
          const createdId = createdByKey.get(section.key);

          return !section.id && createdId
            ? { ...section, id: createdId }
            : section;
        }),
        baseline: current.baseline.filter(
          (section) => !(section.id && deletedIds.has(section.id)),
        ),
      };
    });
  }

  async function handleSave() {
    if (!isDirty || saving) {
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaved(false);

    const createdByKey = new Map<string, string>();
    const deletedIds = new Set<string>();

    function fail(result: ApiFailure) {
      syncProgress(createdByKey, deletedIds);
      failSave(result);
    }

    const keptIds = new Set(
      sections.flatMap((section) => (section.id ? [section.id] : [])),
    );
    const removed = baseline.filter(
      (section) => section.id !== null && !keptIds.has(section.id),
    );

    for (const section of removed) {
      const result = await requestJson<null>(
        `/api/notes/${noteId}/sections/${section.id}`,
        { method: "DELETE" },
      );

      if (!result.ok) {
        fail(result);
        return;
      }

      if (section.id) {
        deletedIds.add(section.id);
      }
    }

    const baselineById = new Map(
      baseline.flatMap((section) =>
        section.id ? [[section.id, section] as const] : [],
      ),
    );
    const nextSections: DraftSection[] = [];
    const createdIds: string[] = [];

    for (const [index, section] of sections.entries()) {
      if (section.id) {
        const previous = baselineById.get(section.id);

        if (!previous || previous.content !== section.content) {
          const result = await requestJson<NoteSection>(
            `/api/notes/${noteId}/sections/${section.id}`,
            { method: "PATCH", body: { content: section.content } },
          );

          if (!result.ok) {
            fail(result);
            return;
          }
        }

        nextSections.push(section);
        continue;
      }

      const result = await requestJson<NoteSection>(
        `/api/notes/${noteId}/sections`,
        {
          method: "POST",
          body: { content: section.content, note_order: index + 1 },
        },
      );

      if (!result.ok) {
        fail(result);
        return;
      }

      createdByKey.set(section.key, result.data.id);
      createdIds.push(result.data.id);
      nextSections.push({ ...section, id: result.data.id });
    }

    const removedIds = new Set(
      removed.flatMap((section) => (section.id ? [section.id] : [])),
    );
    const serverOrder = baseline
      .flatMap((section) =>
        section.id && !removedIds.has(section.id) ? [section.id] : [],
      )
      .concat(createdIds);
    const desiredOrder = nextSections.flatMap((section) =>
      section.id ? [section.id] : [],
    );

    if (
      desiredOrder.length > 0 &&
      serverOrder.join("|") !== desiredOrder.join("|")
    ) {
      const result = await requestJson<NoteSection[]>(
        `/api/notes/${noteId}/sections/order`,
        { method: "PUT", body: { sectionIds: desiredOrder } },
      );

      if (!result.ok) {
        fail(result);
        return;
      }
    }

    const refreshed = await requestJson<NoteDetail>(`/api/notes/${noteId}`);

    if (!refreshed.ok) {
      if (refreshed.status === 401) {
        router.replace("/login");
      }

      updateSectionsAndBaseline(nextSections);
      setSaveError(
        "Your changes were saved, but the note could not be refreshed. Reload the page to see the latest version.",
      );
      setSaving(false);
      return;
    }

    const draft = toDraft(refreshed.data.sections);

    setView({
      key,
      note: refreshed.data,
      sections: draft,
      baseline: draft,
      error: null,
    });
    setSaving(false);
    setSaved(true);
  }

  const project = note?.project_id
    ? projects.find((item) => item.id === note.project_id)
    : undefined;
  const tag = project?.tag_id
    ? tags.find((item) => item.id === project.tag_id)
    : undefined;

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl" aria-busy="true">
        <div className="mb-6 h-5 w-28 rounded-full bg-mist" />
        <div className="rounded-2xl border border-line bg-surface px-6 py-10 sm:px-12">
          <div className="h-3 w-16 rounded-full bg-mist" />
          <div className="mt-4 h-8 w-2/3 rounded-full bg-mist" />
          <div className="mt-3 h-4 w-full rounded-full bg-mist" />
          <div className="mt-10 space-y-3 border-t border-line pt-10">
            <div className="h-4 w-full rounded-full bg-mist" />
            <div className="h-4 w-11/12 rounded-full bg-mist" />
            <div className="h-4 w-3/4 rounded-full bg-mist" />
          </div>
        </div>
        <span className="sr-only">Loading note…</span>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/dashboard/notes"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          All notes
        </Link>

        <ErrorBanner
          message={loadError ?? "This note could not be loaded."}
          onRetry={() => setVersion((current) => current + 1)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard/notes"
          onClick={(event) => {
            if (isDirty) {
              event.preventDefault();
              setConfirmLeave(true);
            }
          }}
          className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          All notes
        </Link>

        <button
          type="button"
          onClick={() => setEditorOpen(true)}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-mist"
        >
          <PencilIcon className="h-4 w-4" />
          Edit details
        </button>
      </div>

      {saveError ? (
        <ErrorBanner message={saveError} className="mb-4" />
      ) : null}

      <article className="rounded-2xl border border-line bg-surface px-6 py-8 shadow-sm sm:px-12 sm:py-12">
        <p className="eyebrow">Note</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {note.title}
        </h1>

        {note.description ? (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            {note.description}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-mist px-2 py-0.5 text-[11px] text-muted">
            <FolderIcon className="h-3 w-3" />
            {project ? project.title : "No project"}
          </span>

          {tag ? (
            <span className="chip">
              <TagIcon className="mr-1 h-3 w-3" />
              {tag.name}
            </span>
          ) : null}

          <span className="font-mono text-[11px] text-muted">
            {note.updated_at ? "Updated" : "Created"}{" "}
            {formatDate(note.updated_at ?? note.created_at)}
          </span>
        </div>

        <div className="mt-8 border-t border-line pt-8">
          {sections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center">
              <p className="font-display text-lg font-semibold">
                This note is empty
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
                Add your first section and start writing. Drag sections by their
                handle to reorder them.
              </p>
              <button
                type="button"
                onClick={addSection}
                className="btn btn-primary mt-5"
              >
                <PlusIcon className="h-4 w-4" />
                Add section
              </button>
            </div>
          ) : (
            <div>
              {sections.map((section, index) => (
                <div
                  key={section.key}
                  onDragOver={(event) => {
                    if (dragIndex !== null) {
                      event.preventDefault();
                      setOverIndex(index);
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();

                    if (dragIndex !== null) {
                      moveSection(dragIndex, index);
                    }

                    setDragIndex(null);
                    setOverIndex(null);
                  }}
                  onDragLeave={(event) => {
                    if (
                      !event.currentTarget.contains(event.relatedTarget as Node)
                    ) {
                      setOverIndex((current) =>
                        current === index ? null : current,
                      );
                    }
                  }}
                  className={`group/section relative border-t border-line/70 py-6 transition-colors first:border-t-0 first:pt-0 focus-within:bg-primary/[0.03] ${
                    dragIndex === index ? "opacity-40" : ""
                  }`}
                >
                  {overIndex === index && dragIndex !== index ? (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -top-px left-0 right-0 h-0.5 rounded-full bg-primary"
                    />
                  ) : null}

                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        draggable
                        onDragStart={(event) => {
                          setDragIndex(index);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData(
                            "text/plain",
                            String(index),
                          );
                        }}
                        onDragEnd={() => {
                          setDragIndex(null);
                          setOverIndex(null);
                        }}
                        aria-label={`Drag section ${index + 1} to reorder`}
                        title="Drag to reorder"
                        className="grid h-7 w-6 cursor-grab place-items-center rounded text-muted/50 transition-colors hover:bg-mist hover:text-ink active:cursor-grabbing focus-visible:text-ink sm:-ml-8"
                      >
                        <GripIcon className="h-4 w-4" />
                      </button>

                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted/60">
                        Section {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>

                    <div className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/section:opacity-100">
                      <button
                        type="button"
                        onClick={() => moveSection(index, index - 1)}
                        disabled={index === 0}
                        aria-label={`Move section ${index + 1} up`}
                        title="Move up"
                        className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-mist hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <ArrowUpIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSection(index, index + 1)}
                        disabled={index === sections.length - 1}
                        aria-label={`Move section ${index + 1} down`}
                        title="Move down"
                        className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-mist hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <ArrowDownIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSection(section.key)}
                        aria-label={`Delete section ${index + 1}`}
                        title="Delete section"
                        className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger-strong"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <AutoGrowTextarea
                    id={`section-${section.key}`}
                    value={section.content}
                    onChange={(content) => updateSection(section.key, content)}
                    placeholder="Start writing…"
                    autoFocus={focusKey === section.key}
                    ariaLabel={`Section ${index + 1} content`}
                  />
                </div>
              ))}

              <button
                type="button"
                onClick={addSection}
                className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-line text-sm font-medium text-muted transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary-strong"
              >
                <PlusIcon className="h-4 w-4" />
                Add section
              </button>
            </div>
          )}
        </div>
      </article>

      {isDirty ? (
        <div className="sticky bottom-4 z-30 mt-6 flex flex-col gap-3 rounded-xl border border-line bg-surface/95 px-4 py-3 shadow-[0_18px_40px_-24px_rgba(17,24,39,0.45)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p
            className="flex items-center gap-2 text-sm text-muted"
            aria-live="polite"
          >
            <span className="h-2 w-2 rounded-full bg-warning" />
            Unsaved changes
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={discardChanges}
              disabled={saving}
              className="inline-flex min-h-9 items-center rounded-lg border border-line px-3 text-sm font-medium text-ink transition-colors hover:bg-mist disabled:opacity-50"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary min-h-9 px-4 text-sm"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      ) : saved ? (
        <p className="mt-6 text-right font-mono text-xs text-muted" role="status">
          All changes saved
        </p>
      ) : null}

      {editorOpen ? (
        <NoteFormModal
          note={note}
          projects={projects}
          tags={tags}
          onClose={() => setEditorOpen(false)}
          onSaved={(updated: Note) => {
            setView((current) =>
              current?.note
                ? { ...current, note: { ...current.note, ...updated } }
                : current,
            );
            setEditorOpen(false);
          }}
        />
      ) : null}

      {confirmLeave ? (
        <ConfirmDialog
          title="Discard unsaved changes?"
          description="This note has changes that have not been saved yet. Leaving now will lose them."
          confirmLabel="Discard and leave"
          onClose={() => setConfirmLeave(false)}
          onConfirm={() => {
            setConfirmLeave(false);
            router.push("/dashboard/notes");
          }}
        />
      ) : null}
    </div>
  );
}

function AutoGrowTextarea({
  id,
  value,
  onChange,
  placeholder,
  autoFocus,
  ariaLabel,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      id={id}
      rows={1}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      className="block w-full resize-none overflow-hidden border-0 bg-transparent py-1 text-[15px] leading-8 text-ink placeholder:text-muted/40 focus:outline-none"
    />
  );
}
