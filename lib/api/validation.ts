import { ApiError, type ErrorDetail } from "@/lib/api/errors";

export const SEARCH_MAX_LENGTH = 255;
export const DEFAULT_PAGE = 1;
export const DEFAULT_PER_PAGE = 20;
export const MAX_PER_PAGE = 100;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function requireObject(body: unknown): Record<string, unknown> {
  if (!isRecord(body)) {
    throw ApiError.validation([
      { message: "Request body must be a JSON object" },
    ]);
  }

  return body;
}

export function rejectUnknownFields(
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

export function readString(
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

export function readNullableString(
  body: Record<string, unknown>,
  field: string,
  details: ErrorDetail[],
): string | null | undefined {
  const value = body[field];

  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    details.push({ field, message: "Must be a string or null" });
    return undefined;
  }

  return value;
}

export function throwIfInvalid(details: ErrorDetail[]): void {
  if (details.length > 0) {
    throw ApiError.validation(details);
  }
}

export function parsePositiveInteger(
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

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
