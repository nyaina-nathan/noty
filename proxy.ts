import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth-cookie-names";

const LOGIN_PATH = "/login";

/**
 * Optimistic auth check for the dashboard: without an access token cookie the
 * user is sent to the login page. The pages and API routes still verify the
 * token themselves; this only avoids rendering a dashboard that cannot load.
 */
export function proxy(request: NextRequest) {
  const hasAccessToken = Boolean(
    request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
  );

  if (!hasAccessToken) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
