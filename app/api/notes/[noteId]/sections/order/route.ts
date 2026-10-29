import { NextResponse, type NextRequest } from "next/server";
import { withApiErrorHandling } from "@/lib/api/handler";
import { readJsonBody } from "@/lib/api/request";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth-cookies";
import { reorderNoteSections } from "@/services/note-section.services";

type NoteSectionOrderRouteContext = {
  params: Promise<{ noteId: string }>;
};

export const PUT = withApiErrorHandling<NoteSectionOrderRouteContext>(
  async (request: NextRequest, { params }) => {
    const { noteId } = await params;
    const body = await readJsonBody(request);
    const sections = await reorderNoteSections(
      request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
      noteId,
      body,
    );

    return NextResponse.json(sections);
  },
);
