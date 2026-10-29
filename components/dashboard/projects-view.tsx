"use client";

import { useState, type FormEvent } from "react";
import { requestJson } from "@/lib/api/client";
import type { Project } from "@/types/project.types";
import type { Tag } from "@/types/tag.types";
import {
  describeFailure,
  useAllItems,
  useDebouncedValue,
  usePagedList,
} from "./hooks";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  FolderIcon,
  PlusIcon,
  TagIcon,
} from "./icons";
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
  inputClass,
  labelClass,
  selectClass,
  textareaClass,
} from "./ui";

const PER_PAGE = 10;
const TITLE_MAX_LENGTH = 255;

export function ProjectsView() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [tagFilter, setTagFilter] = useState("");
  const [editor, setEditor] = useState<Project | "new" | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const {
    items: tags,
    loading: tagsLoading,
    error: tagsError,
    reload: reloadTags,
  } = useAllItems<Tag>("/api/tags");

  const tagById = new Map(tags.map((tag) => [tag.id, tag]));

  const query = new URLSearchParams({
    page: String(page),
    perPage: String(PER_PAGE),
    order,
  });

  if (debouncedSearch) {
    query.set("search", debouncedSearch);
  }

  if (tagFilter) {
    query.set("tag_id", tagFilter);
  }

  const { data, loading, error, reload } = usePagedList<Project>(
    `/api/projects?${query.toString()}`,
  );

  const projects = data?.items ?? [];
  const filtered = debouncedSearch.length > 0 || tagFilter !== "";

  // Wait for tag names so the tag chips never flicker to "Untagged".
  const showSkeleton =
    (loading && !data) || (tagsLoading && projects.length > 0);

  async function handleDelete() {
    if (!pendingDelete || deleting) {
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    const result = await requestJson<null>(
      `/api/projects/${pendingDelete.id}`,
      { method: "DELETE" },
    );

    setDeleting(false);

    if (!result.ok) {
      setDeleteError(describeFailure(result));
      return;
    }

    setPendingDelete(null);

    if (projects.length === 1 && page > 1) {
      setPage(page - 1);
    } else {
      reload();
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Projects"
        description="Each project groups related notes and can carry one tag. Notes can belong to any project, or none at all."
        action={
          <button
            type="button"
            onClick={() => setEditor("new")}
            className="btn btn-primary"
          >
            <PlusIcon className="h-4 w-4" />
            New project
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
          placeholder="Search projects"
          label="Search projects"
        />

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

        <button
          type="button"
          onClick={() => {
            setOrder((current) => (current === "asc" ? "desc" : "asc"));
            setPage(1);
          }}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-mist"
        >
          {order === "asc" ? (
            <ArrowUpIcon className="h-4 w-4" />
          ) : (
            <ArrowDownIcon className="h-4 w-4" />
          )}
          {order === "asc" ? "A–Z" : "Z–A"}
        </button>
      </Toolbar>

      {tagsError ? (
        <ErrorBanner
          message={`Tag options could not be loaded. ${tagsError}`}
          onRetry={reloadTags}
        />
      ) : null}

      {error && !data ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : null}

      {showSkeleton ? (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <ListSkeleton />
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<FolderIcon className="h-5 w-5" />}
          title={filtered ? "No projects match these filters" : "No projects yet"}
          description={
            filtered
              ? "Try another search or reset the filters to see every project."
              : "Create a project to group notes around a topic. You can tag it for filtering."
          }
          action={
            filtered ? (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setTagFilter("");
                  setPage(1);
                }}
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
                New project
              </button>
            )
          }
        />
      ) : (
        <section
          aria-label="Projects"
          aria-busy={loading}
          className={`overflow-hidden rounded-xl border border-line bg-surface transition-opacity ${
            loading ? "opacity-60" : ""
          }`}
        >
          <ul className="divide-y divide-line">
            {projects.map((project) => {
              const tag = project.tag_id
                ? tagById.get(project.tag_id)
                : undefined;

              return (
                <li
                  key={project.id}
                  className="flex items-start justify-between gap-3 px-4 py-4 transition-colors hover:bg-mist/60"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary/10 text-secondary">
                      <FolderIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {project.title}
                      </p>
                      {project.description ? (
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">
                          {project.description}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-muted/70">
                          No description
                        </p>
                      )}
                      {tag ? (
                        <span className="chip mt-2">
                          <TagIcon className="mr-1 h-3 w-3" />
                          {tag.name}
                        </span>
                      ) : (
                        <span className="mt-2 inline-flex items-center rounded-md bg-mist px-2 py-0.5 font-mono text-[11px] text-muted">
                          Untagged
                        </span>
                      )}
                    </div>
                  </div>

                  <RowActions
                    label={`project ${project.title}`}
                    onEdit={() => setEditor(project)}
                    onDelete={() => {
                      setDeleteError(null);
                      setPendingDelete(project);
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
        <ProjectEditor
          project={editor === "new" ? null : editor}
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
          title="Delete this project?"
          description={`“${pendingDelete.title}” will be removed. Its notes stay, but they will no longer belong to a project or inherit its tag.`}
          confirmLabel="Delete project"
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

function ProjectEditor({
  project,
  tags,
  onClose,
  onSaved,
}: {
  project: Project | null;
  tags: Tag[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(project?.title ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [tagId, setTagId] = useState(project?.tag_id ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setFieldErrors({ title: "Enter a project title." });
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
      tag_id: tagId || null,
    };

    const result = project
      ? await requestJson<Project>(`/api/projects/${project.id}`, {
          method: "PATCH",
          body,
        })
      : await requestJson<Project>("/api/projects", {
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
      title={project ? "Edit project" : "New project"}
      description={
        project
          ? "Update the details or move the project to another tag."
          : "Give the project a title, then optionally add a description and tag."
      }
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} noValidate>
        {formError ? (
          <ErrorBanner message={formError} className="mb-4" />
        ) : null}

        <div>
          <label htmlFor="project-title" className={labelClass}>
            Title
          </label>
          <input
            id="project-title"
            name="title"
            type="text"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setFieldErrors((current) => ({ ...current, title: "" }));
            }}
            maxLength={TITLE_MAX_LENGTH}
            placeholder="e.g. Q4 launch"
            aria-invalid={fieldErrors.title ? true : undefined}
            aria-describedby={
              fieldErrors.title ? "project-title-error" : undefined
            }
            className={inputClass}
          />
          <FieldError id="project-title-error">{fieldErrors.title}</FieldError>
        </div>

        <div className="mt-4">
          <label htmlFor="project-description" className={labelClass}>
            Description <span className="text-muted">(optional)</span>
          </label>
          <textarea
            id="project-description"
            name="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="What is this project about?"
            aria-invalid={fieldErrors.description ? true : undefined}
            aria-describedby={
              fieldErrors.description
                ? "project-description-error"
                : undefined
            }
            className={textareaClass}
          />
          <FieldError id="project-description-error">
            {fieldErrors.description}
          </FieldError>
        </div>

        <div className="mt-4">
          <label htmlFor="project-tag" className={labelClass}>
            Tag <span className="text-muted">(optional)</span>
          </label>
          <select
            id="project-tag"
            name="tag_id"
            value={tagId}
            onChange={(event) => setTagId(event.target.value)}
            aria-invalid={fieldErrors.tag_id ? true : undefined}
            aria-describedby={
              fieldErrors.tag_id ? "project-tag-error" : "project-tag-hint"
            }
            className={selectClass}
          >
            <option value="">No tag</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
          <FieldError id="project-tag-error">{fieldErrors.tag_id}</FieldError>
          {!fieldErrors.tag_id ? (
            <p id="project-tag-hint" className="mt-1.5 text-sm text-muted">
              Notes in this project inherit the tag in the notes list.
            </p>
          ) : null}
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
            {submitting
              ? "Saving…"
              : project
                ? "Save changes"
                : "Create project"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
