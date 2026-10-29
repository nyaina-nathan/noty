import type { Prisma } from "@/prisma/generated/client";
import { ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/services/auth.services";
import type {
  CreateNoteSectionInput,
  ListNoteSectionsQuery,
  ReorderNoteSectionsInput,
  UpdateNoteSectionInput,
} from "@/types/note-section.types";
import type { NoteSection } from "@/types/note.types";
import {
  validateCreateNoteSectionInput,
  validateListNoteSectionsQuery,
  validateReorderNoteSectionsInput,
  validateSectionId,
  validateUpdateNoteSectionInput,
} from "@/validators/note-section.validators";
import { validateNoteId } from "@/validators/note.validators";

const NOTE_NOT_FOUND = "Note not found";
const SECTION_NOT_FOUND = "Note section not found";

const SECTION_SELECT = {
  id: true,
  note_id: true,
  note_order: true,
  content: true,
  created_at: true,
  updated_at: true,
} as const;

function sectionOrderBy(
  order: "asc" | "desc",
): Prisma.note_sectionOrderByWithRelationInput[] {
  return [{ note_order: order }, { id: order }];
}

async function assertNoteOwnedByUser(
  userId: string,
  noteId: string,
  client: Prisma.TransactionClient = prisma,
): Promise<void> {
  const note = await client.notes.findFirst({
    where: { id: noteId, user_id: userId },
    select: { id: true },
  });

  if (!note) {
    throw ApiError.notFound(NOTE_NOT_FOUND);
  }
}

export async function listNoteSections(
  accessToken: string | undefined,
  noteId: string,
  searchParams: URLSearchParams,
): Promise<NoteSection[]> {
  const userId = await getAuthenticatedUserId(accessToken);
  const id = validateNoteId(noteId);
  const query: ListNoteSectionsQuery =
    validateListNoteSectionsQuery(searchParams);

  await assertNoteOwnedByUser(userId, id);

  return prisma.note_section.findMany({
    where: { note_id: id },
    orderBy: sectionOrderBy(query.order),
    select: SECTION_SELECT,
  });
}

export async function createNoteSection(
  accessToken: string | undefined,
  noteId: string,
  body: unknown,
): Promise<NoteSection> {
  const userId = await getAuthenticatedUserId(accessToken);
  const id = validateNoteId(noteId);
  const input: CreateNoteSectionInput = validateCreateNoteSectionInput(body);

  return prisma.$transaction(async (tx) => {
    await assertNoteOwnedByUser(userId, id, tx);

    const aggregate = await tx.note_section.aggregate({
      where: { note_id: id },
      _max: { note_order: true },
    });

    const noteOrder = input.note_order ?? (aggregate._max.note_order ?? 0) + 1;

    return tx.note_section.create({
      data: {
        note_id: id,
        content: input.content,
        note_order: noteOrder,
      },
      select: SECTION_SELECT,
    });
  });
}

export async function updateNoteSection(
  accessToken: string | undefined,
  noteId: string,
  sectionId: string,
  body: unknown,
): Promise<NoteSection> {
  const userId = await getAuthenticatedUserId(accessToken);
  const id = validateNoteId(noteId);
  const sectionIdValue = validateSectionId(sectionId);
  const input: UpdateNoteSectionInput = validateUpdateNoteSectionInput(body);

  await assertNoteOwnedByUser(userId, id);

  const data: Prisma.note_sectionUncheckedUpdateManyInput = {
    updated_at: new Date(),
  };

  if (input.content !== undefined) {
    data.content = input.content;
  }

  if (input.note_order !== undefined) {
    data.note_order = input.note_order;
  }

  const updated = await prisma.note_section.updateMany({
    where: { id: sectionIdValue, note_id: id },
    data,
  });

  if (updated.count === 0) {
    throw ApiError.notFound(SECTION_NOT_FOUND);
  }

  const section = await prisma.note_section.findFirst({
    where: { id: sectionIdValue, note_id: id },
    select: SECTION_SELECT,
  });

  if (!section) {
    throw ApiError.notFound(SECTION_NOT_FOUND);
  }

  return section;
}

export async function deleteNoteSection(
  accessToken: string | undefined,
  noteId: string,
  sectionId: string,
): Promise<void> {
  const userId = await getAuthenticatedUserId(accessToken);
  const id = validateNoteId(noteId);
  const sectionIdValue = validateSectionId(sectionId);

  await assertNoteOwnedByUser(userId, id);

  const deleted = await prisma.note_section.deleteMany({
    where: { id: sectionIdValue, note_id: id },
  });

  if (deleted.count === 0) {
    throw ApiError.notFound(SECTION_NOT_FOUND);
  }
}

export async function reorderNoteSections(
  accessToken: string | undefined,
  noteId: string,
  body: unknown,
): Promise<NoteSection[]> {
  const userId = await getAuthenticatedUserId(accessToken);
  const id = validateNoteId(noteId);
  const input: ReorderNoteSectionsInput =
    validateReorderNoteSectionsInput(body);

  return prisma.$transaction(async (tx) => {
    await assertNoteOwnedByUser(userId, id, tx);

    const sections = await tx.note_section.findMany({
      where: { note_id: id },
      select: { id: true },
    });

    const currentIds = new Set(
      sections.map((section) => section.id.toLowerCase()),
    );
    const requestedIds = new Set(
      input.sectionIds.map((sectionId) => sectionId.toLowerCase()),
    );

    const isComplete =
      currentIds.size === requestedIds.size &&
      [...currentIds].every((sectionId) => requestedIds.has(sectionId));

    if (!isComplete) {
      throw ApiError.validation([
        {
          field: "sectionIds",
          message: "Must contain every section of the note exactly once",
        },
      ]);
    }

    await Promise.all(
      input.sectionIds.map((sectionId, index) =>
        tx.note_section.updateMany({
          where: { id: sectionId, note_id: id },
          data: { note_order: index + 1, updated_at: new Date() },
        }),
      ),
    );

    return tx.note_section.findMany({
      where: { note_id: id },
      orderBy: sectionOrderBy("asc"),
      select: SECTION_SELECT,
    });
  });
}
