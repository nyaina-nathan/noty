import { ApiError, type ErrorDetail } from "@/lib/api/errors";
import {
  DEFAULT_PAGE,
  DEFAULT_PER_PAGE,
  MAX_PER_PAGE,
  SEARCH_MAX_LENGTH,
  isUuid,
  parsePositiveInteger,
  readString,
  rejectUnknownFields,
  requireObject,
  throwIfInvalid,
} from "@/lib/api/validation";
import type {
  CreateTagInput,
  ListTagsQuery,
  UpdateTagInput,
} from "@/types/tag.types";

const TAG_NAME_MAX_LENGTH = 255;

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
  if (!isUuid(tagId)) {
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
