import { NextResponse, type NextRequest } from "next/server";
import { withApiErrorHandling } from "@/lib/api/handler";
import { getSessionMetadata } from "@/lib/api/request";
import {
  REFRESH_TOKEN_COOKIE,
  setAccessTokenCookie,
  setRefreshTokenCookie,
} from "@/lib/auth-cookies";
import { refreshSession } from "@/services/auth.services";

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const { accessToken, refreshToken } = await refreshSession(
    request.cookies.get(REFRESH_TOKEN_COOKIE)?.value,
    getSessionMetadata(request),
  );

  const response = new NextResponse(null, { status: 204 });
  setAccessTokenCookie(response, accessToken);

  if (refreshToken !== null) {
    setRefreshTokenCookie(response, refreshToken);
  }

  return response;
});
