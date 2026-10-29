import { NextResponse, type NextRequest } from "next/server";
import { withApiErrorHandling } from "@/lib/api/handler";
import { readJsonBody } from "@/lib/api/request";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth-cookies";
import { createProject, listProjects } from "@/services/project.services";

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const projects = await listProjects(
    request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
    request.nextUrl.searchParams,
  );

  return NextResponse.json(projects);
});

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const body = await readJsonBody(request);
  const project = await createProject(
    request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
    body,
  );

  return NextResponse.json(project, { status: 201 });
});
