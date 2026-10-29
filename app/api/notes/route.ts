import { NextResponse, type NextRequest } from "next/server";
import { withApiErrorHandling } from "@/lib/api/handler";
import { readJsonBody } from "@/lib/api/request";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth-cookies";
import { createNote, listNotes } from "@/services/note.services";

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const notes = await listNotes(
    request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
    request.nextUrl.searchParams,
  );

  return NextResponse.json(notes);
});

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const body = await readJsonBody(request);
  const note = await createNote(
    request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
    body,
  );

  return NextResponse.json(note, { status: 201 });
});
