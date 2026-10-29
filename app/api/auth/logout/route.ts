import { NextResponse, type NextRequest } from "next/server";
import { withApiErrorHandling } from "@/lib/api/handler";
import { REFRESH_TOKEN_COOKIE, clearAuthCookies } from "@/lib/auth-cookies";
import { logoutUser } from "@/services/auth.services";

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  await logoutUser(request.cookies.get(REFRESH_TOKEN_COOKIE)?.value);

  const response = new NextResponse(null, { status: 204 });
  clearAuthCookies(response);

  return response;
});
