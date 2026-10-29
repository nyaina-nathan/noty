"use client";

import { useState, type FormEvent } from "react";
import { requestJson } from "@/lib/api/client";
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

type ProjectFormModalProps = {
  project: Project | null;
  tags: Tag[];
  onClose: () => void;
  onSaved: (project: Project) => void;
};

export function ProjectFormModal({
  project,
  tags,
  onClose,
  onSaved,
}: ProjectFormModalProps) {
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

    onSaved(result.data);
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
