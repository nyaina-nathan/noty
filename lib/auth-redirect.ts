import type { NextRequest } from "next/server";

export const LOGIN_PATH = "/login";
export const REGISTER_PATH = "/register";
export const DASHBOARD_PATH = "/dashboard";
export const REFRESH_PATH = "/api/auth/refresh";

/** Marks a session refresh that already failed, so auth pages stop retrying. */
export const SESSION_ENDED_PARAM = "session";
export const SESSION_ENDED_VALUE = "ended";

export function isAuthPage(pathname: string): boolean {
  return pathname === LOGIN_PATH || pathname === REGISTER_PATH;
}

/** True when a failed refresh already bounced the user back to an auth page. */
export function hasSessionEnded(request: NextRequest): boolean {
  return (
    request.nextUrl.searchParams.get(SESSION_ENDED_PARAM) === SESSION_ENDED_VALUE
  );
}

/** Sends the browser through the refresh endpoint, then on to `next`. */
export function buildRefreshUrl(request: NextRequest, next: string): URL {
  const url = new URL(REFRESH_PATH, request.url);
  url.searchParams.set("next", next);

  return url;
}

/** Login page flagged with the failed-refresh marker. */
export function buildSessionEndedUrl(request: NextRequest): URL {
  const url = new URL(LOGIN_PATH, request.url);
  url.searchParams.set(SESSION_ENDED_PARAM, SESSION_ENDED_VALUE);

  return url;
}

/**
 * Only same-origin absolute paths are allowed. Protocol-relative (`//host`)
 * and backslash variants (`/\host`) would redirect off-site.
 */
export function getSafeNextPath(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  ) {
    return DASHBOARD_PATH;
  }

  return value;
}
