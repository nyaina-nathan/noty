import { ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/services/auth.services";
import type { Paginated } from "@/types/api.types";
import type {
  CreateTagInput,
  ListTagsQuery,
  Tag,
  UpdateTagInput,
} from "@/types/tag.types";
import {
  validateCreateTagInput,
  validateListTagsQuery,
  validateTagId,
  validateUpdateTagInput,
} from "@/validators/tag.validators";

const TAG_NOT_FOUND = "Tag not found";

const TAG_SELECT = {
  id: true,
  name: true,
} as const;

export async function listTags(
  accessToken: string | undefined,
  searchParams: URLSearchParams,
): Promise<Paginated<Tag>> {
  const userId = await getAuthenticatedUserId(accessToken);
  const query: ListTagsQuery = validateListTagsQuery(searchParams);

  const where = {
    user_id: userId,
    ...(query.search
      ? { name: { contains: query.search, mode: "insensitive" as const } }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.tags.findMany({
      where,
      orderBy: { name: query.order },
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
      select: TAG_SELECT,
    }),
    prisma.tags.count({ where }),
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

export async function getTag(
  accessToken: string | undefined,
  tagId: string,
): Promise<Tag> {
  const userId = await getAuthenticatedUserId(accessToken);
  const id = validateTagId(tagId);

  const tag = await prisma.tags.findFirst({
    where: { id, user_id: userId },
    select: TAG_SELECT,
  });

  if (!tag) {
    throw ApiError.notFound(TAG_NOT_FOUND);
  }

  return tag;
}

export async function createTag(
  accessToken: string | undefined,
  body: unknown,
): Promise<Tag> {
  const userId = await getAuthenticatedUserId(accessToken);
  const input: CreateTagInput = validateCreateTagInput(body);

  return prisma.tags.create({
    data: {
      user_id: userId,
      name: input.name,
    },
    select: TAG_SELECT,
  });
}

export async function updateTag(
  accessToken: string | undefined,
  tagId: string,
  body: unknown,
): Promise<Tag> {
  const userId = await getAuthenticatedUserId(accessToken);
  const id = validateTagId(tagId);
  const input: UpdateTagInput = validateUpdateTagInput(body);

  const updated = await prisma.tags.updateMany({
    where: { id, user_id: userId },
    data: { name: input.name },
  });

  if (updated.count === 0) {
    throw ApiError.notFound(TAG_NOT_FOUND);
  }

  const tag = await prisma.tags.findUnique({
    where: { id },
    select: TAG_SELECT,
  });

  if (!tag) {
    throw ApiError.notFound(TAG_NOT_FOUND);
  }

  return tag;
}

export async function deleteTag(
  accessToken: string | undefined,
  tagId: string,
): Promise<void> {
  const userId = await getAuthenticatedUserId(accessToken);
  const id = validateTagId(tagId);

  const deleted = await prisma.tags.deleteMany({
    where: { id, user_id: userId },
  });

  if (deleted.count === 0) {
    throw ApiError.notFound(TAG_NOT_FOUND);
  }
}
