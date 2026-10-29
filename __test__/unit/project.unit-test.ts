import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";

const mocks = vi.hoisted(() => {
  const prisma = {
    projects: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    tags: {
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
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from "@/services/project.services";

const USER_ID = "22222222-2222-2222-2222-222222222222";
const PROJECT_ID = "33333333-3333-3333-3333-333333333333";
const TAG_ID = "44444444-4444-4444-4444-444444444444";

const project = {
  id: PROJECT_ID,
  title: "Roadmap",
  description: "Quarterly plan",
  tag_id: null,
};

const PROJECT_SELECT = {
  id: true,
  title: true,
  description: true,
  tag_id: true,
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

describe("listProjects", () => {
  beforeEach(() => {
    mocks.prisma.projects.findMany.mockResolvedValue([project]);
    mocks.prisma.projects.count.mockResolvedValue(1);
  });

  it("returns the first page sorted by title", async () => {
    const result = await listProjects("access-token", new URLSearchParams());

    expect(mocks.getAuthenticatedUserId).toHaveBeenCalledWith("access-token");
    expect(mocks.prisma.projects.findMany).toHaveBeenCalledWith({
      where: { user_id: USER_ID },
      orderBy: { title: "asc" },
      skip: 0,
      take: 20,
      select: PROJECT_SELECT,
    });
    expect(mocks.prisma.projects.count).toHaveBeenCalledWith({
      where: { user_id: USER_ID },
    });
    expect(result).toEqual({
      items: [project],
      meta: { page: 1, perPage: 20, total: 1, totalPage: 1 },
    });
  });

  it("searches titles and descriptions case-insensitively", async () => {
    await listProjects(
      "access-token",
      new URLSearchParams({ search: "  road  " }),
    );

    expect(mocks.prisma.projects.findMany).toHaveBeenCalledWith({
      where: {
        user_id: USER_ID,
        OR: [
          { title: { contains: "road", mode: "insensitive" } },
          { description: { contains: "road", mode: "insensitive" } },
        ],
      },
      orderBy: { title: "asc" },
      skip: 0,
      take: 20,
      select: PROJECT_SELECT,
    });
    expect(mocks.prisma.projects.count).toHaveBeenCalledWith({
      where: {
        user_id: USER_ID,
        OR: [
          { title: { contains: "road", mode: "insensitive" } },
          { description: { contains: "road", mode: "insensitive" } },
        ],
      },
    });
  });

  it("filters by tag id", async () => {
    await listProjects(
      "access-token",
      new URLSearchParams({ tag_id: TAG_ID }),
    );

    expect(mocks.prisma.projects.findMany).toHaveBeenCalledWith({
      where: { user_id: USER_ID, tag_id: TAG_ID },
      orderBy: { title: "asc" },
      skip: 0,
      take: 20,
      select: PROJECT_SELECT,
    });
  });

  it("combines the search and tag filters", async () => {
    await listProjects(
      "access-token",
      new URLSearchParams({ search: "road", tag_id: TAG_ID }),
    );

    expect(mocks.prisma.projects.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          user_id: USER_ID,
          tag_id: TAG_ID,
          OR: [
            { title: { contains: "road", mode: "insensitive" } },
            { description: { contains: "road", mode: "insensitive" } },
          ],
        },
      }),
    );
  });

  it("applies pagination and computes the page count", async () => {
    mocks.prisma.projects.count.mockResolvedValue(25);

    const result = await listProjects(
      "access-token",
      new URLSearchParams({ page: "2", perPage: "10" }),
    );

    expect(mocks.prisma.projects.findMany).toHaveBeenCalledWith({
      where: { user_id: USER_ID },
      orderBy: { title: "asc" },
      skip: 10,
      take: 10,
      select: PROJECT_SELECT,
    });
    expect(result.meta).toEqual({
      page: 2,
      perPage: 10,
      total: 25,
      totalPage: 3,
    });
  });

  it("supports descending order", async () => {
    await listProjects("access-token", new URLSearchParams({ order: "desc" }));

    expect(mocks.prisma.projects.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { title: "desc" } }),
    );
  });

  it("caps perPage at 100", async () => {
    await listProjects("access-token", new URLSearchParams({ perPage: "500" }));

    expect(mocks.prisma.projects.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it("reports zero pages when there are no projects", async () => {
    mocks.prisma.projects.findMany.mockResolvedValue([]);
    mocks.prisma.projects.count.mockResolvedValue(0);

    const result = await listProjects("access-token", new URLSearchParams());

    expect(result).toEqual({
      items: [],
      meta: { page: 1, perPage: 20, total: 0, totalPage: 0 },
    });
  });

  it("rejects invalid query parameters before querying the database", async () => {
    const error = await captureApiError(
      listProjects(
        "access-token",
        new URLSearchParams({
          page: "0",
          tag_id: "nope",
          order: "sideways",
        }),
      ),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { field: "page", message: "Must be a positive integer" },
      { field: "tag_id", message: "Must be a valid UUID" },
      { field: "order", message: "Must be one of: asc, desc" },
    ]);
    expect(mocks.prisma.projects.findMany).not.toHaveBeenCalled();
    expect(mocks.prisma.projects.count).not.toHaveBeenCalled();
  });

  it("propagates authentication failures", async () => {
    mocks.getAuthenticatedUserId.mockRejectedValue(ApiError.unauthorized());

    const error = await captureApiError(
      listProjects(undefined, new URLSearchParams()),
    );

    expect(error.code).toBe("UNAUTHORIZED");
    expect(mocks.prisma.projects.findMany).not.toHaveBeenCalled();
  });

  it("propagates transaction failures", async () => {
    const databaseError = new Error("transaction failed");
    mocks.prisma.$transaction.mockRejectedValue(databaseError);

    await expect(
      listProjects("access-token", new URLSearchParams()),
    ).rejects.toBe(databaseError);
  });
});

describe("getProject", () => {
  it("returns a project owned by the authenticated user", async () => {
    mocks.prisma.projects.findFirst.mockResolvedValue(project);

    const result = await getProject("access-token", PROJECT_ID);

    expect(mocks.getAuthenticatedUserId).toHaveBeenCalledWith("access-token");
    expect(mocks.prisma.projects.findFirst).toHaveBeenCalledWith({
      where: { id: PROJECT_ID, user_id: USER_ID },
      select: PROJECT_SELECT,
    });
    expect(result).toEqual(project);
  });

  it("rejects a missing project", async () => {
    mocks.prisma.projects.findFirst.mockResolvedValue(null);

    const error = await captureApiError(getProject("access-token", PROJECT_ID));

    expect(error.code).toBe("NOT_FOUND");
    expect(error.status).toBe(404);
    expect(error.message).toBe("Project not found");
  });

  it("rejects a malformed project id without querying the database", async () => {
    const error = await captureApiError(
      getProject("access-token", "not-a-uuid"),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(mocks.prisma.projects.findFirst).not.toHaveBeenCalled();
  });

  it("propagates authentication failures", async () => {
    mocks.getAuthenticatedUserId.mockRejectedValue(ApiError.unauthorized());

    const error = await captureApiError(getProject(undefined, PROJECT_ID));

    expect(error.code).toBe("UNAUTHORIZED");
    expect(mocks.prisma.projects.findFirst).not.toHaveBeenCalled();
  });
});

describe("createProject", () => {
  it("creates a project with null optional fields", async () => {
    mocks.prisma.projects.create.mockResolvedValue(project);

    const result = await createProject("access-token", { title: "Roadmap" });

    expect(mocks.getAuthenticatedUserId).toHaveBeenCalledWith("access-token");
    expect(mocks.prisma.tags.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.projects.create).toHaveBeenCalledWith({
      data: {
        user_id: USER_ID,
        title: "Roadmap",
        description: null,
        tag_id: null,
      },
      select: PROJECT_SELECT,
    });
    expect(result).toEqual(project);
  });

  it("trims the title", async () => {
    mocks.prisma.projects.create.mockResolvedValue(project);

    await createProject("access-token", { title: "  Roadmap  " });

    expect(mocks.prisma.projects.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "Roadmap" }),
      }),
    );
  });

  it("creates a project linked to a tag owned by the user", async () => {
    mocks.prisma.tags.findFirst.mockResolvedValue({ id: TAG_ID });
    mocks.prisma.projects.create.mockResolvedValue({
      ...project,
      tag_id: TAG_ID,
    });

    const result = await createProject("access-token", {
      title: "Roadmap",
      description: "Quarterly plan",
      tag_id: TAG_ID,
    });

    expect(mocks.prisma.tags.findFirst).toHaveBeenCalledWith({
      where: { id: TAG_ID, user_id: USER_ID },
      select: { id: true },
    });
    expect(mocks.prisma.projects.create).toHaveBeenCalledWith({
      data: {
        user_id: USER_ID,
        title: "Roadmap",
        description: "Quarterly plan",
        tag_id: TAG_ID,
      },
      select: PROJECT_SELECT,
    });
    expect(result.tag_id).toBe(TAG_ID);
  });

  it("rejects a missing or foreign tag before writing to the database", async () => {
    mocks.prisma.tags.findFirst.mockResolvedValue(null);

    const error = await captureApiError(
      createProject("access-token", { title: "Roadmap", tag_id: TAG_ID }),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Tag not found");
    expect(mocks.prisma.projects.create).not.toHaveBeenCalled();
  });

  it("rejects a missing title before writing to the database", async () => {
    const error = await captureApiError(createProject("access-token", {}));

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([{ field: "title", message: "Is required" }]);
    expect(mocks.prisma.projects.create).not.toHaveBeenCalled();
  });

  it("rejects unknown fields before writing to the database", async () => {
    const error = await captureApiError(
      createProject("access-token", { title: "Roadmap", user_id: USER_ID }),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { field: "user_id", message: "Unknown field" },
    ]);
    expect(mocks.prisma.projects.create).not.toHaveBeenCalled();
  });

  it("propagates authentication failures", async () => {
    mocks.getAuthenticatedUserId.mockRejectedValue(ApiError.unauthorized());

    const error = await captureApiError(
      createProject(undefined, { title: "Roadmap" }),
    );

    expect(error.code).toBe("UNAUTHORIZED");
    expect(mocks.prisma.projects.create).not.toHaveBeenCalled();
  });

  it("propagates unexpected database errors", async () => {
    const databaseError = new Error("database is down");
    mocks.prisma.projects.create.mockRejectedValue(databaseError);

    await expect(
      createProject("access-token", { title: "Roadmap" }),
    ).rejects.toBe(databaseError);
  });
});

