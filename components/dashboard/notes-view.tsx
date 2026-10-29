"use client";

import { useState, type FormEvent } from "react";
import { requestJson } from "@/lib/api/client";
import type { Note, NoteSortField } from "@/types/note.types";
import type { Project } from "@/types/project.types";
import type { Tag } from "@/types/tag.types";
import {
  describeFailure,
  useAllItems,
  useDebouncedValue,
  usePagedList,
} from "./hooks";
import { FolderIcon, NoteIcon, PlusIcon, TagIcon } from "./icons";
import {
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  FieldError,
  ListSkeleton,
  Modal,
  PageHeader,
  Pagination,
  RowActions,
  SearchInput,
  SelectControl,
  Toolbar,
  formatDate,
  inputClass,
  labelClass,
  selectClass,
  textareaClass,
} from "./ui";

const PER_PAGE = 10;
const TITLE_MAX_LENGTH = 255;

type SortValue =
  | "updated_at:desc"
  | "created_at:desc"
  | "title:asc"
  | "title:desc";

const SORT_OPTIONS: Array<{ value: SortValue; label: string }> = [
  { value: "updated_at:desc", label: "Recently updated" },
  { value: "created_at:desc", label: "Recently created" },
  { value: "title:asc", label: "Title A–Z" },
  { value: "title:desc", label: "Title Z–A" },
];

export function NotesView() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortValue, setSortValue] = useState<SortValue>("updated_at:desc");
  const [projectFilter, setProjectFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [editor, setEditor] = useState<Note | "new" | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Note | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const {
    items: projects,
    loading: projectsLoading,
    error: projectsError,
    reload: reloadProjects,
  } = useAllItems<Project>("/api/projects");
  const {
    items: tags,
    loading: tagsLoading,
    error: tagsError,
    reload: reloadTags,
  } = useAllItems<Tag>("/api/tags");

  const projectById = new Map(projects.map((project) => [project.id, project]));
  const tagById = new Map(tags.map((tag) => [tag.id, tag]));

  const [sort, order] = sortValue.split(":") as [
    NoteSortField,
    "asc" | "desc",
  ];

  const query = new URLSearchParams({
    page: String(page),
    perPage: String(PER_PAGE),
    sort,
    order,
  });

  if (debouncedSearch) {
    query.set("search", debouncedSearch);
  }

  if (projectFilter) {
    query.set("project_id", projectFilter);
  }

  if (tagFilter) {
    query.set("tag_id", tagFilter);
  }

  const { data, loading, error, reload } = usePagedList<Note>(
    `/api/notes?${query.toString()}`,
  );

  const notes = data?.items ?? [];
  const filtered =
    debouncedSearch.length > 0 ||
    projectFilter !== "" ||
    tagFilter !== "";

  // Wait for the joins to load so project and tag names never appear wrong.
  const showSkeleton =
    (loading && !data) || ((projectsLoading || tagsLoading) && notes.length > 0);

  function tagForNote(note: Note): Tag | null {
    if (!note.project_id) {
      return null;
    }

    const project = projectById.get(note.project_id);

    if (!project?.tag_id) {
      return null;
    }

    return tagById.get(project.tag_id) ?? null;
  }

  function clearFilters() {
    setSearch("");
    setProjectFilter("");
    setTagFilter("");
    setPage(1);
  }

  async function handleDelete() {
    if (!pendingDelete || deleting) {
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    const result = await requestJson<null>(`/api/notes/${pendingDelete.id}`, {
      method: "DELETE",
    });

    setDeleting(false);

    if (!result.ok) {
      setDeleteError(describeFailure(result));
      return;
    }

    setPendingDelete(null);

    if (notes.length === 1 && page > 1) {
      setPage(page - 1);
    } else {
      reload();
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Notes"
        description="Every note you own, newest changes first. Move a note into a project to give it a home and a tag."
        action={
          <button
            type="button"
            onClick={() => setEditor("new")}
            className="btn btn-primary"
          >
            <PlusIcon className="h-4 w-4" />
            New note
          </button>
        }
      />

      <Toolbar>
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search notes"
          label="Search notes"
        />

        <SelectControl
          label="Filter by project"
          value={projectFilter}
          onChange={(value) => {
            setProjectFilter(value);
            setPage(1);
          }}
        >
          <option value="">All projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.title}
            </option>
          ))}
        </SelectControl>

        <SelectControl
          label="Filter by tag"
          value={tagFilter}
          onChange={(value) => {
            setTagFilter(value);
            setPage(1);
          }}
        >
          <option value="">All tags</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </SelectControl>

        <SelectControl
          label="Sort notes"
          value={sortValue}
          onChange={(value) => {
            setSortValue(value as SortValue);
            setPage(1);
          }}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectControl>
      </Toolbar>

      {projectsError || tagsError ? (
        <ErrorBanner
          message="Some project or tag names could not be loaded, so the list may be incomplete."
          onRetry={() => {
            reloadProjects();
            reloadTags();
          }}
        />
      ) : null}

      {error && !data ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : null}

      {showSkeleton ? (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <ListSkeleton />
        </div>
      ) : notes.length === 0 ? (
        <EmptyState
          icon={<NoteIcon className="h-5 w-5" />}
          title={filtered ? "No notes match these filters" : "No notes yet"}
          description={
            filtered
              ? "Try another search, or reset the filters to see every note."
              : "Start with a title and a few words. You can move it into a project later."
          }
          action={
            filtered ? (
              <button
                type="button"
                onClick={clearFilters}
                className="btn btn-secondary"
              >
                Clear filters
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setEditor("new")}
                className="btn btn-primary"
              >
                <PlusIcon className="h-4 w-4" />
                New note
              </button>
            )
          }
        />
      ) : (
        <section
          aria-label="Notes"
          aria-busy={loading}
          className={`overflow-hidden rounded-xl border border-line bg-surface transition-opacity ${
            loading ? "opacity-60" : ""
          }`}
        >
          <ul className="divide-y divide-line">
            {notes.map((note) => {
              const project = note.project_id
                ? projectById.get(note.project_id)
                : undefined;
              const tag = tagForNote(note);

              return (
                <li
                  key={note.id}
                  className="flex items-start justify-between gap-3 px-4 py-4 transition-colors hover:bg-mist/60"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary-strong">
                      <NoteIcon className="h-4 w-4" />
                    </span>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {note.title}
                      </p>

                      {note.description ? (
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">
                          {note.description}
                        </p>
                      ) : null}

                      <div className="mt-2 flex flex-wrap items-center gap-2">
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
                    </div>
                  </div>

                  <RowActions
                    label={`note ${note.title}`}
                    onEdit={() => setEditor(note)}
                    onDelete={() => {
                      setDeleteError(null);
                      setPendingDelete(note);
                    }}
                  />
                </li>
              );
            })}
          </ul>

          {data ? (
            <Pagination
              meta={data.meta}
              loading={loading}
              onPrevious={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => current + 1)}
            />
          ) : null}
        </section>
      )}

      {editor !== null ? (
        <NoteEditor
          note={editor === "new" ? null : editor}
          projects={projects}
          tags={tags}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            reload();
          }}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this note?"
          description={`“${pendingDelete.title}” and all of its sections will be deleted. This cannot be undone.`}
          confirmLabel="Delete note"
          pending={deleting}
          error={deleteError}
          onClose={() => {
            if (!deleting) {
              setPendingDelete(null);
            }
          }}
          onConfirm={handleDelete}
        />
      ) : null}
    </div>
  );
}

