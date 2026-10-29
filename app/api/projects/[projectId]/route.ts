import { NextResponse, type NextRequest } from "next/server";
import { withApiErrorHandling } from "@/lib/api/handler";
import { readJsonBody } from "@/lib/api/request";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth-cookies";
import {
  deleteProject,
  getProject,
  updateProject,
} from "@/services/project.services";

type ProjectRouteContext = {
  params: Promise<{ projectId: string }>;
};

export const GET = withApiErrorHandling<ProjectRouteContext>(
  async (request: NextRequest, { params }) => {
    const { projectId } = await params;
    const project = await getProject(
      request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
      projectId,
    );

    return NextResponse.json(project);
  },
);

export const PATCH = withApiErrorHandling<ProjectRouteContext>(
  async (request: NextRequest, { params }) => {
    const { projectId } = await params;
    const body = await readJsonBody(request);
    const project = await updateProject(
      request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
      projectId,
      body,
    );

    return NextResponse.json(project);
  },
);

export const DELETE = withApiErrorHandling<ProjectRouteContext>(
  async (request: NextRequest, { params }) => {
    const { projectId } = await params;

    await deleteProject(
      request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
      projectId,
    );

    return new Response(null, { status: 204 });
  },
);
