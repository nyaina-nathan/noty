import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { withApiErrorHandling } from "@/lib/api/handler";
import { getSessionMetadata } from "@/lib/api/request";
import { buildSessionEndedUrl, getSafeNextPath } from "@/lib/auth-redirect";
import {
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
  setAccessTokenCookie,
  setRefreshTokenCookie,
} from "@/lib/auth-cookies";
import { refreshSession } from "@/services/auth.services";

function rotateSession(request: NextRequest) {
  return refreshSession(
    request.cookies.get(REFRESH_TOKEN_COOKIE)?.value,
    getSessionMetadata(request),
  );
}

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const { accessToken, refreshToken } = await rotateSession(request);

  const response = new NextResponse(null, { status: 204 });
  setAccessTokenCookie(response, accessToken);

  if (refreshToken !== null) {
    setRefreshTokenCookie(response, refreshToken);
  }

  return response;
});

/**
 * Browser navigation entry point used by the proxy: refreshes the session and
 * forwards to `next`, or clears the cookies and returns to the login page so
 * the auth pages can render the signed-out form.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const next = getSafeNextPath(request.nextUrl.searchParams.get("next"));

  try {
    const { accessToken, refreshToken } = await rotateSession(request);

    const response = NextResponse.redirect(new URL(next, request.url));
    setAccessTokenCookie(response, accessToken);

    if (refreshToken !== null) {
      setRefreshTokenCookie(response, refreshToken);
    }

    return response;
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error(error);
    }

    const response = NextResponse.redirect(buildSessionEndedUrl(request));
    clearAuthCookies(response);

    return response;
  }
}
