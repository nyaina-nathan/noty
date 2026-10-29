import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";

const mocks = vi.hoisted(() => {
  const prisma = {
    notes: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    projects: {
      findFirst: vi.fn(),
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
  createNote,
  deleteNote,
  getNote,
  listNotes,
  updateNote,
} from "@/services/note.services";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const NOTE_ID = "22222222-2222-2222-2222-222222222222";
const PROJECT_ID = "33333333-3333-3333-3333-333333333333";
const TAG_ID = "44444444-4444-4444-4444-444444444444";
const SECTION_ID = "55555555-5555-5555-5555-555555555555";

const createdAt = new Date("2026-01-01T10:00:00.000Z");

const note = {
  id: NOTE_ID,
  project_id: null,
  title: "Shopping",
  description: "Weekly groceries",
  created_at: createdAt,
  updated_at: null,
};

const section = {
  id: SECTION_ID,
  note_id: NOTE_ID,
  note_order: 1,
  content: "Milk",
  created_at: createdAt,
  updated_at: null,
};

const NOTE_SELECT = {
  id: true,
  project_id: true,
  title: true,
  description: true,
  created_at: true,
  updated_at: true,
};

const SECTION_SELECT = {
  id: true,
  note_id: true,
  note_order: true,
  content: true,
  created_at: true,
  updated_at: true,
};

const NOTE_DETAIL_SELECT = {
  ...NOTE_SELECT,
  note_section: {
    select: SECTION_SELECT,
    orderBy: [{ note_order: "asc" }, { id: "asc" }],
  },
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

  mocks.prisma.$transaction.mockImplementation(async (operation: unknown) => {
    if (typeof operation === "function") {
      return operation(mocks.prisma);
    }

    return Promise.all(operation as Promise<unknown>[]);
  });
});

describe("listNotes", () => {
  beforeEach(() => {
    mocks.prisma.notes.findMany.mockResolvedValue([note]);
    mocks.prisma.notes.count.mockResolvedValue(1);
  });

  it("returns the first page sorted by created_at descending", async () => {
    const result = await listNotes("access-token", new URLSearchParams());

    expect(mocks.getAuthenticatedUserId).toHaveBeenCalledWith("access-token");
    expect(mocks.prisma.notes.findMany).toHaveBeenCalledWith({
      where: { user_id: USER_ID },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      skip: 0,
      take: 20,
      select: NOTE_SELECT,
    });
    expect(mocks.prisma.notes.count).toHaveBeenCalledWith({
      where: { user_id: USER_ID },
    });
    expect(result).toEqual({
      items: [note],
      meta: { page: 1, perPage: 20, total: 1, totalPage: 1 },
    });
  });

  it("searches titles and descriptions case-insensitively", async () => {
    await listNotes(
      "access-token",
      new URLSearchParams({ search: "  milk  " }),
    );

    expect(mocks.prisma.notes.findMany).toHaveBeenCalledWith({
      where: {
        user_id: USER_ID,
        OR: [
          { title: { contains: "milk", mode: "insensitive" } },
          { description: { contains: "milk", mode: "insensitive" } },
        ],
      },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      skip: 0,
      take: 20,
      select: NOTE_SELECT,
    });
  });

  it("filters by project id", async () => {
    await listNotes(
      "access-token",
      new URLSearchParams({ project_id: PROJECT_ID }),
    );

    expect(mocks.prisma.notes.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: USER_ID, project_id: PROJECT_ID },
      }),
    );
  });

  it("filters by the tag linked to the note's project", async () => {
    await listNotes("access-token", new URLSearchParams({ tag_id: TAG_ID }));

    expect(mocks.prisma.notes.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: USER_ID, projects: { tag_id: TAG_ID } },
      }),
    );
  });

  it("combines the search, project and tag filters", async () => {
    await listNotes(
      "access-token",
      new URLSearchParams({
        search: "milk",
        project_id: PROJECT_ID,
        tag_id: TAG_ID,
      }),
    );

    expect(mocks.prisma.notes.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          user_id: USER_ID,
          project_id: PROJECT_ID,
          projects: { tag_id: TAG_ID },
          OR: [
            { title: { contains: "milk", mode: "insensitive" } },
            { description: { contains: "milk", mode: "insensitive" } },
          ],
        },
      }),
    );
  });

  it("applies pagination and computes the page count", async () => {
    mocks.prisma.notes.count.mockResolvedValue(25);

    const result = await listNotes(
      "access-token",
      new URLSearchParams({ page: "2", perPage: "10" }),
    );

    expect(mocks.prisma.notes.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
    expect(result.meta).toEqual({
      page: 2,
      perPage: 10,
      total: 25,
      totalPage: 3,
    });
  });

  it("supports ascending order", async () => {
    await listNotes("access-token", new URLSearchParams({ order: "asc" }));

    expect(mocks.prisma.notes.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ created_at: "asc" }, { id: "asc" }],
      }),
    );
  });

  it("sorts by title or updated_at", async () => {
    await listNotes("access-token", new URLSearchParams({ sort: "title" }));
    expect(mocks.prisma.notes.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ title: "desc" }, { id: "desc" }],
      }),
    );

    await listNotes(
      "access-token",
      new URLSearchParams({ sort: "updated_at", order: "asc" }),
    );
    expect(mocks.prisma.notes.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ updated_at: "asc" }, { id: "asc" }],
      }),
    );
  });

  it("caps perPage at 100", async () => {
    await listNotes("access-token", new URLSearchParams({ perPage: "500" }));

    expect(mocks.prisma.notes.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it("reports zero pages when there are no notes", async () => {
    mocks.prisma.notes.findMany.mockResolvedValue([]);
    mocks.prisma.notes.count.mockResolvedValue(0);

    const result = await listNotes("access-token", new URLSearchParams());

    expect(result).toEqual({
      items: [],
      meta: { page: 1, perPage: 20, total: 0, totalPage: 0 },
    });
  });

  it("rejects invalid query parameters before querying the database", async () => {
    const error = await captureApiError(
      listNotes(
        "access-token",
        new URLSearchParams({
          page: "0",
          project_id: "nope",
          sort: "name",
          order: "sideways",
        }),
      ),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { field: "page", message: "Must be a positive integer" },
      { field: "project_id", message: "Must be a valid UUID" },
      {
        field: "sort",
        message: "Must be one of: created_at, updated_at, title",
      },
      { field: "order", message: "Must be one of: asc, desc" },
    ]);
    expect(mocks.prisma.notes.findMany).not.toHaveBeenCalled();
    expect(mocks.prisma.notes.count).not.toHaveBeenCalled();
  });

  it("propagates authentication failures", async () => {
    mocks.getAuthenticatedUserId.mockRejectedValue(ApiError.unauthorized());

    const error = await captureApiError(
      listNotes(undefined, new URLSearchParams()),
    );

    expect(error.code).toBe("UNAUTHORIZED");
    expect(mocks.prisma.notes.findMany).not.toHaveBeenCalled();
  });

  it("propagates transaction failures", async () => {
    const databaseError = new Error("transaction failed");
    mocks.prisma.$transaction.mockRejectedValue(databaseError);

    await expect(
      listNotes("access-token", new URLSearchParams()),
    ).rejects.toBe(databaseError);
  });
});

