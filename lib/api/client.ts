import type { ErrorCode } from "./errors";

export type ApiFailure = {
  ok: false;
  status: number;
  code: ErrorCode;
  message: string;
  details: Array<{ field?: string; message: string }>;
};

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

type ErrorPayload = {
  error?: {
    code?: ErrorCode;
    message?: string;
    details?: Array<{ field?: string; message: string }>;
  };
};

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  /** Set to false to skip the one-time token refresh retry. Defaults to true. */
  allowRefresh?: boolean;
};

const REFRESH_URL = "/api/auth/refresh";
const UNREACHABLE_MESSAGE =
  "Could not reach the server. Check your connection and try again.";

function failure(
  status: number,
  code: ErrorCode,
  message: string,
  details: Array<{ field?: string; message: string }> = [],
): ApiFailure {
  return { ok: false, status, code, message, details };
}

async function send<T>(
  url: string,
  options: RequestOptions,
): Promise<ApiResult<T>> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      credentials: "same-origin",
      ...(options.body !== undefined
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(options.body),
          }
        : {}),
    });
  } catch {
    return failure(0, "INTERNAL_ERROR", UNREACHABLE_MESSAGE);
  }

  if (response.status === 204) {
    return { ok: true, data: undefined as T };
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (payload as ErrorPayload | null)?.error;

    return failure(
      response.status,
      error?.code ?? "INTERNAL_ERROR",
      error?.message ?? "Something went wrong. Please try again.",
      error?.details ?? [],
    );
  }

  return { ok: true, data: payload as T };
}

async function refreshAccessTokenOnce(): Promise<boolean> {
  try {
    const response = await fetch(REFRESH_URL, {
      method: "POST",
      credentials: "same-origin",
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Refresh tokens rotate. Parallel 401s must share one refresh call, otherwise
 * the second request would race the rotation and be rejected.
 */
let refreshInFlight: Promise<boolean> | null = null;

function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = refreshAccessTokenOnce().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

/**
 * Sends a JSON request from the browser and normalizes both success and
 * failure. An expired access token is refreshed once and the request is
 * retried before the failure is returned.
 */
export async function requestJson<T>(
  url: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const result = await send<T>(url, options);

  if (
    result.ok ||
    result.status !== 401 ||
    options.allowRefresh === false ||
    url === REFRESH_URL
  ) {
    return result;
  }

  if (!(await refreshAccessToken())) {
    return result;
  }

  return send<T>(url, { ...options, allowRefresh: false });
}

/** Sends a JSON POST from the browser and normalizes both success and failure. */
export async function postJson<T>(
  url: string,
  body: unknown,
  options: Omit<RequestOptions, "method" | "body"> = {},
): Promise<ApiResult<T>> {
  return requestJson<T>(url, { ...options, method: "POST", body });
}
