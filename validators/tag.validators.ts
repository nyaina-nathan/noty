import { ApiError, type ErrorDetail } from "@/lib/api/errors";
import type {
  CreateTagInput,
  ListTagsQuery,
  UpdateTagInput,
} from "@/types/tag.types";

const TAG_NAME_MAX_LENGTH = 255;
const SEARCH_MAX_LENGTH = 255;
const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireObject(body: unknown): Record<string, unknown> {
  if (!isRecord(body)) {
    throw ApiError.validation([
      { message: "Request body must be a JSON object" },
    ]);
  }

  return body;
}

function rejectUnknownFields(
  body: Record<string, unknown>,
  allowed: readonly string[],
  details: ErrorDetail[],
): void {
  for (const field of Object.keys(body)) {
    if (!allowed.includes(field)) {
      details.push({ field, message: "Unknown field" });
    }
  }
}

function readString(
  body: Record<string, unknown>,
  field: string,
  details: ErrorDetail[],
  required: boolean,
): string | undefined {
  const value = body[field];

  if (value === undefined) {
    if (required) {
      details.push({ field, message: "Is required" });
    }

    return undefined;
  }

  if (typeof value !== "string") {
    details.push({ field, message: "Must be a string" });
    return undefined;
  }

  return value;
}

function validateName(value: string, details: ErrorDetail[]): string {
  const name = value.trim();

  if (name.length === 0) {
    details.push({ field: "name", message: "Must not be empty" });
  } else if (name.length > TAG_NAME_MAX_LENGTH) {
    details.push({
      field: "name",
      message: `Must be at most ${TAG_NAME_MAX_LENGTH} characters`,
    });
  }

  return name;
}

function throwIfInvalid(details: ErrorDetail[]): void {
  if (details.length > 0) {
    throw ApiError.validation(details);
  }
}

function parsePositiveInteger(
  raw: string | null,
  field: string,
  fallback: number,
  details: ErrorDetail[],
): number {
  if (raw === null) {
    return fallback;
  }

  if (!/^\d+$/.test(raw)) {
    details.push({ field, message: "Must be a positive integer" });
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isSafeInteger(value) || value < 1) {
    details.push({ field, message: "Must be a positive integer" });
    return fallback;
  }

  return value;
}

export function validateCreateTagInput(body: unknown): CreateTagInput {
  const input = requireObject(body);
  const details: ErrorDetail[] = [];

  rejectUnknownFields(input, ["name"], details);

  const rawName = readString(input, "name", details, true);
  const name = rawName === undefined ? "" : validateName(rawName, details);

  throwIfInvalid(details);

  return { name };
}

export function validateUpdateTagInput(body: unknown): UpdateTagInput {
  return validateCreateTagInput(body);
}

export function validateTagId(tagId: string): string {
  if (!UUID_PATTERN.test(tagId)) {
    throw ApiError.notFound("Tag not found");
  }

  return tagId;
}

export function validateListTagsQuery(
  searchParams: URLSearchParams,
): ListTagsQuery {
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

  const rawSort = searchParams.get("sort") ?? "name";
  const sort = "name" as const;

  if (rawSort !== "name") {
    details.push({ field: "sort", message: "Must be one of: name" });
  }

  const rawOrder = searchParams.get("order") ?? "asc";
  let order: "asc" | "desc" = "asc";

  if (rawOrder !== "asc" && rawOrder !== "desc") {
    details.push({ field: "order", message: "Must be one of: asc, desc" });
  } else {
    order = rawOrder;
  }

  throwIfInvalid(details);

  return { page, perPage, search, sort, order };
}
