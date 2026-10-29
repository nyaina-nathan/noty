import { NextResponse, type NextRequest } from "next/server";
import {
  DASHBOARD_PATH,
  buildRefreshUrl,
  hasSessionEnded,
  isAuthPage,
} from "@/lib/auth-redirect";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth-cookie-names";
import { verifyAccessToken } from "@/lib/jwt";

/** Verifies the access token locally; the refresh endpoint handles rotation. */
async function hasValidAccessToken(request: NextRequest): Promise<boolean> {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken) {
    return false;
  }

  try {
    await verifyAccessToken(accessToken);
    return true;
  } catch {
    return false;
  }
}

/**
 * Optimistic auth check. Requests without a valid access token are routed
 * through the refresh endpoint, which rotates the tokens and forwards the
 * browser to the requested page. Auth pages skip that trip once a refresh
 * has already failed, so a signed-out user cannot bounce in a loop.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isAuthenticated = await hasValidAccessToken(request);

  if (isAuthPage(pathname)) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL(DASHBOARD_PATH, request.url));
    }

    if (hasSessionEnded(request)) {
      return NextResponse.next();
    }

    return NextResponse.redirect(buildRefreshUrl(request, DASHBOARD_PATH));
  }

  if (isAuthenticated) {
    return NextResponse.next();
  }

  return NextResponse.redirect(buildRefreshUrl(request, `${pathname}${search}`));
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/register"],
};
