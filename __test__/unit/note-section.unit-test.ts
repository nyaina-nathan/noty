import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";

const mocks = vi.hoisted(() => {
  const prisma = {
    notes: {
      findFirst: vi.fn(),
    },
    note_section: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      aggregate: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  return {
    prisma,
    getAuthenticatedUserId: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

vi.mock("@/services/auth.services", () => ({
  getAuthenticatedUserId: mocks.getAuthenticatedUserId,
}));

import {
  createNoteSection,
  deleteNoteSection,
  listNoteSections,
  reorderNoteSections,
  updateNoteSection,
} from "@/services/note-section.services";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const NOTE_ID = "22222222-2222-2222-2222-222222222222";
const SECTION_ID = "33333333-3333-3333-3333-333333333333";
const OTHER_SECTION_ID = "44444444-4444-4444-4444-444444444444";

const createdAt = new Date("2026-01-01T10:00:00.000Z");

const section = {
  id: SECTION_ID,
  note_id: NOTE_ID,
  note_order: 1,
  content: "Milk",
  created_at: createdAt,
  updated_at: null,
};

const otherSection = {
  ...section,
  id: OTHER_SECTION_ID,
  note_order: 2,
  content: "Bread",
};

const SECTION_SELECT = {
  id: true,
  note_id: true,
  note_order: true,
  content: true,
  created_at: true,
  updated_at: true,
};

async function captureApiError(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => {
      throw new Error("Expected the service call to reject");
    },
    (cause: unknown) => cause,
  );

  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

beforeEach(() => {
  vi.resetAllMocks();

  mocks.getAuthenticatedUserId.mockResolvedValue(USER_ID);
  mocks.prisma.notes.findFirst.mockResolvedValue({ id: NOTE_ID });

  mocks.prisma.$transaction.mockImplementation(async (operation: unknown) => {
    if (typeof operation === "function") {
      return operation(mocks.prisma);
    }

    return Promise.all(operation as Promise<unknown>[]);
  });
});

describe("listNoteSections", () => {
  it("lists a note's sections in ascending order by default", async () => {
    mocks.prisma.note_section.findMany.mockResolvedValue([section]);

    const result = await listNoteSections(
      "access-token",
      NOTE_ID,
      new URLSearchParams(),
    );

    expect(mocks.getAuthenticatedUserId).toHaveBeenCalledWith("access-token");
    expect(mocks.prisma.notes.findFirst).toHaveBeenCalledWith({
      where: { id: NOTE_ID, user_id: USER_ID },
      select: { id: true },
    });
    expect(mocks.prisma.note_section.findMany).toHaveBeenCalledWith({
      where: { note_id: NOTE_ID },
      orderBy: [{ note_order: "asc" }, { id: "asc" }],
      select: SECTION_SELECT,
    });
    expect(result).toEqual([section]);
  });

  it("supports descending order", async () => {
    mocks.prisma.note_section.findMany.mockResolvedValue([
      otherSection,
      section,
    ]);

    const result = await listNoteSections(
      "access-token",
      NOTE_ID,
      new URLSearchParams({ order: "desc" }),
    );

    expect(mocks.prisma.note_section.findMany).toHaveBeenCalledWith({
      where: { note_id: NOTE_ID },
      orderBy: [{ note_order: "desc" }, { id: "desc" }],
      select: SECTION_SELECT,
    });
    expect(result).toEqual([otherSection, section]);
  });

  it("returns an empty array for a note without sections", async () => {
    mocks.prisma.note_section.findMany.mockResolvedValue([]);

    const result = await listNoteSections(
      "access-token",
      NOTE_ID,
      new URLSearchParams(),
    );

    expect(result).toEqual([]);
  });

  it("rejects a missing or foreign note", async () => {
    mocks.prisma.notes.findFirst.mockResolvedValue(null);

    const error = await captureApiError(
      listNoteSections("access-token", NOTE_ID, new URLSearchParams()),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Note not found");
    expect(mocks.prisma.note_section.findMany).not.toHaveBeenCalled();
  });

  it("rejects a malformed note id without querying the database", async () => {
    const error = await captureApiError(
      listNoteSections("access-token", "not-a-uuid", new URLSearchParams()),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Note not found");
    expect(mocks.prisma.notes.findFirst).not.toHaveBeenCalled();
  });

  it("rejects an invalid order before querying the database", async () => {
    const error = await captureApiError(
      listNoteSections(
        "access-token",
        NOTE_ID,
        new URLSearchParams({ order: "sideways" }),
      ),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(mocks.prisma.notes.findFirst).not.toHaveBeenCalled();
  });

  it("propagates authentication failures", async () => {
    mocks.getAuthenticatedUserId.mockRejectedValue(ApiError.unauthorized());

    const error = await captureApiError(
      listNoteSections(undefined, NOTE_ID, new URLSearchParams()),
    );

    expect(error.code).toBe("UNAUTHORIZED");
    expect(mocks.prisma.notes.findFirst).not.toHaveBeenCalled();
  });

  it("propagates unexpected database errors", async () => {
    const databaseError = new Error("database is down");
    mocks.prisma.note_section.findMany.mockRejectedValue(databaseError);

    await expect(
      listNoteSections("access-token", NOTE_ID, new URLSearchParams()),
    ).rejects.toBe(databaseError);
  });
});

describe("createNoteSection", () => {
  beforeEach(() => {
    mocks.prisma.note_section.create.mockResolvedValue({
      ...section,
      note_order: 5,
    });
  });

  it("appends a section after the current highest note_order", async () => {
    mocks.prisma.note_section.aggregate.mockResolvedValue({
      _max: { note_order: 4 },
    });

    const result = await createNoteSection("access-token", NOTE_ID, {
      content: "Milk",
    });

    expect(mocks.getAuthenticatedUserId).toHaveBeenCalledWith("access-token");
    expect(mocks.prisma.notes.findFirst).toHaveBeenCalledWith({
      where: { id: NOTE_ID, user_id: USER_ID },
      select: { id: true },
    });
    expect(mocks.prisma.note_section.aggregate).toHaveBeenCalledWith({
      where: { note_id: NOTE_ID },
      _max: { note_order: true },
    });
    expect(mocks.prisma.note_section.create).toHaveBeenCalledWith({
      data: {
        note_id: NOTE_ID,
        content: "Milk",
        note_order: 5,
      },
      select: SECTION_SELECT,
    });
    expect(result.note_order).toBe(5);
  });

  it("starts at order 1 for a note without sections", async () => {
    mocks.prisma.note_section.aggregate.mockResolvedValue({
      _max: { note_order: null },
    });

    await createNoteSection("access-token", NOTE_ID, {});

    expect(mocks.prisma.note_section.create).toHaveBeenCalledWith({
      data: { note_id: NOTE_ID, content: null, note_order: 1 },
      select: SECTION_SELECT,
    });
  });

  it("keeps an explicit note_order", async () => {
    mocks.prisma.note_section.aggregate.mockResolvedValue({
      _max: { note_order: 1 },
    });

    await createNoteSection("access-token", NOTE_ID, {
      content: "Bread",
      note_order: 10,
    });

    expect(mocks.prisma.note_section.create).toHaveBeenCalledWith({
      data: { note_id: NOTE_ID, content: "Bread", note_order: 10 },
      select: SECTION_SELECT,
    });
  });

  it("rejects a missing or foreign note before writing", async () => {
    mocks.prisma.notes.findFirst.mockResolvedValue(null);

    const error = await captureApiError(
      createNoteSection("access-token", NOTE_ID, { content: "Milk" }),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Note not found");
    expect(mocks.prisma.note_section.aggregate).not.toHaveBeenCalled();
    expect(mocks.prisma.note_section.create).not.toHaveBeenCalled();
  });

  it("rejects invalid input before opening a transaction", async () => {
    const error = await captureApiError(
      createNoteSection("access-token", NOTE_ID, { note_order: 0 }),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.prisma.note_section.create).not.toHaveBeenCalled();
  });

  it("propagates authentication failures", async () => {
    mocks.getAuthenticatedUserId.mockRejectedValue(ApiError.unauthorized());

    const error = await captureApiError(
      createNoteSection(undefined, NOTE_ID, { content: "Milk" }),
    );

    expect(error.code).toBe("UNAUTHORIZED");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("propagates unexpected database errors", async () => {
    const databaseError = new Error("database is down");
    mocks.prisma.note_section.aggregate.mockRejectedValue(databaseError);

    await expect(
      createNoteSection("access-token", NOTE_ID, { content: "Milk" }),
    ).rejects.toBe(databaseError);
  });
});

describe("updateNoteSection", () => {
  beforeEach(() => {
    mocks.prisma.note_section.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.note_section.findFirst.mockResolvedValue({
      ...section,
      content: "Updated",
    });
  });

  it("updates the content and refreshes updated_at", async () => {
    const result = await updateNoteSection(
      "access-token",
      NOTE_ID,
      SECTION_ID,
      { content: "Updated" },
    );

    expect(mocks.getAuthenticatedUserId).toHaveBeenCalledWith("access-token");
    expect(mocks.prisma.notes.findFirst).toHaveBeenCalledWith({
      where: { id: NOTE_ID, user_id: USER_ID },
      select: { id: true },
    });
    expect(mocks.prisma.note_section.updateMany).toHaveBeenCalledWith({
      where: { id: SECTION_ID, note_id: NOTE_ID },
      data: { content: "Updated", updated_at: expect.any(Date) },
    });
    expect(mocks.prisma.note_section.findFirst).toHaveBeenCalledWith({
      where: { id: SECTION_ID, note_id: NOTE_ID },
      select: SECTION_SELECT,
    });
    expect(result.content).toBe("Updated");
  });

  it("clears the content with null", async () => {
    await updateNoteSection("access-token", NOTE_ID, SECTION_ID, {
      content: null,
    });

    expect(mocks.prisma.note_section.updateMany).toHaveBeenCalledWith({
      where: { id: SECTION_ID, note_id: NOTE_ID },
      data: { content: null, updated_at: expect.any(Date) },
    });
  });

  it("updates the note_order", async () => {
    await updateNoteSection("access-token", NOTE_ID, SECTION_ID, {
      note_order: 7,
    });

    expect(mocks.prisma.note_section.updateMany).toHaveBeenCalledWith({
      where: { id: SECTION_ID, note_id: NOTE_ID },
      data: { note_order: 7, updated_at: expect.any(Date) },
    });
  });

  it("updates both fields", async () => {
    await updateNoteSection("access-token", NOTE_ID, SECTION_ID, {
      content: "Updated",
      note_order: 2,
    });

    expect(mocks.prisma.note_section.updateMany).toHaveBeenCalledWith({
      where: { id: SECTION_ID, note_id: NOTE_ID },
      data: {
        content: "Updated",
        note_order: 2,
        updated_at: expect.any(Date),
      },
    });
  });

  it("rejects a section that does not belong to the note", async () => {
    mocks.prisma.note_section.updateMany.mockResolvedValue({ count: 0 });

    const error = await captureApiError(
      updateNoteSection("access-token", NOTE_ID, SECTION_ID, {
        content: "Updated",
      }),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Note section not found");
    expect(mocks.prisma.note_section.findFirst).not.toHaveBeenCalled();
  });

  it("rejects a missing or foreign note before updating", async () => {
    mocks.prisma.notes.findFirst.mockResolvedValue(null);

    const error = await captureApiError(
      updateNoteSection("access-token", NOTE_ID, SECTION_ID, {
        content: "Updated",
      }),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Note not found");
    expect(mocks.prisma.note_section.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a malformed note id without querying the database", async () => {
    const error = await captureApiError(
      updateNoteSection("access-token", "not-a-uuid", SECTION_ID, {
        content: "Updated",
      }),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(mocks.prisma.notes.findFirst).not.toHaveBeenCalled();
  });

  it("rejects a malformed section id without querying the database", async () => {
    const error = await captureApiError(
      updateNoteSection("access-token", NOTE_ID, "not-a-uuid", {
        content: "Updated",
      }),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Note section not found");
    expect(mocks.prisma.notes.findFirst).not.toHaveBeenCalled();
  });

  it("rejects an empty body before writing", async () => {
    const error = await captureApiError(
      updateNoteSection("access-token", NOTE_ID, SECTION_ID, {}),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { message: "At least one field is required" },
    ]);
    expect(mocks.prisma.notes.findFirst).not.toHaveBeenCalled();
  });

  it("rejects when the section disappears after the update", async () => {
    mocks.prisma.note_section.findFirst.mockResolvedValue(null);

    const error = await captureApiError(
      updateNoteSection("access-token", NOTE_ID, SECTION_ID, {
        content: "Updated",
      }),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Note section not found");
  });

  it("propagates authentication failures", async () => {
    mocks.getAuthenticatedUserId.mockRejectedValue(ApiError.unauthorized());

    const error = await captureApiError(
      updateNoteSection(undefined, NOTE_ID, SECTION_ID, {
        content: "Updated",
      }),
    );

    expect(error.code).toBe("UNAUTHORIZED");
    expect(mocks.prisma.note_section.updateMany).not.toHaveBeenCalled();
  });

  it("propagates unexpected database errors", async () => {
    const databaseError = new Error("database is down");
    mocks.prisma.note_section.updateMany.mockRejectedValue(databaseError);

    await expect(
      updateNoteSection("access-token", NOTE_ID, SECTION_ID, {
        content: "Updated",
      }),
    ).rejects.toBe(databaseError);
  });
});

describe("deleteNoteSection", () => {
  it("deletes a section of a note owned by the user", async () => {
    mocks.prisma.note_section.deleteMany.mockResolvedValue({ count: 1 });

    await deleteNoteSection("access-token", NOTE_ID, SECTION_ID);

    expect(mocks.getAuthenticatedUserId).toHaveBeenCalledWith("access-token");
    expect(mocks.prisma.notes.findFirst).toHaveBeenCalledWith({
      where: { id: NOTE_ID, user_id: USER_ID },
      select: { id: true },
    });
    expect(mocks.prisma.note_section.deleteMany).toHaveBeenCalledWith({
      where: { id: SECTION_ID, note_id: NOTE_ID },
    });
  });

  it("rejects a section that does not belong to the note", async () => {
    mocks.prisma.note_section.deleteMany.mockResolvedValue({ count: 0 });

    const error = await captureApiError(
      deleteNoteSection("access-token", NOTE_ID, SECTION_ID),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Note section not found");
  });

  it("rejects a missing or foreign note before deleting", async () => {
    mocks.prisma.notes.findFirst.mockResolvedValue(null);

    const error = await captureApiError(
      deleteNoteSection("access-token", NOTE_ID, SECTION_ID),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Note not found");
    expect(mocks.prisma.note_section.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects malformed ids without querying the database", async () => {
    const noteError = await captureApiError(
      deleteNoteSection("access-token", "not-a-uuid", SECTION_ID),
    );
    expect(noteError.code).toBe("NOT_FOUND");

    const sectionError = await captureApiError(
      deleteNoteSection("access-token", NOTE_ID, "not-a-uuid"),
    );
    expect(sectionError.message).toBe("Note section not found");

    expect(mocks.prisma.notes.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.note_section.deleteMany).not.toHaveBeenCalled();
  });

  it("propagates authentication failures", async () => {
    mocks.getAuthenticatedUserId.mockRejectedValue(ApiError.unauthorized());

    const error = await captureApiError(
      deleteNoteSection(undefined, NOTE_ID, SECTION_ID),
    );

    expect(error.code).toBe("UNAUTHORIZED");
    expect(mocks.prisma.note_section.deleteMany).not.toHaveBeenCalled();
  });

  it("propagates unexpected database errors", async () => {
    const databaseError = new Error("database is down");
    mocks.prisma.note_section.deleteMany.mockRejectedValue(databaseError);

    await expect(
      deleteNoteSection("access-token", NOTE_ID, SECTION_ID),
    ).rejects.toBe(databaseError);
  });
});

describe("reorderNoteSections", () => {
  beforeEach(() => {
    mocks.prisma.note_section.findMany
      .mockResolvedValueOnce([{ id: SECTION_ID }, { id: OTHER_SECTION_ID }])
      .mockResolvedValueOnce([
        { ...otherSection, note_order: 1 },
        { ...section, note_order: 2 },
      ]);
    mocks.prisma.note_section.updateMany.mockResolvedValue({ count: 1 });
  });

  it("rewrites note_order as 1..n and returns the new order", async () => {
    const result = await reorderNoteSections("access-token", NOTE_ID, {
      sectionIds: [OTHER_SECTION_ID, SECTION_ID],
    });

    expect(mocks.getAuthenticatedUserId).toHaveBeenCalledWith("access-token");
    expect(mocks.prisma.notes.findFirst).toHaveBeenCalledWith({
      where: { id: NOTE_ID, user_id: USER_ID },
      select: { id: true },
    });
    expect(mocks.prisma.note_section.findMany).toHaveBeenNthCalledWith(1, {
      where: { note_id: NOTE_ID },
      select: { id: true },
    });
    expect(mocks.prisma.note_section.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: OTHER_SECTION_ID, note_id: NOTE_ID },
      data: { note_order: 1, updated_at: expect.any(Date) },
    });
    expect(mocks.prisma.note_section.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: SECTION_ID, note_id: NOTE_ID },
      data: { note_order: 2, updated_at: expect.any(Date) },
    });
    expect(mocks.prisma.note_section.findMany).toHaveBeenNthCalledWith(2, {
      where: { note_id: NOTE_ID },
      orderBy: [{ note_order: "asc" }, { id: "asc" }],
      select: SECTION_SELECT,
    });
    expect(result.map((item) => item.id)).toEqual([
      OTHER_SECTION_ID,
      SECTION_ID,
    ]);
  });

  it("accepts section ids in uppercase", async () => {
    await reorderNoteSections("access-token", NOTE_ID, {
      sectionIds: [OTHER_SECTION_ID.toUpperCase(), SECTION_ID.toUpperCase()],
    });

    expect(mocks.prisma.note_section.updateMany).toHaveBeenCalledTimes(2);
  });

  it.each([
    [
      "a missing section",
      [SECTION_ID],
    ],
    [
      "an unknown section",
      [SECTION_ID, OTHER_SECTION_ID, "55555555-5555-5555-5555-555555555555"],
    ],
    [
      "only unknown sections",
      ["55555555-5555-5555-5555-555555555555", "66666666-6666-6666-6666-666666666666"],
    ],
  ])("rejects %s without updating", async (_case, sectionIds) => {
    const error = await captureApiError(
      reorderNoteSections("access-token", NOTE_ID, { sectionIds }),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      {
        field: "sectionIds",
        message: "Must contain every section of the note exactly once",
      },
    ]);
    expect(mocks.prisma.note_section.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a missing or foreign note before reordering", async () => {
    mocks.prisma.notes.findFirst.mockResolvedValue(null);

    const error = await captureApiError(
      reorderNoteSections("access-token", NOTE_ID, {
        sectionIds: [SECTION_ID],
      }),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Note not found");
    expect(mocks.prisma.note_section.findMany).not.toHaveBeenCalled();
  });

  it("rejects invalid input before opening a transaction", async () => {
    const error = await captureApiError(
      reorderNoteSections("access-token", NOTE_ID, { sectionIds: [] }),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a malformed note id without querying the database", async () => {
    const error = await captureApiError(
      reorderNoteSections("access-token", "not-a-uuid", {
        sectionIds: [SECTION_ID],
      }),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("propagates authentication failures", async () => {
    mocks.getAuthenticatedUserId.mockRejectedValue(ApiError.unauthorized());

    const error = await captureApiError(
      reorderNoteSections(undefined, NOTE_ID, { sectionIds: [SECTION_ID] }),
    );

    expect(error.code).toBe("UNAUTHORIZED");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("propagates unexpected database errors", async () => {
    const databaseError = new Error("database is down");
    mocks.prisma.note_section.updateMany.mockRejectedValue(databaseError);

    await expect(
      reorderNoteSections("access-token", NOTE_ID, {
        sectionIds: [OTHER_SECTION_ID, SECTION_ID],
      }),
    ).rejects.toBe(databaseError);
  });
});
