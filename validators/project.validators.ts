import { ApiError, type ErrorDetail } from "@/lib/api/errors";
import {
  DEFAULT_PAGE,
  DEFAULT_PER_PAGE,
  MAX_PER_PAGE,
  SEARCH_MAX_LENGTH,
  isUuid,
  parsePositiveInteger,
  readNullableString,
  readString,
  rejectUnknownFields,
  requireObject,
  throwIfInvalid,
} from "@/lib/api/validation";
import type {
  CreateProjectInput,
  ListProjectsQuery,
  UpdateProjectInput,
} from "@/types/project.types";

const PROJECT_TITLE_MAX_LENGTH = 255;
const PROJECT_FIELDS = ["title", "description", "tag_id"] as const;

function validateTitle(value: string, details: ErrorDetail[]): string {
  const title = value.trim();

  if (title.length === 0) {
    details.push({ field: "title", message: "Must not be empty" });
  } else if (title.length > PROJECT_TITLE_MAX_LENGTH) {
    details.push({
      field: "title",
      message: `Must be at most ${PROJECT_TITLE_MAX_LENGTH} characters`,
    });
  }

  return title;
}

function readTagId(
  input: Record<string, unknown>,
  details: ErrorDetail[],
): string | null {
  const rawTagId = readNullableString(input, "tag_id", details);

  if (rawTagId === undefined || rawTagId === null) {
    return null;
  }

  if (!isUuid(rawTagId)) {
    details.push({ field: "tag_id", message: "Must be a valid UUID" });
    return null;
  }

  return rawTagId;
}

export function validateCreateProjectInput(body: unknown): CreateProjectInput {
  const input = requireObject(body);
  const details: ErrorDetail[] = [];

  rejectUnknownFields(input, PROJECT_FIELDS, details);

  const rawTitle = readString(input, "title", details, true);
  const title = rawTitle === undefined ? "" : validateTitle(rawTitle, details);

  const description = readNullableString(input, "description", details) ?? null;
  const tagId = readTagId(input, details);

  throwIfInvalid(details);

  return { title, description, tag_id: tagId };
}

export function validateUpdateProjectInput(body: unknown): UpdateProjectInput {
  const input = requireObject(body);
  const details: ErrorDetail[] = [];

  rejectUnknownFields(input, PROJECT_FIELDS, details);

  const providedFields = PROJECT_FIELDS.filter((field) =>
    Object.hasOwn(input, field),
  );

  if (providedFields.length === 0) {
    details.push({ message: "At least one field is required" });
  }

  const result: UpdateProjectInput = {};

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

  if (Object.hasOwn(input, "tag_id")) {
    result.tag_id = readTagId(input, details);
  }

  throwIfInvalid(details);

  return result;
}

export function validateProjectId(projectId: string): string {
  if (!isUuid(projectId)) {
    throw ApiError.notFound("Project not found");
  }

  return projectId;
}

export function validateListProjectsQuery(
  searchParams: URLSearchParams,
): ListProjectsQuery {
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

  const rawTagId = searchParams.get("tag_id");
  let tagId: string | null = null;

  if (rawTagId !== null) {
    if (!isUuid(rawTagId)) {
      details.push({ field: "tag_id", message: "Must be a valid UUID" });
    } else {
      tagId = rawTagId;
    }
  }

  const rawSort = searchParams.get("sort") ?? "title";
  const sort = "title" as const;

  if (rawSort !== "title") {
    details.push({ field: "sort", message: "Must be one of: title" });
  }

  const rawOrder = searchParams.get("order") ?? "asc";
  let order: "asc" | "desc" = "asc";

  if (rawOrder !== "asc" && rawOrder !== "desc") {
    details.push({ field: "order", message: "Must be one of: asc, desc" });
  } else {
    order = rawOrder;
  }

  throwIfInvalid(details);

  return { page, perPage, search, tag_id: tagId, sort, order };
}
