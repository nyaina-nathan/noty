import type { NextRequest } from "next/server";

export const LOGIN_PATH = "/login";
export const REGISTER_PATH = "/register";
export const DASHBOARD_PATH = "/dashboard";
export const REFRESH_PATH = "/api/auth/refresh";

/** Marks a session refresh that already failed, so auth pages stop retrying. */
export const SESSION_ENDED_PARAM = "session";
export const SESSION_ENDED_VALUE = "ended";

/** Auth page to return to when the refresh attempt fails. */
export const FALLBACK_PARAM = "fallback";

export function isAuthPage(pathname: string): boolean {
  return pathname === LOGIN_PATH || pathname === REGISTER_PATH;
}

/** True when a failed refresh already bounced the user back to an auth page. */
export function hasSessionEnded(request: NextRequest): boolean {
  return (
    request.nextUrl.searchParams.get(SESSION_ENDED_PARAM) === SESSION_ENDED_VALUE
  );
}

/**
 * Sends the browser through the refresh endpoint, then on to `next`. When the
 * refresh fails the browser is returned to `fallback`.
 */
export function buildRefreshUrl(
  request: NextRequest,
  next: string,
  fallback: string = LOGIN_PATH,
): URL {
  const url = new URL(REFRESH_PATH, request.url);
  url.searchParams.set("next", next);
  url.searchParams.set(FALLBACK_PARAM, fallback);

  return url;
}

/** Auth page flagged with the failed-refresh marker. */
export function buildSessionEndedUrl(
  request: NextRequest,
  fallback: string = LOGIN_PATH,
): URL {
  const url = new URL(fallback, request.url);
  url.searchParams.set(SESSION_ENDED_PARAM, SESSION_ENDED_VALUE);

  return url;
}

/** A failed refresh may only return to an auth page. */
export function getSafeFallbackPath(value: string | null): string {
  return value !== null && isAuthPage(value) ? value : LOGIN_PATH;
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
