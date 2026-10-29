import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";

const mocks = vi.hoisted(() => {
  const prisma = {
    tags: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
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
  createTag,
  deleteTag,
  getTag,
  listTags,
  updateTag,
} from "@/services/tag.services";

const USER_ID = "22222222-2222-2222-2222-222222222222";
const TAG_ID = "33333333-3333-3333-3333-333333333333";

const tag = { id: TAG_ID, name: "Work" };

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

describe("listTags", () => {
  beforeEach(() => {
    mocks.prisma.tags.findMany.mockResolvedValue([tag]);
    mocks.prisma.tags.count.mockResolvedValue(1);
  });

  it("returns the first page sorted by name", async () => {
    const result = await listTags("access-token", new URLSearchParams());

    expect(mocks.getAuthenticatedUserId).toHaveBeenCalledWith("access-token");
    expect(mocks.prisma.tags.findMany).toHaveBeenCalledWith({
      where: { user_id: USER_ID },
      orderBy: { name: "asc" },
      skip: 0,
      take: 20,
      select: { id: true, name: true },
    });
    expect(mocks.prisma.tags.count).toHaveBeenCalledWith({
      where: { user_id: USER_ID },
    });
    expect(result).toEqual({
      items: [tag],
      meta: { page: 1, perPage: 20, total: 1, totalPage: 1 },
    });
  });

  it("applies a trimmed case-insensitive search filter", async () => {
    await listTags(
      "access-token",
      new URLSearchParams({ search: "  wo  " }),
    );

    expect(mocks.prisma.tags.findMany).toHaveBeenCalledWith({
      where: {
        user_id: USER_ID,
        name: { contains: "wo", mode: "insensitive" },
      },
      orderBy: { name: "asc" },
      skip: 0,
      take: 20,
      select: { id: true, name: true },
    });
    expect(mocks.prisma.tags.count).toHaveBeenCalledWith({
      where: {
        user_id: USER_ID,
        name: { contains: "wo", mode: "insensitive" },
      },
    });
  });

  it("applies pagination and computes the page count", async () => {
    mocks.prisma.tags.count.mockResolvedValue(25);

    const result = await listTags(
      "access-token",
      new URLSearchParams({ page: "2", perPage: "10" }),
    );

    expect(mocks.prisma.tags.findMany).toHaveBeenCalledWith({
      where: { user_id: USER_ID },
      orderBy: { name: "asc" },
      skip: 10,
      take: 10,
      select: { id: true, name: true },
    });
    expect(result.meta).toEqual({
      page: 2,
      perPage: 10,
      total: 25,
      totalPage: 3,
    });
  });

  it("supports descending order", async () => {
    await listTags("access-token", new URLSearchParams({ order: "desc" }));

    expect(mocks.prisma.tags.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: "desc" } }),
    );
  });

  it("caps perPage at 100", async () => {
    await listTags("access-token", new URLSearchParams({ perPage: "500" }));

    expect(mocks.prisma.tags.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it("reports zero pages when there are no tags", async () => {
    mocks.prisma.tags.findMany.mockResolvedValue([]);
    mocks.prisma.tags.count.mockResolvedValue(0);

    const result = await listTags("access-token", new URLSearchParams());

    expect(result).toEqual({
      items: [],
      meta: { page: 1, perPage: 20, total: 0, totalPage: 0 },
    });
  });

  it("rejects invalid query parameters before querying the database", async () => {
    const error = await captureApiError(
      listTags(
        "access-token",
        new URLSearchParams({ page: "0", order: "sideways" }),
      ),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { field: "page", message: "Must be a positive integer" },
      { field: "order", message: "Must be one of: asc, desc" },
    ]);
    expect(mocks.prisma.tags.findMany).not.toHaveBeenCalled();
    expect(mocks.prisma.tags.count).not.toHaveBeenCalled();
  });

  it("propagates authentication failures", async () => {
    mocks.getAuthenticatedUserId.mockRejectedValue(ApiError.unauthorized());

    const error = await captureApiError(
      listTags(undefined, new URLSearchParams()),
    );

    expect(error.code).toBe("UNAUTHORIZED");
    expect(mocks.prisma.tags.findMany).not.toHaveBeenCalled();
  });

  it("propagates transaction failures", async () => {
    const databaseError = new Error("transaction failed");
    mocks.prisma.$transaction.mockRejectedValue(databaseError);

    await expect(listTags("access-token", new URLSearchParams())).rejects.toBe(
      databaseError,
    );
  });
});

describe("getTag", () => {
  it("returns a tag owned by the authenticated user", async () => {
    mocks.prisma.tags.findFirst.mockResolvedValue(tag);

    const result = await getTag("access-token", TAG_ID);

    expect(mocks.getAuthenticatedUserId).toHaveBeenCalledWith("access-token");
    expect(mocks.prisma.tags.findFirst).toHaveBeenCalledWith({
      where: { id: TAG_ID, user_id: USER_ID },
      select: { id: true, name: true },
    });
    expect(result).toEqual(tag);
  });

  it("rejects a missing tag", async () => {
    mocks.prisma.tags.findFirst.mockResolvedValue(null);

    const error = await captureApiError(getTag("access-token", TAG_ID));

    expect(error.code).toBe("NOT_FOUND");
    expect(error.status).toBe(404);
    expect(error.message).toBe("Tag not found");
  });

  it("rejects a malformed tag id without querying the database", async () => {
    const error = await captureApiError(
      getTag("access-token", "not-a-uuid"),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(mocks.prisma.tags.findFirst).not.toHaveBeenCalled();
  });

  it("propagates authentication failures", async () => {
    mocks.getAuthenticatedUserId.mockRejectedValue(ApiError.unauthorized());

    const error = await captureApiError(getTag(undefined, TAG_ID));

    expect(error.code).toBe("UNAUTHORIZED");
    expect(mocks.prisma.tags.findFirst).not.toHaveBeenCalled();
  });
});

describe("createTag", () => {
  it("creates a tag for the authenticated user", async () => {
    mocks.prisma.tags.create.mockResolvedValue(tag);

    const result = await createTag("access-token", { name: "  Work  " });

    expect(mocks.getAuthenticatedUserId).toHaveBeenCalledWith("access-token");
    expect(mocks.prisma.tags.create).toHaveBeenCalledWith({
      data: { user_id: USER_ID, name: "Work" },
      select: { id: true, name: true },
    });
    expect(result).toEqual(tag);
  });

  it("rejects a missing name before writing to the database", async () => {
    const error = await captureApiError(createTag("access-token", {}));

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([{ field: "name", message: "Is required" }]);
    expect(mocks.prisma.tags.create).not.toHaveBeenCalled();
  });

  it("rejects unknown fields before writing to the database", async () => {
    const error = await captureApiError(
      createTag("access-token", { name: "Work", user_id: USER_ID }),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([{ field: "user_id", message: "Unknown field" }]);
    expect(mocks.prisma.tags.create).not.toHaveBeenCalled();
  });

  it("propagates authentication failures", async () => {
    mocks.getAuthenticatedUserId.mockRejectedValue(ApiError.unauthorized());

    const error = await captureApiError(createTag(undefined, { name: "Work" }));

    expect(error.code).toBe("UNAUTHORIZED");
    expect(mocks.prisma.tags.create).not.toHaveBeenCalled();
  });

  it("propagates unexpected database errors", async () => {
    const databaseError = new Error("database is down");
    mocks.prisma.tags.create.mockRejectedValue(databaseError);

    await expect(
      createTag("access-token", { name: "Work" }),
    ).rejects.toBe(databaseError);
  });
});

describe("updateTag", () => {
  beforeEach(() => {
    mocks.prisma.tags.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.tags.findUnique.mockResolvedValue({ ...tag, name: "Personal" });
  });

  it("updates a tag owned by the authenticated user", async () => {
    const result = await updateTag("access-token", TAG_ID, {
      name: "  Personal  ",
    });

    expect(mocks.getAuthenticatedUserId).toHaveBeenCalledWith("access-token");
    expect(mocks.prisma.tags.updateMany).toHaveBeenCalledWith({
      where: { id: TAG_ID, user_id: USER_ID },
      data: { name: "Personal" },
    });
    expect(mocks.prisma.tags.findUnique).toHaveBeenCalledWith({
      where: { id: TAG_ID },
      select: { id: true, name: true },
    });
    expect(result).toEqual({ ...tag, name: "Personal" });
  });

  it("rejects a tag that does not belong to the user", async () => {
    mocks.prisma.tags.updateMany.mockResolvedValue({ count: 0 });

    const error = await captureApiError(
      updateTag("access-token", TAG_ID, { name: "Personal" }),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Tag not found");
    expect(mocks.prisma.tags.findUnique).not.toHaveBeenCalled();
  });

  it("rejects when the tag disappears after the update", async () => {
    mocks.prisma.tags.findUnique.mockResolvedValue(null);

    const error = await captureApiError(
      updateTag("access-token", TAG_ID, { name: "Personal" }),
    );

    expect(error.code).toBe("NOT_FOUND");
  });

  it("rejects a malformed tag id without writing to the database", async () => {
    const error = await captureApiError(
      updateTag("access-token", "not-a-uuid", { name: "Personal" }),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(mocks.prisma.tags.updateMany).not.toHaveBeenCalled();
  });

  it("rejects invalid input before writing to the database", async () => {
    const error = await captureApiError(updateTag("access-token", TAG_ID, {}));

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([{ field: "name", message: "Is required" }]);
    expect(mocks.prisma.tags.updateMany).not.toHaveBeenCalled();
  });

  it("propagates authentication failures", async () => {
    mocks.getAuthenticatedUserId.mockRejectedValue(ApiError.unauthorized());

    const error = await captureApiError(
      updateTag(undefined, TAG_ID, { name: "Personal" }),
    );

    expect(error.code).toBe("UNAUTHORIZED");
    expect(mocks.prisma.tags.updateMany).not.toHaveBeenCalled();
  });
});

describe("deleteTag", () => {
  it("deletes a tag owned by the authenticated user", async () => {
    mocks.prisma.tags.deleteMany.mockResolvedValue({ count: 1 });

    await deleteTag("access-token", TAG_ID);

    expect(mocks.getAuthenticatedUserId).toHaveBeenCalledWith("access-token");
    expect(mocks.prisma.tags.deleteMany).toHaveBeenCalledWith({
      where: { id: TAG_ID, user_id: USER_ID },
    });
  });

  it("rejects a tag that does not belong to the user", async () => {
    mocks.prisma.tags.deleteMany.mockResolvedValue({ count: 0 });

    const error = await captureApiError(deleteTag("access-token", TAG_ID));

    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Tag not found");
  });

  it("rejects a malformed tag id without deleting", async () => {
    const error = await captureApiError(
      deleteTag("access-token", "not-a-uuid"),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(mocks.prisma.tags.deleteMany).not.toHaveBeenCalled();
  });

  it("propagates authentication failures", async () => {
    mocks.getAuthenticatedUserId.mockRejectedValue(ApiError.unauthorized());

    const error = await captureApiError(deleteTag(undefined, TAG_ID));

    expect(error.code).toBe("UNAUTHORIZED");
    expect(mocks.prisma.tags.deleteMany).not.toHaveBeenCalled();
  });

  it("propagates unexpected database errors", async () => {
    const databaseError = new Error("database is down");
    mocks.prisma.tags.deleteMany.mockRejectedValue(databaseError);

    await expect(deleteTag("access-token", TAG_ID)).rejects.toBe(databaseError);
  });
});