describe("getNote", () => {
  it("returns a note with its sections ordered by note_order", async () => {
    mocks.prisma.notes.findFirst.mockResolvedValue({
      ...note,
      note_section: [section],
    });

    const result = await getNote("access-token", NOTE_ID);

    expect(mocks.getAuthenticatedUserId).toHaveBeenCalledWith("access-token");
    expect(mocks.prisma.notes.findFirst).toHaveBeenCalledWith({
      where: { id: NOTE_ID, user_id: USER_ID },
      select: NOTE_DETAIL_SELECT,
    });
    expect(result).toEqual({ ...note, sections: [section] });
  });

  it("returns an empty sections array", async () => {
    mocks.prisma.notes.findFirst.mockResolvedValue({
      ...note,
      note_section: [],
    });

    const result = await getNote("access-token", NOTE_ID);

    expect(result.sections).toEqual([]);
  });

  it("rejects a missing note", async () => {
    mocks.prisma.notes.findFirst.mockResolvedValue(null);

    const error = await captureApiError(getNote("access-token", NOTE_ID));

    expect(error.code).toBe("NOT_FOUND");
    expect(error.status).toBe(404);
    expect(error.message).toBe("Note not found");
  });

  it("rejects a malformed note id without querying the database", async () => {
    const error = await captureApiError(getNote("access-token", "not-a-uuid"));

    expect(error.code).toBe("NOT_FOUND");
    expect(mocks.prisma.notes.findFirst).not.toHaveBeenCalled();
  });

  it("propagates authentication failures", async () => {
    mocks.getAuthenticatedUserId.mockRejectedValue(ApiError.unauthorized());

    const error = await captureApiError(getNote(undefined, NOTE_ID));

    expect(error.code).toBe("UNAUTHORIZED");
    expect(mocks.prisma.notes.findFirst).not.toHaveBeenCalled();
  });
});

