import { NextResponse, type NextRequest } from "next/server";
import { withApiErrorHandling } from "@/lib/api/handler";
import { readJsonBody } from "@/lib/api/request";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth-cookies";
import {
  createNoteSection,
  listNoteSections,
} from "@/services/note-section.services";

type NoteSectionsRouteContext = {
  params: Promise<{ noteId: string }>;
};

export const GET = withApiErrorHandling<NoteSectionsRouteContext>(
  async (request: NextRequest, { params }) => {
    const { noteId } = await params;
    const sections = await listNoteSections(
      request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
      noteId,
      request.nextUrl.searchParams,
    );

    return NextResponse.json(sections);
  },
);

export const POST = withApiErrorHandling<NoteSectionsRouteContext>(
  async (request: NextRequest, { params }) => {
    const { noteId } = await params;
    const body = await readJsonBody(request);
    const section = await createNoteSection(
      request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
      noteId,
      body,
    );

    return NextResponse.json(section, { status: 201 });
  },
);
