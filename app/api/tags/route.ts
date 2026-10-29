import { NextResponse, type NextRequest } from "next/server";
import { withApiErrorHandling } from "@/lib/api/handler";
import { readJsonBody } from "@/lib/api/request";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth-cookies";
import { createTag, listTags } from "@/services/tag.services";

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const tags = await listTags(
    request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
    request.nextUrl.searchParams,
  );

  return NextResponse.json(tags);
});

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const body = await readJsonBody(request);
  const tag = await createTag(
    request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
    body,
  );

  return NextResponse.json(tag, { status: 201 });
});