describe("createNote", () => {
  beforeEach(() => {
    mocks.prisma.notes.create.mockResolvedValue({
      ...note,
      note_section: [],
    });
  });

  it("creates a note with null optional fields and no sections", async () => {
    const result = await createNote("access-token", { title: "Shopping" });

    expect(mocks.getAuthenticatedUserId).toHaveBeenCalledWith("access-token");
    expect(mocks.prisma.projects.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.notes.create).toHaveBeenCalledWith({
      data: {
        user_id: USER_ID,
        project_id: null,
        title: "Shopping",
        description: null,
      },
      select: NOTE_DETAIL_SELECT,
    });
    expect(result).toEqual({ ...note, sections: [] });
  });

  it("trims the title", async () => {
    await createNote("access-token", { title: "  Shopping  " });

    expect(mocks.prisma.notes.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "Shopping" }),
      }),
    );
  });

  it("creates a note linked to a project owned by the user", async () => {
    mocks.prisma.projects.findFirst.mockResolvedValue({ id: PROJECT_ID });

    await createNote("access-token", {
      title: "Shopping",
      description: "Weekly groceries",
      project_id: PROJECT_ID,
    });

    expect(mocks.prisma.projects.findFirst).toHaveBeenCalledWith({
      where: { id: PROJECT_ID, user_id: USER_ID },
      select: { id: true },
    });
    expect(mocks.prisma.notes.create).toHaveBeenCalledWith({
      data: {
        user_id: USER_ID,
        project_id: PROJECT_ID,
        title: "Shopping",
        description: "Weekly groceries",
      },
      select: NOTE_DETAIL_SELECT,
    });
  });

  it("creates the note and its sections in one nested write", async () => {
    mocks.prisma.notes.create.mockResolvedValue({
      ...note,
      note_section: [section],
    });

    const result = await createNote("access-token", {
      title: "Shopping",
      sections: [{ content: "Milk" }, { content: null }],
    });

    expect(mocks.prisma.notes.create).toHaveBeenCalledWith({
      data: {
        user_id: USER_ID,
        project_id: null,
        title: "Shopping",
        description: null,
        note_section: {
          create: [
            { content: "Milk", note_order: 1 },
            { content: null, note_order: 2 },
          ],
        },
      },
      select: NOTE_DETAIL_SELECT,
    });
    expect(result.sections).toEqual([section]);
  });

  it("rejects a missing or foreign project before writing to the database", async () => {
    mocks.prisma.projects.findFirst.mockResolvedValue(null);

    const error = await captureApiError(
      createNote("access-token", {
        title: "Shopping",
        project_id: PROJECT_ID,
      }),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Project not found");
    expect(mocks.prisma.notes.create).not.toHaveBeenCalled();
  });

  it("rejects a missing title before writing to the database", async () => {
    const error = await captureApiError(createNote("access-token", {}));

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([{ field: "title", message: "Is required" }]);
    expect(mocks.prisma.notes.create).not.toHaveBeenCalled();
  });

  it("rejects invalid sections before writing to the database", async () => {
    const error = await captureApiError(
      createNote("access-token", {
        title: "Shopping",
        sections: [{ note_order: 0 }],
      }),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      {
        field: "sections[0].note_order",
        message: "Must be a positive integer",
      },
    ]);
    expect(mocks.prisma.notes.create).not.toHaveBeenCalled();
  });

  it("rejects unknown fields before writing to the database", async () => {
    const error = await captureApiError(
      createNote("access-token", { title: "Shopping", user_id: USER_ID }),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { field: "user_id", message: "Unknown field" },
    ]);
    expect(mocks.prisma.notes.create).not.toHaveBeenCalled();
  });

  it("propagates authentication failures", async () => {
    mocks.getAuthenticatedUserId.mockRejectedValue(ApiError.unauthorized());

    const error = await captureApiError(
      createNote(undefined, { title: "Shopping" }),
    );

    expect(error.code).toBe("UNAUTHORIZED");
    expect(mocks.prisma.notes.create).not.toHaveBeenCalled();
  });

  it("propagates unexpected database errors", async () => {
    const databaseError = new Error("database is down");
    mocks.prisma.notes.create.mockRejectedValue(databaseError);

    await expect(
      createNote("access-token", { title: "Shopping" }),
    ).rejects.toBe(databaseError);
  });
});

