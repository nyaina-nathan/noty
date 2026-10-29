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

/** Sends a JSON POST from the browser and normalizes both success and failure. */
export async function postJson<T>(
  url: string,
  body: unknown,
): Promise<ApiResult<T>> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch {
    return {
      ok: false,
      status: 0,
      code: "INTERNAL_ERROR",
      message: "Could not reach the server. Check your connection and try again.",
      details: [],
    };
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (payload as ErrorPayload | null)?.error;

    return {
      ok: false,
      status: response.status,
      code: error?.code ?? "INTERNAL_ERROR",
      message: error?.message ?? "Something went wrong. Please try again.",
      details: error?.details ?? [],
    };
  }

  return { ok: true, data: payload as T };
}
