"use client";

import { useState } from "react";
import Link from "next/link";
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
import { NoteFormModal } from "./note-form-modal";
import {
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  ListSkeleton,
  PageHeader,
  Pagination,
  RowActions,
  SearchInput,
  SelectControl,
  Toolbar,
  formatDate,
} from "./ui";

const PER_PAGE = 10;


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

                  <div className="relative z-10">
                    <RowActions
                      label={`note ${note.title}`}
                      onEdit={() => setEditor(note)}
                      onDelete={() => {
                        setDeleteError(null);
                        setPendingDelete(note);
                      }}
                    />
                  </div>
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
        <NoteFormModal
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

