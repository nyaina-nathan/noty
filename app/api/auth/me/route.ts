import { NextResponse, type NextRequest } from "next/server";
import { withApiErrorHandling } from "@/lib/api/handler";
import { readJsonBody } from "@/lib/api/request";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth-cookies";
import {
  getCurrentUser,
  updateCurrentUser,
} from "@/services/auth.services";

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const user = await getCurrentUser(
    request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
  );

  return NextResponse.json(user);
});

export const PATCH = withApiErrorHandling(async (request: NextRequest) => {
  const body = await readJsonBody(request);
  const user = await updateCurrentUser(
    request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
    body,
  );

  return NextResponse.json(user);
});
