import { NextResponse, type NextRequest } from "next/server";
import { withApiErrorHandling } from "@/lib/api/handler";
import { getSessionMetadata, readJsonBody } from "@/lib/api/request";
import { setAuthCookies } from "@/lib/auth-cookies";
import { registerUser } from "@/services/auth.services";

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const body = await readJsonBody(request);
  const { user, ...tokens } = await registerUser(
    body,
    getSessionMetadata(request),
  );

  const response = NextResponse.json(user, { status: 201 });
  setAuthCookies(response, tokens);

  return response;
});
