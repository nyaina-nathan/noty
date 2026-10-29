import { ApiError, type ErrorDetail } from "@/lib/api/errors";
import {
  isUuid,
  readNullableString,
  rejectUnknownFields,
  requireObject,
  throwIfInvalid,
} from "@/lib/api/validation";
import type {
  CreateNoteSectionInput,
  ListNoteSectionsQuery,
  ReorderNoteSectionsInput,
  UpdateNoteSectionInput,
} from "@/types/note-section.types";

const NOTE_SECTION_FIELDS = ["content", "note_order"] as const;
const REORDER_FIELDS = ["sectionIds"] as const;

function readNoteOrder(
  value: unknown,
  field: string,
  details: ErrorDetail[],
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    details.push({ field, message: "Must be a positive integer" });
    return undefined;
  }

  return value;
}

function readSectionIds(
  value: unknown,
  details: ErrorDetail[],
): string[] {
  if (value === undefined) {
    details.push({ field: "sectionIds", message: "Is required" });
    return [];
  }

  if (!Array.isArray(value)) {
    details.push({ field: "sectionIds", message: "Must be an array" });
    return [];
  }

  if (value.length === 0) {
    details.push({ field: "sectionIds", message: "Must not be empty" });
    return [];
  }

  const sectionIds: string[] = [];
  const seen = new Set<string>();

  value.forEach((sectionId, index) => {
    const field = `sectionIds[${index}]`;

    if (typeof sectionId !== "string" || !isUuid(sectionId)) {
      details.push({ field, message: "Must be a valid UUID" });
      return;
    }

    const normalized = sectionId.toLowerCase();

    if (seen.has(normalized)) {
      details.push({ field, message: "Must not contain duplicates" });
      return;
    }

    seen.add(normalized);
    sectionIds.push(sectionId);
  });

  return sectionIds;
}

export function validateCreateNoteSectionInput(
  body: unknown,
): CreateNoteSectionInput {
  const input = requireObject(body);
  const details: ErrorDetail[] = [];

  rejectUnknownFields(input, NOTE_SECTION_FIELDS, details);

  const content = readNullableString(input, "content", details) ?? null;
  const noteOrder = readNoteOrder(input.note_order, "note_order", details);

  throwIfInvalid(details);

  return { content, note_order: noteOrder };
}

export function validateUpdateNoteSectionInput(
  body: unknown,
): UpdateNoteSectionInput {
  const input = requireObject(body);
  const details: ErrorDetail[] = [];

  rejectUnknownFields(input, NOTE_SECTION_FIELDS, details);

  const providedFields = NOTE_SECTION_FIELDS.filter((field) =>
    Object.hasOwn(input, field),
  );

  if (providedFields.length === 0) {
    details.push({ message: "At least one field is required" });
  }

  const result: UpdateNoteSectionInput = {};

  if (Object.hasOwn(input, "content")) {
    const content = readNullableString(input, "content", details);

    if (content !== undefined) {
      result.content = content;
    }
  }

  if (Object.hasOwn(input, "note_order")) {
    const noteOrder = readNoteOrder(input.note_order, "note_order", details);

    if (noteOrder !== undefined) {
      result.note_order = noteOrder;
    }
  }

  throwIfInvalid(details);

  return result;
}

export function validateReorderNoteSectionsInput(
  body: unknown,
): ReorderNoteSectionsInput {
  const input = requireObject(body);
  const details: ErrorDetail[] = [];

  rejectUnknownFields(input, REORDER_FIELDS, details);

  const sectionIds = readSectionIds(input.sectionIds, details);

  throwIfInvalid(details);

  return { sectionIds };
}

export function validateSectionId(sectionId: string): string {
  if (!isUuid(sectionId)) {
    throw ApiError.notFound("Note section not found");
  }

  return sectionId;
}

export function validateListNoteSectionsQuery(
  searchParams: URLSearchParams,
): ListNoteSectionsQuery {
  const details: ErrorDetail[] = [];

  const rawOrder = searchParams.get("order") ?? "asc";
  let order: "asc" | "desc" = "asc";

  if (rawOrder !== "asc" && rawOrder !== "desc") {
    details.push({ field: "order", message: "Must be one of: asc, desc" });
  } else {
    order = rawOrder;
  }

  throwIfInvalid(details);

  return { order };
}