function NoteEditor({
  note,
  projects,
  tags,
  onClose,
  onSaved,
}: {
  note: Note | null;
  projects: Project[];
  tags: Tag[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [description, setDescription] = useState(note?.description ?? "");
  const [projectId, setProjectId] = useState(note?.project_id ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const tagById = new Map(tags.map((tag) => [tag.id, tag]));
  const selectedProject = projectId
    ? projects.find((project) => project.id === projectId)
    : undefined;
  const inheritedTag = selectedProject?.tag_id
    ? tagById.get(selectedProject.tag_id)
    : undefined;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setFieldErrors({ title: "Enter a title for the note." });
      return;
    }

    if (trimmedTitle.length > TITLE_MAX_LENGTH) {
      setFieldErrors({
        title: `Use ${TITLE_MAX_LENGTH} characters or fewer.`,
      });
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);

    const body = {
      title: trimmedTitle,
      description: description.trim() || null,
      project_id: projectId || null,
    };

    const result = note
      ? await requestJson<Note>(`/api/notes/${note.id}`, {
          method: "PATCH",
          body,
        })
      : await requestJson<Note>("/api/notes", {
          method: "POST",
          body,
        });

    if (!result.ok) {
      const nextErrors: Record<string, string> = {};

      for (const detail of result.details) {
        if (detail.field && !nextErrors[detail.field]) {
          nextErrors[detail.field] = detail.message;
        }
      }

      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
      } else {
        setFormError(describeFailure(result));
      }

      setSubmitting(false);
      return;
    }

    onSaved();
  }

  return (
    <Modal
      title={note ? "Edit note" : "New note"}
      description={
        note
          ? "Update the title, description, or the project this note belongs to."
          : "Capture the idea now — sections can be added later."
      }
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} noValidate>
        {formError ? (
          <ErrorBanner message={formError} className="mb-4" />
        ) : null}

        <div>
          <label htmlFor="note-title" className={labelClass}>
            Title
          </label>
          <input
            id="note-title"
            name="title"
            type="text"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setFieldErrors((current) => ({ ...current, title: "" }));
            }}
            maxLength={TITLE_MAX_LENGTH}
            placeholder="e.g. Launch checklist"
            aria-invalid={fieldErrors.title ? true : undefined}
            aria-describedby={fieldErrors.title ? "note-title-error" : undefined}
            className={inputClass}
          />
          <FieldError id="note-title-error">{fieldErrors.title}</FieldError>
        </div>

        <div className="mt-4">
          <label htmlFor="note-description" className={labelClass}>
            Description <span className="text-muted">(optional)</span>
          </label>
          <textarea
            id="note-description"
            name="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            placeholder="What is this note about?"
            aria-invalid={fieldErrors.description ? true : undefined}
            aria-describedby={
              fieldErrors.description ? "note-description-error" : undefined
            }
            className={textareaClass}
          />
          <FieldError id="note-description-error">
            {fieldErrors.description}
          </FieldError>
        </div>

        <div className="mt-4">
          <label htmlFor="note-project" className={labelClass}>
            Project <span className="text-muted">(optional)</span>
          </label>
          <select
            id="note-project"
            name="project_id"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            aria-invalid={fieldErrors.project_id ? true : undefined}
            aria-describedby={
              fieldErrors.project_id
                ? "note-project-error"
                : "note-project-hint"
            }
            className={selectClass}
          >
            <option value="">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
          <FieldError id="note-project-error">
            {fieldErrors.project_id}
          </FieldError>

          <p id="note-project-hint" className="mt-1.5 text-sm text-muted">
            {inheritedTag
              ? `This note will be tagged “${inheritedTag.name}”.`
              : selectedProject
                ? "This project has no tag, so the note stays untagged."
                : "Notes inherit the tag of their project."}
          </p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="btn btn-primary">
            {submitting ? "Saving…" : note ? "Save changes" : "Create note"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
