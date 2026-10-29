import { NextResponse, type NextRequest } from "next/server";
import { withApiErrorHandling } from "@/lib/api/handler";
import { readJsonBody } from "@/lib/api/request";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth-cookies";
import { deleteTag, getTag, updateTag } from "@/services/tag.services";

type TagRouteContext = {
  params: Promise<{ tagId: string }>;
};

export const GET = withApiErrorHandling<TagRouteContext>(
  async (request: NextRequest, { params }) => {
    const { tagId } = await params;
    const tag = await getTag(
      request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
      tagId,
    );

    return NextResponse.json(tag);
  },
);

export const PATCH = withApiErrorHandling<TagRouteContext>(
  async (request: NextRequest, { params }) => {
    const { tagId } = await params;
    const body = await readJsonBody(request);
    const tag = await updateTag(
      request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
      tagId,
      body,
    );

    return NextResponse.json(tag);
  },
);

export const DELETE = withApiErrorHandling<TagRouteContext>(
  async (request: NextRequest, { params }) => {
    const { tagId } = await params;

    await deleteTag(
      request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
      tagId,
    );

    return new Response(null, { status: 204 });
  },
);
