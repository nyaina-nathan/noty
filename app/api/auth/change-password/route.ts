import { NextResponse, type NextRequest } from "next/server";
import { withApiErrorHandling } from "@/lib/api/handler";
import { readJsonBody } from "@/lib/api/request";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/auth-cookies";
import { changePassword } from "@/services/auth.services";

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const body = await readJsonBody(request);

  await changePassword(
    request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
    request.cookies.get(REFRESH_TOKEN_COOKIE)?.value,
    body,
  );

  return new NextResponse(null, { status: 204 });
});
