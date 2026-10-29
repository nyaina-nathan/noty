"use client";

import { useState, type FormEvent } from "react";
import { requestJson } from "@/lib/api/client";
import type { Tag } from "@/types/tag.types";
import {
  describeFailure,
  useDebouncedValue,
  usePagedList,
} from "./hooks";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TagIcon } from "./icons";
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
  Toolbar,
  inputClass,
  labelClass,
} from "./ui";

const PER_PAGE = 10;
const NAME_MAX_LENGTH = 255;

export function TagsView() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [editor, setEditor] = useState<Tag | "new" | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Tag | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const query = new URLSearchParams({
    page: String(page),
    perPage: String(PER_PAGE),
    order,
  });

  if (debouncedSearch) {
    query.set("search", debouncedSearch);
  }

  const { data, loading, error, reload } = usePagedList<Tag>(
    `/api/tags?${query.toString()}`,
  );

  const tags = data?.items ?? [];
  const filtered = debouncedSearch.length > 0;

  async function handleDelete() {
    if (!pendingDelete || deleting) {
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    const result = await requestJson<null>(`/api/tags/${pendingDelete.id}`, {
      method: "DELETE",
    });

    setDeleting(false);

    if (!result.ok) {
      setDeleteError(describeFailure(result));
      return;
    }

    setPendingDelete(null);

    if (tags.length === 1 && page > 1) {
      setPage(page - 1);
    } else {
      reload();
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Tags"
        description="Tags label projects, and every note in a project inherits its tag. Keep the list short and specific."
        action={
          <button
            type="button"
            onClick={() => setEditor("new")}
            className="btn btn-primary"
          >
            <PlusIcon className="h-4 w-4" />
            New tag
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
          placeholder="Search tags"
          label="Search tags"
        />

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

      {error && !data ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : null}

      {loading && !data ? (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <ListSkeleton />
        </div>
      ) : tags.length === 0 ? (
        <EmptyState
          icon={<TagIcon className="h-5 w-5" />}
          title={filtered ? "No tags match your search" : "No tags yet"}
          description={
            filtered
              ? "Try a different word, or clear the search to see everything."
              : "Create a tag such as “planning” or “research”, then attach it to a project."
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
                onClick={() => setEditor("new")}
                className="btn btn-primary"
              >
                <PlusIcon className="h-4 w-4" />
                New tag
              </button>
            )
          }
        />
      ) : (
        <section
          aria-label="Tags"
          aria-busy={loading}
          className={`overflow-hidden rounded-xl border border-line bg-surface transition-opacity ${
            loading ? "opacity-60" : ""
          }`}
        >
          <ul className="divide-y divide-line">
            {tags.map((tag) => (
              <li
                key={tag.id}
                className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-mist/60"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary-strong">
                    <TagIcon className="h-4 w-4" />
                  </span>
                  <p className="min-w-0 truncate text-sm font-medium text-ink">
                    {tag.name}
                  </p>
                </div>

                <RowActions
                  label={`tag ${tag.name}`}
                  onEdit={() => setEditor(tag)}
                  onDelete={() => {
                    setDeleteError(null);
                    setPendingDelete(tag);
                  }}
                />
              </li>
            ))}
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
        <TagEditor
          tag={editor === "new" ? null : editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            reload();
          }}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this tag?"
          description={`“${pendingDelete.name}” will be removed from every project that uses it. The projects and their notes stay where they are.`}
          confirmLabel="Delete tag"
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

function TagEditor({
  tag,
  onClose,
  onSaved,
}: {
  tag: Tag | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(tag?.name ?? "");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const trimmed = name.trim();

    if (!trimmed) {
      setFieldError("Enter a name for the tag.");
      return;
    }

    if (trimmed.length > NAME_MAX_LENGTH) {
      setFieldError(`Use ${NAME_MAX_LENGTH} characters or fewer.`);
      return;
    }

    setSubmitting(true);
    setFieldError(null);
    setFormError(null);

    const result = tag
      ? await requestJson<Tag>(`/api/tags/${tag.id}`, {
          method: "PATCH",
          body: { name: trimmed },
        })
      : await requestJson<Tag>("/api/tags", {
          method: "POST",
          body: { name: trimmed },
        });

    if (!result.ok) {
      const detail = result.details.find((item) => item.field === "name");

      if (detail) {
        setFieldError(detail.message);
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
      title={tag ? "Rename tag" : "New tag"}
      description={
        tag
          ? "Projects using this tag will show the new name."
          : "A short label you can attach to a project."
      }
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} noValidate>
        {formError ? (
          <ErrorBanner message={formError} className="mb-4" />
        ) : null}

        <label htmlFor="tag-name" className={labelClass}>
          Name
        </label>
        <input
          id="tag-name"
          name="name"
          type="text"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setFieldError(null);
          }}
          maxLength={NAME_MAX_LENGTH}
          autoComplete="off"
          placeholder="e.g. planning"
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? "tag-name-error" : undefined}
          className={inputClass}
        />
        <FieldError id="tag-name-error">{fieldError}</FieldError>

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
            {submitting ? "Saving…" : tag ? "Save changes" : "Create tag"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
