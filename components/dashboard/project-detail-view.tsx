"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/api/client";
import type { Note } from "@/types/note.types";
import type { Project } from "@/types/project.types";
import type { Tag } from "@/types/tag.types";
import {
  describeFailure,
  useAllItems,
  useDebouncedValue,
  usePagedList,
} from "./hooks";
import {
  ChevronLeftIcon,
  FolderIcon,
  NoteIcon,
  PencilIcon,
  PlusIcon,
  TagIcon,
  TrashIcon,
} from "./icons";
import { NoteFormModal } from "./note-form-modal";
import { ProjectFormModal } from "./project-form-modal";
import {
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  ListSkeleton,
  Pagination,
  RowActions,
  SearchInput,
  SelectControl,
  Toolbar,
  formatDate,
} from "./ui";

const PER_PAGE = 10;

const SORT_OPTIONS = [
  { value: "updated_at:desc", label: "Recently updated" },
  { value: "created_at:desc", label: "Recently created" },
  { value: "title:asc", label: "Title A–Z" },
  { value: "title:desc", label: "Title Z–A" },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];
type NoteSortField = "created_at" | "updated_at" | "title";

type ProjectState = {
  key: string;
  project: Project | null;
  error: string | null;
};

export function ProjectDetailView({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<ProjectState | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortValue, setSortValue] = useState<SortValue>("updated_at:desc");
  const [projectEditorOpen, setProjectEditorOpen] = useState(false);
  const [noteEditor, setNoteEditor] = useState<Note | "new" | null>(null);
  const [pendingNoteDelete, setPendingNoteDelete] = useState<Note | null>(null);
  const [deletingNote, setDeletingNote] = useState(false);
  const [noteDeleteError, setNoteDeleteError] = useState<string | null>(null);
  const [confirmProjectDelete, setConfirmProjectDelete] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [projectDeleteError, setProjectDeleteError] = useState<string | null>(
    null,
  );

  const key = `${projectId}#${version}`;
  const loadingProject = state?.key !== key;
  const project = state?.project ?? null;
  const projectError = state?.error ?? null;

  useEffect(() => {
    let cancelled = false;

    requestJson<Project>(`/api/projects/${projectId}`).then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        if (result.status === 401) {
          router.replace("/login");
        }

        setState({ key, project: null, error: describeFailure(result) });
        return;
      }

      setState({ key, project: result.data, error: null });
    });

    return () => {
      cancelled = true;
    };
  }, [projectId, key, router]);

  const { items: tags } = useAllItems<Tag>("/api/tags");

  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [sort, order] = sortValue.split(":") as [
    NoteSortField,
    "asc" | "desc",
  ];

  const query = new URLSearchParams({
    project_id: projectId,
    page: String(page),
    perPage: String(PER_PAGE),
    sort,
    order,
  });

  if (debouncedSearch) {
    query.set("search", debouncedSearch);
  }

  const {
    data,
    loading: notesLoading,
    error: notesError,
    reload: reloadNotes,
  } = usePagedList<Note>(`/api/notes?${query.toString()}`);

  const notes = data?.items ?? [];
  const filtered = debouncedSearch.length > 0;
  const tag = project?.tag_id
    ? tags.find((item) => item.id === project.tag_id)
    : undefined;

  async function handleDeleteNote() {
    if (!pendingNoteDelete || deletingNote) {
      return;
    }

    setDeletingNote(true);
    setNoteDeleteError(null);

    const result = await requestJson<null>(
      `/api/notes/${pendingNoteDelete.id}`,
      { method: "DELETE" },
    );

    setDeletingNote(false);

    if (!result.ok) {
      if (result.status === 401) {
        router.replace("/login");
      }

      setNoteDeleteError(describeFailure(result));
      return;
    }

    setPendingNoteDelete(null);

    if (notes.length === 1 && page > 1) {
      setPage(page - 1);
    } else {
      reloadNotes();
    }
  }

  async function handleDeleteProject() {
    if (deletingProject) {
      return;
    }

    setDeletingProject(true);
    setProjectDeleteError(null);

    const result = await requestJson<null>(`/api/projects/${projectId}`, {
      method: "DELETE",
    });

    if (!result.ok) {
      if (result.status === 401) {
        router.replace("/login");
      }

      setProjectDeleteError(describeFailure(result));
      setDeletingProject(false);
      return;
    }

    router.push("/dashboard/projects");
    router.refresh();
  }

  if (loadingProject) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="h-5 w-28 rounded-full bg-mist" />
        <div className="rounded-2xl border border-line bg-surface px-5 py-6 sm:px-8">
          <div className="flex items-start gap-4">
            <div className="h-11 w-11 shrink-0 rounded-xl bg-mist" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="h-3 w-16 rounded-full bg-mist" />
              <div className="h-8 w-1/2 rounded-full bg-mist" />
              <div className="h-4 w-2/3 rounded-full bg-mist" />
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <ListSkeleton />
        </div>
        <span className="sr-only">Loading project…</span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/dashboard/projects"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          All projects
        </Link>

        <ErrorBanner
          message={projectError ?? "This project could not be loaded."}
          onRetry={() => setVersion((current) => current + 1)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard/projects"
          className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          All projects
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setProjectEditorOpen(true)}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-mist"
          >
            <PencilIcon className="h-4 w-4" />
            Edit project
          </button>
          <button
            type="button"
            onClick={() => {
              setProjectDeleteError(null);
              setConfirmProjectDelete(true);
            }}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-danger-strong transition-colors hover:border-danger/40 hover:bg-danger/10"
          >
            <TrashIcon className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      <header className="rounded-2xl border border-line bg-surface px-5 py-6 shadow-sm sm:px-8">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary/10 text-secondary">
            <FolderIcon className="h-5 w-5" />
          </span>

          <div className="min-w-0">
            <p className="eyebrow">Project</p>
            <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              {project.title}
            </h1>

            {project.description ? (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                {project.description}
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted/70">
                No description yet. Use “Edit project” to add one.
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {tag ? (
                <span className="chip">
                  <TagIcon className="mr-1 h-3 w-3" />
                  {tag.name}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-md bg-mist px-2 py-0.5 font-mono text-[11px] text-muted">
                  Untagged
                </span>
              )}

              <span className="font-mono text-[11px] text-muted">
                {data?.meta.total ?? 0}{" "}
                {(data?.meta.total ?? 0) === 1 ? "note" : "notes"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <section aria-labelledby="project-notes-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="project-notes-heading"
              className="font-display text-xl font-semibold tracking-tight"
            >
              Notes
            </h2>
            <p className="mt-1 text-sm text-muted">
              Every note in this project. Open one to read and edit its
              sections.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setNoteEditor("new")}
            className="btn btn-primary"
          >
            <PlusIcon className="h-4 w-4" />
            New note
          </button>
        </div>

        <Toolbar>
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search notes in this project"
            label="Search notes in this project"
          />

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

        {notesError && !data ? (
          <ErrorBanner message={notesError} onRetry={reloadNotes} />
        ) : null}

        {notesLoading && !data ? (
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <ListSkeleton />
          </div>
        ) : notes.length === 0 ? (
          <EmptyState
            icon={<NoteIcon className="h-5 w-5" />}
            title={filtered ? "No notes match this search" : "No notes yet"}
            description={
              filtered
                ? "Try a different search, or clear it to see every note in this project."
                : "Add the first note to this project, then write it section by section."
            }
            action={
              filtered ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  className="btn btn-secondary"
                >
                  Clear search
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setNoteEditor("new")}
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
            aria-label="Notes in this project"
            aria-busy={notesLoading}
            className={`overflow-hidden rounded-xl border border-line bg-surface transition-opacity ${
              notesLoading ? "opacity-60" : ""
            }`}
          >
            <ul className="divide-y divide-line">
              {notes.map((note) => (
                <li
                  key={note.id}
                  className="relative flex items-start justify-between gap-3 px-4 py-4 transition-colors hover:bg-mist/60"
                >
                  <Link
                    href={`/dashboard/notes/${note.id}`}
                    aria-label={`Open note ${note.title}`}
                    className="absolute inset-0 z-0"
                  />

                  <div className="pointer-events-none relative z-10 flex min-w-0 items-start gap-3">
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

                      <span className="mt-2 block font-mono text-[11px] text-muted">
                        {note.updated_at ? "Updated" : "Created"}{" "}
                        {formatDate(note.updated_at ?? note.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className="relative z-10">
                    <RowActions
                      label={`note ${note.title}`}
                      onEdit={() => setNoteEditor(note)}
                      onDelete={() => {
                        setNoteDeleteError(null);
                        setPendingNoteDelete(note);
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>

            {data ? (
              <Pagination
                meta={data.meta}
                loading={notesLoading}
                onPrevious={() =>
                  setPage((current) => Math.max(1, current - 1))
                }
                onNext={() => setPage((current) => current + 1)}
              />
            ) : null}
          </section>
        )}
      </section>

      {projectEditorOpen ? (
        <ProjectFormModal
          project={project}
          tags={tags}
          onClose={() => setProjectEditorOpen(false)}
          onSaved={(updated) => {
            setState({ key, project: updated, error: null });
            setProjectEditorOpen(false);
          }}
        />
      ) : null}

      {noteEditor !== null ? (
        <NoteFormModal
          note={noteEditor === "new" ? null : noteEditor}
          projects={[project]}
          tags={tags}
          defaultProjectId={project.id}
          lockProject
          onClose={() => setNoteEditor(null)}
          onSaved={() => {
            setNoteEditor(null);

            if (page === 1) {
              reloadNotes();
            } else {
              setPage(1);
            }
          }}
        />
      ) : null}

      {pendingNoteDelete ? (
        <ConfirmDialog
          title="Delete this note?"
          description={`“${pendingNoteDelete.title}” and all of its sections will be deleted. This cannot be undone.`}
          confirmLabel="Delete note"
          pending={deletingNote}
          error={noteDeleteError}
          onClose={() => {
            if (!deletingNote) {
              setPendingNoteDelete(null);
            }
          }}
          onConfirm={handleDeleteNote}
        />
      ) : null}

      {confirmProjectDelete ? (
        <ConfirmDialog
          title="Delete this project?"
          description={`“${project.title}” will be removed. Its notes stay, but they will no longer belong to a project or inherit its tag.`}
          confirmLabel="Delete project"
          pending={deletingProject}
          error={projectDeleteError}
          onClose={() => {
            if (!deletingProject) {
              setConfirmProjectDelete(false);
            }
          }}
          onConfirm={handleDeleteProject}
        />
      ) : null}
    </div>
  );
}
