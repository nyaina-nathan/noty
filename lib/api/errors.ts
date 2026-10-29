export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "INVALID_CREDENTIALS",
  "TOKEN_EXPIRED",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ErrorDetail {
  field?: string;
  message: string;
}

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
  };
}

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  INVALID_CREDENTIALS: 401,
  TOKEN_EXPIRED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: ErrorDetail[];

  constructor(code: ErrorCode, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }

  toJSON(): ErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details?.length ? { details: this.details } : {}),
      },
    };
  }

  static validation(
    details?: ErrorDetail[],
    message = "Invalid input",
  ): ApiError {
    return new ApiError("VALIDATION_ERROR", message, details);
  }

  static unauthorized(message = "Authentication required"): ApiError {
    return new ApiError("UNAUTHORIZED", message);
  }

  static invalidCredentials(message = "Invalid credentials"): ApiError {
    return new ApiError("INVALID_CREDENTIALS", message);
  }

  static tokenExpired(message = "Session expired"): ApiError {
    return new ApiError("TOKEN_EXPIRED", message);
  }

  static notFound(message = "Resource not found"): ApiError {
    return new ApiError("NOT_FOUND", message);
  }

  static conflict(message = "Resource already exists"): ApiError {
    return new ApiError("CONFLICT", message);
  }

  static rateLimited(message = "Too many attempts, try again later"): ApiError {
    return new ApiError("RATE_LIMITED", message);
  }

  static internal(message = "Internal server error"): ApiError {
    return new ApiError("INTERNAL_ERROR", message);
  }
}
