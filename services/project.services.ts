import type { Prisma } from "@/prisma/generated/client";
import { ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/services/auth.services";
import type { Paginated } from "@/types/api.types";
import type {
  CreateProjectInput,
  ListProjectsQuery,
  Project,
  UpdateProjectInput,
} from "@/types/project.types";
import {
  validateCreateProjectInput,
  validateListProjectsQuery,
  validateProjectId,
  validateUpdateProjectInput,
} from "@/validators/project.validators";

const PROJECT_NOT_FOUND = "Project not found";
const TAG_NOT_FOUND = "Tag not found";

const PROJECT_SELECT = {
  id: true,
  title: true,
  description: true,
  tag_id: true,
} as const;

async function assertTagOwnedByUser(
  userId: string,
  tagId: string,
): Promise<void> {
  const tag = await prisma.tags.findFirst({
    where: { id: tagId, user_id: userId },
    select: { id: true },
  });

  if (!tag) {
    throw ApiError.notFound(TAG_NOT_FOUND);
  }
}

export async function listProjects(
  accessToken: string | undefined,
  searchParams: URLSearchParams,
): Promise<Paginated<Project>> {
  const userId = await getAuthenticatedUserId(accessToken);
  const query: ListProjectsQuery = validateListProjectsQuery(searchParams);

  const where: Prisma.projectsWhereInput = {
    user_id: userId,
    ...(query.tag_id ? { tag_id: query.tag_id } : {}),
    ...(query.search
      ? {
          OR: [
            {
              title: {
                contains: query.search,
                mode: "insensitive" as const,
              },
            },
            {
              description: {
                contains: query.search,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.projects.findMany({
      where,
      orderBy: { title: query.order },
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
      select: PROJECT_SELECT,
    }),
    prisma.projects.count({ where }),
  ]);

  return {
    items,
    meta: {
      page: query.page,
      perPage: query.perPage,
      total,
      totalPage: Math.ceil(total / query.perPage),
    },
  };
}

export async function getProject(
  accessToken: string | undefined,
  projectId: string,
): Promise<Project> {
  const userId = await getAuthenticatedUserId(accessToken);
  const id = validateProjectId(projectId);

  const project = await prisma.projects.findFirst({
    where: { id, user_id: userId },
    select: PROJECT_SELECT,
  });

  if (!project) {
    throw ApiError.notFound(PROJECT_NOT_FOUND);
  }

  return project;
}

export async function createProject(
  accessToken: string | undefined,
  body: unknown,
): Promise<Project> {
  const userId = await getAuthenticatedUserId(accessToken);
  const input: CreateProjectInput = validateCreateProjectInput(body);

  if (input.tag_id !== null) {
    await assertTagOwnedByUser(userId, input.tag_id);
  }

  return prisma.projects.create({
    data: {
      user_id: userId,
      title: input.title,
      description: input.description,
      tag_id: input.tag_id,
    },
    select: PROJECT_SELECT,
  });
}

export async function updateProject(
  accessToken: string | undefined,
  projectId: string,
  body: unknown,
): Promise<Project> {
  const userId = await getAuthenticatedUserId(accessToken);
  const id = validateProjectId(projectId);
  const input: UpdateProjectInput = validateUpdateProjectInput(body);

  if (
    Object.hasOwn(input, "tag_id") &&
    typeof input.tag_id === "string"
  ) {
    await assertTagOwnedByUser(userId, input.tag_id);
  }

  const data: Prisma.projectsUncheckedUpdateManyInput = {};

  if (input.title !== undefined) {
    data.title = input.title;
  }

  if (Object.hasOwn(input, "description")) {
    data.description = input.description ?? null;
  }

  if (Object.hasOwn(input, "tag_id")) {
    data.tag_id = input.tag_id ?? null;
  }

  const updated = await prisma.projects.updateMany({
    where: { id, user_id: userId },
    data,
  });

  if (updated.count === 0) {
    throw ApiError.notFound(PROJECT_NOT_FOUND);
  }

  const project = await prisma.projects.findFirst({
    where: { id, user_id: userId },
    select: PROJECT_SELECT,
  });

  if (!project) {
    throw ApiError.notFound(PROJECT_NOT_FOUND);
  }

  return project;
}

export async function deleteProject(
  accessToken: string | undefined,
  projectId: string,
): Promise<void> {
  const userId = await getAuthenticatedUserId(accessToken);
  const id = validateProjectId(projectId);

  const deleted = await prisma.projects.deleteMany({
    where: { id, user_id: userId },
  });

  if (deleted.count === 0) {
    throw ApiError.notFound(PROJECT_NOT_FOUND);
  }
}
