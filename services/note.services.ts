import type { Prisma } from "@/prisma/generated/client";
import { ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/services/auth.services";
import type { Paginated } from "@/types/api.types";
import type {
  CreateNoteInput,
  ListNotesQuery,
  Note,
  NoteDetail,
  UpdateNoteInput,
} from "@/types/note.types";
import {
  validateCreateNoteInput,
  validateListNotesQuery,
  validateNoteId,
  validateUpdateNoteInput,
} from "@/validators/note.validators";

const NOTE_NOT_FOUND = "Note not found";
const PROJECT_NOT_FOUND = "Project not found";

const NOTE_SELECT = {
  id: true,
  project_id: true,
  title: true,
  description: true,
  created_at: true,
  updated_at: true,
} as const;

const SECTION_SELECT = {
  id: true,
  note_id: true,
  note_order: true,
  content: true,
  created_at: true,
  updated_at: true,
} as const;

const SECTION_ORDER_BY = [
  { note_order: "asc" },
  { id: "asc" },
] satisfies Prisma.note_sectionOrderByWithRelationInput[];

const NOTE_DETAIL_SELECT = {
  ...NOTE_SELECT,
  note_section: {
    select: SECTION_SELECT,
    orderBy: SECTION_ORDER_BY,
  },
} satisfies Prisma.notesSelect;

type NoteDetailRow = Prisma.notesGetPayload<{
  select: typeof NOTE_DETAIL_SELECT;
}>;

function toNoteDetail(note: NoteDetailRow): NoteDetail {
  const { note_section, ...rest } = note;

  return { ...rest, sections: note_section };
}

async function assertProjectOwnedByUser(
  userId: string,
  projectId: string,
): Promise<void> {
  const project = await prisma.projects.findFirst({
    where: { id: projectId, user_id: userId },
    select: { id: true },
  });

  if (!project) {
    throw ApiError.notFound(PROJECT_NOT_FOUND);
  }
}

export async function listNotes(
  accessToken: string | undefined,
  searchParams: URLSearchParams,
): Promise<Paginated<Note>> {
  const userId = await getAuthenticatedUserId(accessToken);
  const query: ListNotesQuery = validateListNotesQuery(searchParams);

  const where: Prisma.notesWhereInput = {
    user_id: userId,
    ...(query.project_id ? { project_id: query.project_id } : {}),
    ...(query.tag_id ? { projects: { tag_id: query.tag_id } } : {}),
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

  const orderBy = [
    { [query.sort]: query.order },
    { id: query.order },
  ] as Prisma.notesOrderByWithRelationInput[];

  const [items, total] = await prisma.$transaction([
    prisma.notes.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
      select: NOTE_SELECT,
    }),
    prisma.notes.count({ where }),
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

export async function getNote(
  accessToken: string | undefined,
  noteId: string,
): Promise<NoteDetail> {
  const userId = await getAuthenticatedUserId(accessToken);
  const id = validateNoteId(noteId);

  const note = await prisma.notes.findFirst({
    where: { id, user_id: userId },
    select: NOTE_DETAIL_SELECT,
  });

  if (!note) {
    throw ApiError.notFound(NOTE_NOT_FOUND);
  }

  return toNoteDetail(note);
}

export async function createNote(
  accessToken: string | undefined,
  body: unknown,
): Promise<NoteDetail> {
  const userId = await getAuthenticatedUserId(accessToken);
  const input: CreateNoteInput = validateCreateNoteInput(body);

  if (input.project_id !== null) {
    await assertProjectOwnedByUser(userId, input.project_id);
  }

  const note = await prisma.notes.create({
    data: {
      user_id: userId,
      project_id: input.project_id,
      title: input.title,
      description: input.description,
      ...(input.sections.length > 0
        ? {
            note_section: {
              create: input.sections.map((section) => ({
                content: section.content,
                note_order: section.note_order,
              })),
            },
          }
        : {}),
    },
    select: NOTE_DETAIL_SELECT,
  });

  return toNoteDetail(note);
}

export async function updateNote(
  accessToken: string | undefined,
  noteId: string,
  body: unknown,
): Promise<Note> {
  const userId = await getAuthenticatedUserId(accessToken);
  const id = validateNoteId(noteId);
  const input: UpdateNoteInput = validateUpdateNoteInput(body);

  if (typeof input.project_id === "string") {
    await assertProjectOwnedByUser(userId, input.project_id);
  }

  const data: Prisma.notesUncheckedUpdateManyInput = {
    updated_at: new Date(),
  };

  if (input.title !== undefined) {
    data.title = input.title;
  }

  if (Object.hasOwn(input, "description")) {
    data.description = input.description ?? null;
  }

  if (Object.hasOwn(input, "project_id")) {
    data.project_id = input.project_id ?? null;
  }

  const updated = await prisma.notes.updateMany({
    where: { id, user_id: userId },
    data,
  });

  if (updated.count === 0) {
    throw ApiError.notFound(NOTE_NOT_FOUND);
  }

  const note = await prisma.notes.findFirst({
    where: { id, user_id: userId },
    select: NOTE_SELECT,
  });

  if (!note) {
    throw ApiError.notFound(NOTE_NOT_FOUND);
  }

  return note;
}

export async function deleteNote(
  accessToken: string | undefined,
  noteId: string,
): Promise<void> {
  const userId = await getAuthenticatedUserId(accessToken);
  const id = validateNoteId(noteId);

  const deleted = await prisma.notes.deleteMany({
    where: { id, user_id: userId },
  });

  if (deleted.count === 0) {
    throw ApiError.notFound(NOTE_NOT_FOUND);
  }
}
