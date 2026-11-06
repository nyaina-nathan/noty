"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/api/client";
import type { Note, NoteDetail } from "@/types/note.types";
import type { Project } from "@/types/project.types";
import type { Tag } from "@/types/tag.types";
import { describeFailure, useAllItems } from "./hooks";
import { ChevronLeftIcon, FolderIcon, PencilIcon, TagIcon } from "./icons";
import { NoteEditor } from "./note-editor";
import { NoteFormModal } from "./note-form-modal";
import { ErrorBanner, formatDate } from "./ui";

type ViewState = {
  key: string;
  note: NoteDetail | null;
  error: string | null;
};

export function NoteDetailView({ noteId }: { noteId: string }) {
  const router = useRouter();
  const [version, setVersion] = useState(0);
  const [view, setView] = useState<ViewState | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const { items: projects } = useAllItems<Project>("/api/projects");
  const { items: tags } = useAllItems<Tag>("/api/tags");

  const key = `${noteId}#${version}`;
  const loading = view?.key !== key;
  const note = view?.note ?? null;
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
          error: describeFailure(result),
        });
        return;
      }

      setView({
        key,
        note: result.data,
        error: null,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [noteId, key, router]);

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
          <NoteEditor
            key={`${note.id}#${version}`}
            note={note}
            onSaved={(updated: NoteDetail) => {
              setView((current) =>
                current?.note ? { ...current, note: updated } : current,
              );
            }}
          />
        </div>
      </article>

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
    </div>
  );
}