describe("updateNote", () => {
  beforeEach(() => {
    mocks.prisma.notes.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.notes.findFirst.mockResolvedValue({
      ...note,
      title: "Groceries",
    });
  });

  it("updates the title owned by the authenticated user", async () => {
    const result = await updateNote("access-token", NOTE_ID, {
      title: "  Groceries  ",
    });

    expect(mocks.getAuthenticatedUserId).toHaveBeenCalledWith("access-token");
    expect(mocks.prisma.notes.updateMany).toHaveBeenCalledWith({
      where: { id: NOTE_ID, user_id: USER_ID },
      data: { title: "Groceries", updated_at: expect.any(Date) },
    });
    expect(mocks.prisma.notes.findFirst).toHaveBeenCalledWith({
      where: { id: NOTE_ID, user_id: USER_ID },
      select: NOTE_SELECT,
    });
    expect(result).toEqual({ ...note, title: "Groceries" });
  });

  it("updates only the description", async () => {
    await updateNote("access-token", NOTE_ID, {
      description: "Updated",
    });

    expect(mocks.prisma.notes.updateMany).toHaveBeenCalledWith({
      where: { id: NOTE_ID, user_id: USER_ID },
      data: { description: "Updated", updated_at: expect.any(Date) },
    });
  });

  it("clears the description with null", async () => {
    await updateNote("access-token", NOTE_ID, { description: null });

    expect(mocks.prisma.notes.updateMany).toHaveBeenCalledWith({
      where: { id: NOTE_ID, user_id: USER_ID },
      data: { description: null, updated_at: expect.any(Date) },
    });
  });

  it("attaches a project owned by the user", async () => {
    mocks.prisma.projects.findFirst.mockResolvedValue({ id: PROJECT_ID });

    await updateNote("access-token", NOTE_ID, { project_id: PROJECT_ID });

    expect(mocks.prisma.projects.findFirst).toHaveBeenCalledWith({
      where: { id: PROJECT_ID, user_id: USER_ID },
      select: { id: true },
    });
    expect(mocks.prisma.notes.updateMany).toHaveBeenCalledWith({
      where: { id: NOTE_ID, user_id: USER_ID },
      data: { project_id: PROJECT_ID, updated_at: expect.any(Date) },
    });
  });

  it("detaches the project with null without checking ownership", async () => {
    await updateNote("access-token", NOTE_ID, { project_id: null });

    expect(mocks.prisma.projects.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.notes.updateMany).toHaveBeenCalledWith({
      where: { id: NOTE_ID, user_id: USER_ID },
      data: { project_id: null, updated_at: expect.any(Date) },
    });
  });

  it("rejects a missing or foreign project before writing to the database", async () => {
    mocks.prisma.projects.findFirst.mockResolvedValue(null);

    const error = await captureApiError(
      updateNote("access-token", NOTE_ID, { project_id: PROJECT_ID }),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Project not found");
    expect(mocks.prisma.notes.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a note that does not belong to the user", async () => {
    mocks.prisma.notes.updateMany.mockResolvedValue({ count: 0 });

    const error = await captureApiError(
      updateNote("access-token", NOTE_ID, { title: "Groceries" }),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Note not found");
    expect(mocks.prisma.notes.findFirst).not.toHaveBeenCalled();
  });

  it("rejects when the note disappears after the update", async () => {
    mocks.prisma.notes.findFirst.mockResolvedValue(null);

    const error = await captureApiError(
      updateNote("access-token", NOTE_ID, { title: "Groceries" }),
    );

    expect(error.code).toBe("NOT_FOUND");
  });

  it("rejects a malformed note id without writing to the database", async () => {
    const error = await captureApiError(
      updateNote("access-token", "not-a-uuid", { title: "Groceries" }),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(mocks.prisma.notes.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an empty body before writing to the database", async () => {
    const error = await captureApiError(
      updateNote("access-token", NOTE_ID, {}),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { message: "At least one field is required" },
    ]);
    expect(mocks.prisma.notes.updateMany).not.toHaveBeenCalled();
  });

  it("rejects sections on update before writing to the database", async () => {
    const error = await captureApiError(
      updateNote("access-token", NOTE_ID, {
        sections: [{ content: "Milk" }],
      }),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { field: "sections", message: "Unknown field" },
      { message: "At least one field is required" },
    ]);
    expect(mocks.prisma.notes.updateMany).not.toHaveBeenCalled();
  });

  it("propagates authentication failures", async () => {
    mocks.getAuthenticatedUserId.mockRejectedValue(ApiError.unauthorized());

    const error = await captureApiError(
      updateNote(undefined, NOTE_ID, { title: "Groceries" }),
    );

    expect(error.code).toBe("UNAUTHORIZED");
    expect(mocks.prisma.notes.updateMany).not.toHaveBeenCalled();
  });

  it("propagates unexpected database errors", async () => {
    const databaseError = new Error("database is down");
    mocks.prisma.notes.updateMany.mockRejectedValue(databaseError);

    await expect(
      updateNote("access-token", NOTE_ID, { title: "Groceries" }),
    ).rejects.toBe(databaseError);
  });
});

describe("deleteNote", () => {
  it("deletes a note owned by the authenticated user", async () => {
    mocks.prisma.notes.deleteMany.mockResolvedValue({ count: 1 });

    await deleteNote("access-token", NOTE_ID);

    expect(mocks.getAuthenticatedUserId).toHaveBeenCalledWith("access-token");
    expect(mocks.prisma.notes.deleteMany).toHaveBeenCalledWith({
      where: { id: NOTE_ID, user_id: USER_ID },
    });
  });

  it("rejects a note that does not belong to the user", async () => {
    mocks.prisma.notes.deleteMany.mockResolvedValue({ count: 0 });

    const error = await captureApiError(
      deleteNote("access-token", NOTE_ID),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Note not found");
  });

  it("rejects a malformed note id without deleting", async () => {
    const error = await captureApiError(
      deleteNote("access-token", "not-a-uuid"),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(mocks.prisma.notes.deleteMany).not.toHaveBeenCalled();
  });

  it("propagates authentication failures", async () => {
    mocks.getAuthenticatedUserId.mockRejectedValue(ApiError.unauthorized());

    const error = await captureApiError(deleteNote(undefined, NOTE_ID));

    expect(error.code).toBe("UNAUTHORIZED");
    expect(mocks.prisma.notes.deleteMany).not.toHaveBeenCalled();
  });

  it("propagates unexpected database errors", async () => {
    const databaseError = new Error("database is down");
    mocks.prisma.notes.deleteMany.mockRejectedValue(databaseError);

    await expect(deleteNote("access-token", NOTE_ID)).rejects.toBe(
      databaseError,
    );
  });
});
