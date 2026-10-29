import { NextResponse, type NextRequest } from "next/server";
import { withApiErrorHandling } from "@/lib/api/handler";
import { readJsonBody } from "@/lib/api/request";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth-cookies";
import { deleteNote, getNote, updateNote } from "@/services/note.services";

type NoteRouteContext = {
  params: Promise<{ noteId: string }>;
};

export const GET = withApiErrorHandling<NoteRouteContext>(
  async (request: NextRequest, { params }) => {
    const { noteId } = await params;
    const note = await getNote(
      request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
      noteId,
    );

    return NextResponse.json(note);
  },
);

export const PATCH = withApiErrorHandling<NoteRouteContext>(
  async (request: NextRequest, { params }) => {
    const { noteId } = await params;
    const body = await readJsonBody(request);
    const note = await updateNote(
      request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
      noteId,
      body,
    );

    return NextResponse.json(note);
  },
);

export const DELETE = withApiErrorHandling<NoteRouteContext>(
  async (request: NextRequest, { params }) => {
    const { noteId } = await params;

    await deleteNote(
      request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
      noteId,
    );

    return new Response(null, { status: 204 });
  },
);
