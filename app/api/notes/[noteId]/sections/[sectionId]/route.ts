import { NextResponse, type NextRequest } from "next/server";
import { withApiErrorHandling } from "@/lib/api/handler";
import { readJsonBody } from "@/lib/api/request";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth-cookies";
import {
  deleteNoteSection,
  updateNoteSection,
} from "@/services/note-section.services";

type NoteSectionRouteContext = {
  params: Promise<{ noteId: string; sectionId: string }>;
};

export const PATCH = withApiErrorHandling<NoteSectionRouteContext>(
  async (request: NextRequest, { params }) => {
    const { noteId, sectionId } = await params;
    const body = await readJsonBody(request);
    const section = await updateNoteSection(
      request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
      noteId,
      sectionId,
      body,
    );

    return NextResponse.json(section);
  },
);

export const DELETE = withApiErrorHandling<NoteSectionRouteContext>(
  async (request: NextRequest, { params }) => {
    const { noteId, sectionId } = await params;

    await deleteNoteSection(
      request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
      noteId,
      sectionId,
    );

    return new Response(null, { status: 204 });
  },
);