describe("updateProject", () => {
  beforeEach(() => {
    mocks.prisma.projects.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.projects.findFirst.mockResolvedValue({
      ...project,
      title: "Personal",
    });
  });

  it("updates the title owned by the authenticated user", async () => {
    const result = await updateProject("access-token", PROJECT_ID, {
      title: "  Personal  ",
    });

    expect(mocks.getAuthenticatedUserId).toHaveBeenCalledWith("access-token");
    expect(mocks.prisma.projects.updateMany).toHaveBeenCalledWith({
      where: { id: PROJECT_ID, user_id: USER_ID },
      data: { title: "Personal" },
    });
    expect(mocks.prisma.projects.findFirst).toHaveBeenCalledWith({
      where: { id: PROJECT_ID, user_id: USER_ID },
      select: PROJECT_SELECT,
    });
    expect(result).toEqual({ ...project, title: "Personal" });
  });

  it("updates only the description", async () => {
    await updateProject("access-token", PROJECT_ID, {
      description: "Updated",
    });

    expect(mocks.prisma.projects.updateMany).toHaveBeenCalledWith({
      where: { id: PROJECT_ID, user_id: USER_ID },
      data: { description: "Updated" },
    });
  });

  it("clears the description with null", async () => {
    await updateProject("access-token", PROJECT_ID, { description: null });

    expect(mocks.prisma.projects.updateMany).toHaveBeenCalledWith({
      where: { id: PROJECT_ID, user_id: USER_ID },
      data: { description: null },
    });
  });

  it("attaches a tag owned by the user", async () => {
    mocks.prisma.tags.findFirst.mockResolvedValue({ id: TAG_ID });

    await updateProject("access-token", PROJECT_ID, { tag_id: TAG_ID });

    expect(mocks.prisma.tags.findFirst).toHaveBeenCalledWith({
      where: { id: TAG_ID, user_id: USER_ID },
      select: { id: true },
    });
    expect(mocks.prisma.projects.updateMany).toHaveBeenCalledWith({
      where: { id: PROJECT_ID, user_id: USER_ID },
      data: { tag_id: TAG_ID },
    });
  });

  it("detaches the tag with null without checking tag ownership", async () => {
    await updateProject("access-token", PROJECT_ID, { tag_id: null });

    expect(mocks.prisma.tags.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.projects.updateMany).toHaveBeenCalledWith({
      where: { id: PROJECT_ID, user_id: USER_ID },
      data: { tag_id: null },
    });
  });

  it("rejects a missing or foreign tag before writing to the database", async () => {
    mocks.prisma.tags.findFirst.mockResolvedValue(null);

    const error = await captureApiError(
      updateProject("access-token", PROJECT_ID, { tag_id: TAG_ID }),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Tag not found");
    expect(mocks.prisma.projects.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a project that does not belong to the user", async () => {
    mocks.prisma.projects.updateMany.mockResolvedValue({ count: 0 });

    const error = await captureApiError(
      updateProject("access-token", PROJECT_ID, { title: "Personal" }),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Project not found");
    expect(mocks.prisma.projects.findFirst).not.toHaveBeenCalled();
  });

  it("rejects when the project disappears after the update", async () => {
    mocks.prisma.projects.findFirst.mockResolvedValue(null);

    const error = await captureApiError(
      updateProject("access-token", PROJECT_ID, { title: "Personal" }),
    );

    expect(error.code).toBe("NOT_FOUND");
  });

  it("rejects a malformed project id without writing to the database", async () => {
    const error = await captureApiError(
      updateProject("access-token", "not-a-uuid", { title: "Personal" }),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(mocks.prisma.projects.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an empty body before writing to the database", async () => {
    const error = await captureApiError(
      updateProject("access-token", PROJECT_ID, {}),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { message: "At least one field is required" },
    ]);
    expect(mocks.prisma.projects.updateMany).not.toHaveBeenCalled();
  });

  it("propagates authentication failures", async () => {
    mocks.getAuthenticatedUserId.mockRejectedValue(ApiError.unauthorized());

    const error = await captureApiError(
      updateProject(undefined, PROJECT_ID, { title: "Personal" }),
    );

    expect(error.code).toBe("UNAUTHORIZED");
    expect(mocks.prisma.projects.updateMany).not.toHaveBeenCalled();
  });

  it("propagates unexpected database errors", async () => {
    const databaseError = new Error("database is down");
    mocks.prisma.projects.updateMany.mockRejectedValue(databaseError);

    await expect(
      updateProject("access-token", PROJECT_ID, { title: "Personal" }),
    ).rejects.toBe(databaseError);
  });
});

describe("deleteProject", () => {
  it("deletes a project owned by the authenticated user", async () => {
    mocks.prisma.projects.deleteMany.mockResolvedValue({ count: 1 });

    await deleteProject("access-token", PROJECT_ID);

    expect(mocks.getAuthenticatedUserId).toHaveBeenCalledWith("access-token");
    expect(mocks.prisma.projects.deleteMany).toHaveBeenCalledWith({
      where: { id: PROJECT_ID, user_id: USER_ID },
    });
  });

  it("rejects a project that does not belong to the user", async () => {
    mocks.prisma.projects.deleteMany.mockResolvedValue({ count: 0 });

    const error = await captureApiError(
      deleteProject("access-token", PROJECT_ID),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Project not found");
  });

  it("rejects a malformed project id without deleting", async () => {
    const error = await captureApiError(
      deleteProject("access-token", "not-a-uuid"),
    );

    expect(error.code).toBe("NOT_FOUND");
    expect(mocks.prisma.projects.deleteMany).not.toHaveBeenCalled();
  });

  it("propagates authentication failures", async () => {
    mocks.getAuthenticatedUserId.mockRejectedValue(ApiError.unauthorized());

    const error = await captureApiError(deleteProject(undefined, PROJECT_ID));

    expect(error.code).toBe("UNAUTHORIZED");
    expect(mocks.prisma.projects.deleteMany).not.toHaveBeenCalled();
  });

  it("propagates unexpected database errors", async () => {
    const databaseError = new Error("database is down");
    mocks.prisma.projects.deleteMany.mockRejectedValue(databaseError);

    await expect(
      deleteProject("access-token", PROJECT_ID),
    ).rejects.toBe(databaseError);
  });
});
