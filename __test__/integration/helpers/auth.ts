import { NextRequest } from "next/server";
import type { ApiHandler } from "@/lib/api/handler";

export const TEST_BASE_URL = "http://localhost:3000";

export type RouteHandler = (
  request: NextRequest,
  context: unknown,
) => Response | Promise<Response>;

export interface RequestOptions {
  method?: string;
  body?: unknown;
  rawBody?: string;
  cookies?: Record<string, string | undefined>;
  headers?: Record<string, string>;
}

export function jsonRequest(
  path: string,
  options: RequestOptions = {},
): NextRequest {
  const headers = new Headers({
    "user-agent": "noty-integration-test",
    "x-forwarded-for": "203.0.113.10",
    ...options.headers,
  });

  const cookieHeader = serializeCookies(options.cookies ?? {});

  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }

  let body: string | undefined;

  if (options.rawBody !== undefined) {
    body = options.rawBody;
    headers.set("content-type", "application/json");
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    headers.set("content-type", "application/json");
  }

  return new NextRequest(`${TEST_BASE_URL}${path}`, {
    method: options.method ?? "POST",
    headers,
    ...(body !== undefined ? { body } : {}),
  });
}

export async function callRoute<TContext = unknown>(
  handler: ApiHandler<TContext>,
  request: NextRequest,
  context?: TContext,
): Promise<Response> {
  return handler(request, context as TContext);
}

export function getCookie(
  response: Response,
  name: string,
): string | undefined {
  for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(";");
    const separator = pair.indexOf("=");

    if (separator === -1) {
      continue;
    }

    if (pair.slice(0, separator) === name) {
      return pair.slice(separator + 1);
    }
  }

  return undefined;
}

export function getSetCookie(
  response: Response,
  name: string,
): string | undefined {
  return response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith(`${name}=`));
}

function serializeCookies(
  cookies: Record<string, string | undefined>,
): string {
  return Object.entries(cookies)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}
