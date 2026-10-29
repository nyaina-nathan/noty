import { ApiError, type ErrorDetail } from "@/lib/api/errors";
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  UpdateMeInput,
} from "@/types/auth.types";

const USERNAME_MAX_LENGTH = 255;
const EMAIL_MAX_LENGTH = 255;
const IDENTIFIER_MAX_LENGTH = 255;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function validateUsername(value: string, details: ErrorDetail[]): string {
  const username = value.trim();

  if (username.length === 0) {
    details.push({ field: "username", message: "Must not be empty" });
  } else if (username.length > USERNAME_MAX_LENGTH) {
    details.push({
      field: "username",
      message: `Must be at most ${USERNAME_MAX_LENGTH} characters`,
    });
  }

  return username;
}

function validateEmail(value: string, details: ErrorDetail[]): string {
  const email = value.trim().toLowerCase();

  if (email.length === 0) {
    details.push({ field: "email", message: "Must not be empty" });
  } else if (email.length > EMAIL_MAX_LENGTH) {
    details.push({
      field: "email",
      message: `Must be at most ${EMAIL_MAX_LENGTH} characters`,
    });
  } else if (!EMAIL_PATTERN.test(email)) {
    details.push({ field: "email", message: "Must be a valid email address" });
  }

  return email;
}

function validatePassword(
  value: string,
  details: ErrorDetail[],
  field: string,
  minLength: number,
): void {
  if (value.length < minLength) {
    details.push({
      field,
      message: `Must be at least ${minLength} characters`,
    });
  }

  if (Buffer.byteLength(value, "utf8") > PASSWORD_MAX_BYTES) {
    details.push({
      field,
      message: `Must be at most ${PASSWORD_MAX_BYTES} bytes`,
    });
  }
}

function throwIfInvalid(details: ErrorDetail[]): void {
  if (details.length > 0) {
    throw ApiError.validation(details);
  }
}

export function validateRegisterInput(body: unknown): RegisterInput {
  const input = requireObject(body);
  const details: ErrorDetail[] = [];

  rejectUnknownFields(input, ["username", "email", "password"], details);

  const rawUsername = readString(input, "username", details, true);
  const rawEmail = readString(input, "email", details, true);
  const rawPassword = readString(input, "password", details, true);

  const username =
    rawUsername === undefined ? "" : validateUsername(rawUsername, details);
  const email = rawEmail === undefined ? "" : validateEmail(rawEmail, details);

  if (rawPassword !== undefined) {
    validatePassword(rawPassword, details, "password", PASSWORD_MIN_LENGTH);
  }

  throwIfInvalid(details);

  return { username, email, password: rawPassword as string };
}

export function validateLoginInput(body: unknown): LoginInput {
  const input = requireObject(body);
  const details: ErrorDetail[] = [];

  rejectUnknownFields(input, ["identifier", "password"], details);

  const rawIdentifier = readString(input, "identifier", details, true);
  const rawPassword = readString(input, "password", details, true);

  let identifier = "";

  if (rawIdentifier !== undefined) {
    identifier = rawIdentifier.trim();

    if (identifier.length === 0) {
      details.push({ field: "identifier", message: "Must not be empty" });
    } else if (identifier.length > IDENTIFIER_MAX_LENGTH) {
      details.push({
        field: "identifier",
        message: `Must be at most ${IDENTIFIER_MAX_LENGTH} characters`,
      });
    }
  }

  if (rawPassword !== undefined) {
    validatePassword(rawPassword, details, "password", 1);
  }

  throwIfInvalid(details);

  return { identifier, password: rawPassword as string };
}

export function validateUpdateMeInput(body: unknown): UpdateMeInput {
  const input = requireObject(body);
  const details: ErrorDetail[] = [];

  rejectUnknownFields(input, ["username", "email"], details);

  const hasUsername = Object.prototype.hasOwnProperty.call(input, "username");
  const hasEmail = Object.prototype.hasOwnProperty.call(input, "email");

  if (!hasUsername && !hasEmail) {
    details.push({ message: "At least one of username or email is required" });
  }

  const rawUsername = hasUsername
    ? readString(input, "username", details, true)
    : undefined;
  const rawEmail = hasEmail
    ? readString(input, "email", details, true)
    : undefined;

  const username =
    rawUsername === undefined ? undefined : validateUsername(rawUsername, details);
  const email =
    rawEmail === undefined ? undefined : validateEmail(rawEmail, details);

  throwIfInvalid(details);

  return {
    ...(username !== undefined ? { username } : {}),
    ...(email !== undefined ? { email } : {}),
  };
}

export function validateChangePasswordInput(
  body: unknown,
): ChangePasswordInput {
  const input = requireObject(body);
  const details: ErrorDetail[] = [];

  rejectUnknownFields(input, ["currentPassword", "newPassword"], details);

  const rawCurrentPassword = readString(
    input,
    "currentPassword",
    details,
    true,
  );
  const rawNewPassword = readString(input, "newPassword", details, true);

  if (rawCurrentPassword !== undefined) {
    validatePassword(rawCurrentPassword, details, "currentPassword", 1);
  }

  if (rawNewPassword !== undefined) {
    validatePassword(rawNewPassword, details, "newPassword", PASSWORD_MIN_LENGTH);
  }

  throwIfInvalid(details);

  return {
    currentPassword: rawCurrentPassword as string,
    newPassword: rawNewPassword as string,
  };
}
