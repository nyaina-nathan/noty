import { ApiError, type ErrorDetail } from "@/lib/api/errors";
import {
  DEFAULT_PAGE,
  DEFAULT_PER_PAGE,
  MAX_PER_PAGE,
  SEARCH_MAX_LENGTH,
  isUuid,
  isRecord,
  parsePositiveInteger,
  readNullableString,
  readString,
  rejectUnknownFields,
  requireObject,
  throwIfInvalid,
} from "@/lib/api/validation";
import type {
  CreateNoteInput,
  ListNotesQuery,
  NoteSectionInput,
  NoteSortField,
  UpdateNoteInput,
} from "@/types/note.types";

const NOTE_TITLE_MAX_LENGTH = 255;
const NOTE_FIELDS = ["title", "description", "project_id"] as const;
const CREATE_NOTE_FIELDS = [
  "title",
  "description",
  "project_id",
  "sections",
] as const;
const SECTION_FIELDS = ["content", "note_order"] as const;
const NOTE_SORT_FIELDS: readonly NoteSortField[] = [
  "created_at",
  "updated_at",
  "title",
];

function validateTitle(value: string, details: ErrorDetail[]): string {
  const title = value.trim();

  if (title.length === 0) {
    details.push({ field: "title", message: "Must not be empty" });
  } else if (title.length > NOTE_TITLE_MAX_LENGTH) {
    details.push({
      field: "title",
      message: `Must be at most ${NOTE_TITLE_MAX_LENGTH} characters`,
    });
  }

  return title;
}

function readProjectId(
  input: Record<string, unknown>,
  details: ErrorDetail[],
): string | null {
  const rawProjectId = readNullableString(input, "project_id", details);

  if (rawProjectId === undefined || rawProjectId === null) {
    return null;
  }

  if (!isUuid(rawProjectId)) {
    details.push({ field: "project_id", message: "Must be a valid UUID" });
    return null;
  }

  return rawProjectId;
}

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

function readSectionContent(
  value: Record<string, unknown>,
  field: string,
  details: ErrorDetail[],
): string | null {
  const content = value.content;

  if (content === undefined || content === null) {
    return null;
  }

  if (typeof content !== "string") {
    details.push({
      field: `${field}.content`,
      message: "Must be a string or null",
    });
    return null;
  }

  return content;
}

function validateSectionInput(
  value: unknown,
  index: number,
  details: ErrorDetail[],
): NoteSectionInput {
  const field = `sections[${index}]`;
  const defaultOrder = index + 1;

  if (!isRecord(value)) {
    details.push({ field, message: "Must be an object" });
    return { content: null, note_order: defaultOrder };
  }

  rejectUnknownFields(value, SECTION_FIELDS, details);

  const content = readSectionContent(value, field, details);
  const noteOrder = readNoteOrder(
    value.note_order,
    `${field}.note_order`,
    details,
  );

  return {
    content,
    note_order: noteOrder ?? defaultOrder,
  };
}

function validateSections(
  input: Record<string, unknown>,
  details: ErrorDetail[],
): NoteSectionInput[] {
  const rawSections = input.sections;

  if (rawSections === undefined) {
    return [];
  }

  if (!Array.isArray(rawSections)) {
    details.push({ field: "sections", message: "Must be an array" });
    return [];
  }

  return rawSections.map((section, index) =>
    validateSectionInput(section, index, details),
  );
}

export function validateCreateNoteInput(body: unknown): CreateNoteInput {
  const input = requireObject(body);
  const details: ErrorDetail[] = [];

  rejectUnknownFields(input, CREATE_NOTE_FIELDS, details);

  const rawTitle = readString(input, "title", details, true);
  const title = rawTitle === undefined ? "" : validateTitle(rawTitle, details);

  const description = readNullableString(input, "description", details) ?? null;
  const projectId = readProjectId(input, details);
  const sections = validateSections(input, details);

  throwIfInvalid(details);

  return { title, description, project_id: projectId, sections };
}

export function validateUpdateNoteInput(body: unknown): UpdateNoteInput {
  const input = requireObject(body);
  const details: ErrorDetail[] = [];

  rejectUnknownFields(input, NOTE_FIELDS, details);

  const providedFields = NOTE_FIELDS.filter((field) =>
    Object.hasOwn(input, field),
  );

  if (providedFields.length === 0) {
    details.push({ message: "At least one field is required" });
  }

  const result: UpdateNoteInput = {};

  if (Object.hasOwn(input, "title")) {
    const rawTitle = readString(input, "title", details, false);

    if (rawTitle !== undefined) {
      result.title = validateTitle(rawTitle, details);
    }
  }

  if (Object.hasOwn(input, "description")) {
    const description = readNullableString(input, "description", details);

    if (description !== undefined) {
      result.description = description;
    }
  }

  if (Object.hasOwn(input, "project_id")) {
    result.project_id = readProjectId(input, details);
  }

  throwIfInvalid(details);

  return result;
}

export function validateNoteId(noteId: string): string {
  if (!isUuid(noteId)) {
    throw ApiError.notFound("Note not found");
  }

  return noteId;
}

export function validateListNotesQuery(
  searchParams: URLSearchParams,
): ListNotesQuery {
  const details: ErrorDetail[] = [];

  const page = parsePositiveInteger(
    searchParams.get("page"),
    "page",
    DEFAULT_PAGE,
    details,
  );
  const perPage = Math.min(
    parsePositiveInteger(
      searchParams.get("perPage"),
      "perPage",
      DEFAULT_PER_PAGE,
      details,
    ),
    MAX_PER_PAGE,
  );

  const rawSearch = searchParams.get("search");
  let search: string | null = null;

  if (rawSearch !== null) {
    const trimmedSearch = rawSearch.trim();

    if (trimmedSearch.length > SEARCH_MAX_LENGTH) {
      details.push({
        field: "search",
        message: `Must be at most ${SEARCH_MAX_LENGTH} characters`,
      });
    } else if (trimmedSearch.length > 0) {
      search = trimmedSearch;
    }
  }

  const rawProjectId = searchParams.get("project_id");
  let projectId: string | null = null;

  if (rawProjectId !== null) {
    if (!isUuid(rawProjectId)) {
      details.push({ field: "project_id", message: "Must be a valid UUID" });
    } else {
      projectId = rawProjectId;
    }
  }

  const rawTagId = searchParams.get("tag_id");
  let tagId: string | null = null;

  if (rawTagId !== null) {
    if (!isUuid(rawTagId)) {
      details.push({ field: "tag_id", message: "Must be a valid UUID" });
    } else {
      tagId = rawTagId;
    }
  }

  const rawSort = searchParams.get("sort") ?? "created_at";
  let sort: NoteSortField = "created_at";

  if (!NOTE_SORT_FIELDS.includes(rawSort as NoteSortField)) {
    details.push({
      field: "sort",
      message: "Must be one of: created_at, updated_at, title",
    });
  } else {
    sort = rawSort as NoteSortField;
  }

  const rawOrder = searchParams.get("order") ?? "desc";
  let order: "asc" | "desc" = "desc";

  if (rawOrder !== "asc" && rawOrder !== "desc") {
    details.push({ field: "order", message: "Must be one of: asc, desc" });
  } else {
    order = rawOrder;
  }

  throwIfInvalid(details);

  return {
    page,
    perPage,
    search,
    project_id: projectId,
    tag_id: tagId,
    sort,
    order,
  };
}
