"use client";

import { useState, type FormEvent } from "react";
import { requestJson } from "@/lib/api/client";
import type { Note } from "@/types/note.types";
import type { Project } from "@/types/project.types";
import type { Tag } from "@/types/tag.types";
import { describeFailure } from "./hooks";
import {
  ErrorBanner,
  FieldError,
  Modal,
  inputClass,
  labelClass,
  selectClass,
  textareaClass,
} from "./ui";

const TITLE_MAX_LENGTH = 255;

type NoteFormModalProps = {
  note: Note | null;
  projects: Project[];
  tags: Tag[];
  /** Pre-selects a project when creating a note. */
  defaultProjectId?: string;
  /** Pins a new note to its preset project instead of showing a picker. */
  lockProject?: boolean;
  onClose: () => void;
  onSaved: (note: Note) => void;
};

export function NoteFormModal({
  note,
  projects,
  tags,
  defaultProjectId,
  lockProject = false,
  onClose,
  onSaved,
}: NoteFormModalProps) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [description, setDescription] = useState(note?.description ?? "");
  const [projectId, setProjectId] = useState(
    note?.project_id ?? defaultProjectId ?? "",
  );
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

    onSaved(result.data);
  }

  return (
    <Modal
      title={note ? "Edit note details" : "New note"}
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
          {lockProject && !note ? (
            <>
              <span className={labelClass}>Project</span>
              <p className="mt-2 rounded-lg border border-line bg-mist/60 px-3 py-2.5 text-sm text-ink">
                {selectedProject ? selectedProject.title : "No project"}
              </p>
              <p className="mt-1.5 text-sm text-muted">
                {inheritedTag
                  ? `This note will be tagged “${inheritedTag.name}”.`
                  : "The note is added to this project. Write its sections next."}
              </p>
            </>
          ) : (
            <>
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
            </>
          )}
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
