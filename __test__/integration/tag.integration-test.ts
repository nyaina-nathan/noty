import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  inject,
  it,
} from "vitest";
import type { PrismaClient } from "@/prisma/generated/client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth-cookies";
import { signAccessToken } from "@/lib/jwt";
import {
  callRoute,
  jsonRequest,
} from "./helpers/auth";

interface TagBody {
  id: string;
  name: string;
}

interface TagListBody {
  items: TagBody[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPage: number;
  };
}

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: Array<{ field?: string; message: string }>;
  };
}

const JWT_SECRET = "integration-test-jwt-secret-0123456789abcdef";
const MISSING_TAG_ID = "11111111-1111-1111-1111-111111111111";

let prisma: PrismaClient;
let routes: {
  collection: typeof import("@/app/api/tags/route");
  item: typeof import("@/app/api/tags/[tagId]/route");
};

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function readError(response: Response): Promise<ErrorBody["error"]> {
  const body = await readJson<ErrorBody>(response);
  return body.error;
}

async function createUser(username: string) {
  const user = await prisma.users.create({
    data: {
      username,
      email: `${username}@example.com`,
      password_hash: "integration-test-password-hash",
    },
  });

  return { user, accessToken: await signAccessToken(user.id) };
}

async function seedTags(userId: string, names: string[]) {
  return Promise.all(
    names.map((name) => prisma.tags.create({ data: { user_id: userId, name } })),
  );
}

function authCookies(accessToken: string | undefined) {
  return { [ACCESS_TOKEN_COOKIE]: accessToken };
}

function listTagsRequest(accessToken: string | undefined, query = "") {
  return callRoute(
    routes.collection.GET,
    jsonRequest(`/api/tags${query}`, {
      method: "GET",
      cookies: authCookies(accessToken),
    }),
  );
}

function createTagRequest(
  accessToken: string | undefined,
  options: { body?: unknown; rawBody?: string },
) {
  return callRoute(
    routes.collection.POST,
    jsonRequest("/api/tags", {
      method: "POST",
      cookies: authCookies(accessToken),
      ...options,
    }),
  );
}

function getTagRequest(accessToken: string | undefined, tagId: string) {
  return callRoute(
    routes.item.GET,
    jsonRequest(`/api/tags/${tagId}`, {
      method: "GET",
      cookies: authCookies(accessToken),
    }),
    { params: Promise.resolve({ tagId }) },
  );
}

function updateTagRequest(
  accessToken: string | undefined,
  tagId: string,
  options: { body?: unknown; rawBody?: string },
) {
  return callRoute(
    routes.item.PATCH,
    jsonRequest(`/api/tags/${tagId}`, {
      method: "PATCH",
      cookies: authCookies(accessToken),
      ...options,
    }),
    { params: Promise.resolve({ tagId }) },
  );
}

function deleteTagRequest(accessToken: string | undefined, tagId: string) {
  return callRoute(
    routes.item.DELETE,
    jsonRequest(`/api/tags/${tagId}`, {
      method: "DELETE",
      cookies: authCookies(accessToken),
    }),
    { params: Promise.resolve({ tagId }) },
  );
}

beforeAll(async () => {
  process.env.DATABASE_URL = inject("databaseUrl");
  process.env.JWT_SECRET = JWT_SECRET;

  ({ prisma } = await import("@/lib/prisma"));

  routes = {
    collection: await import("@/app/api/tags/route"),
    item: await import("@/app/api/tags/[tagId]/route"),
  };
});

afterEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "users" CASCADE');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/tags", () => {
  it("rejects a request without authentication", async () => {
    const response = await listTagsRequest(undefined);

    expect(response.status).toBe(401);
    expect(await readError(response)).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("returns an empty first page for a user without tags", async () => {
    const { accessToken } = await createUser("alice");

    const response = await listTagsRequest(accessToken);

    expect(response.status).toBe(200);
    expect(await readJson<TagListBody>(response)).toEqual({
      items: [],
      meta: { page: 1, perPage: 20, total: 0, totalPage: 0 },
    });
  });

  it("lists only the authenticated user's tags sorted by name", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");

    await seedTags(alice.user.id, ["zeta", "alpha", "beta"]);
    await seedTags(bob.user.id, ["omega"]);

    const response = await listTagsRequest(alice.accessToken);

    const body = await readJson<TagListBody>(response);
    expect(body.items.map((item) => item.name)).toEqual([
      "alpha",
      "beta",
      "zeta",
    ]);
    expect(body.meta).toEqual({
      page: 1,
      perPage: 20,
      total: 3,
      totalPage: 1,
    });
  });

  it("supports descending order", async () => {
    const { user, accessToken } = await createUser("alice");
    await seedTags(user.id, ["alpha", "beta", "zeta"]);

    const response = await listTagsRequest(accessToken, "?order=desc");

    const body = await readJson<TagListBody>(response);
    expect(body.items.map((item) => item.name)).toEqual([
      "zeta",
      "beta",
      "alpha",
    ]);
  });

  it("searches names case-insensitively as a substring", async () => {
    const { user, accessToken } = await createUser("alice");
    await seedTags(user.id, ["Work", "WORKOUT", "personal", "archive"]);

    const query = `?${new URLSearchParams({ search: "  work  " })}`;
    const response = await listTagsRequest(accessToken, query);

    const body = await readJson<TagListBody>(response);
    expect(body.items.map((item) => item.name).sort()).toEqual(
      ["WORKOUT", "Work"].sort(),
    );
    expect(body.meta.total).toBe(2);
  });

  it("paginates the result set", async () => {
    const { user, accessToken } = await createUser("alice");
    await seedTags(user.id, [
      "tag-1",
      "tag-2",
      "tag-3",
      "tag-4",
      "tag-5",
    ]);

    const response = await listTagsRequest(accessToken, "?page=2&perPage=2");

    const body = await readJson<TagListBody>(response);
    expect(body.items.map((item) => item.name)).toEqual(["tag-3", "tag-4"]);
    expect(body.meta).toEqual({
      page: 2,
      perPage: 2,
      total: 5,
      totalPage: 3,
    });
  });

  it("caps perPage at 100", async () => {
    const { user, accessToken } = await createUser("alice");
    await seedTags(user.id, ["alpha"]);

    const response = await listTagsRequest(accessToken, "?perPage=1000");

    const body = await readJson<TagListBody>(response);
    expect(body.meta.perPage).toBe(100);
  });

  it("rejects invalid query parameters", async () => {
    const { accessToken } = await createUser("alice");

    const response = await listTagsRequest(
      accessToken,
      "?page=0&perPage=abc&sort=created_at&order=sideways",
    );

    expect(response.status).toBe(422);
    const error = await readError(response);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual(
      expect.arrayContaining([
        { field: "page", message: "Must be a positive integer" },
        { field: "perPage", message: "Must be a positive integer" },
        { field: "sort", message: "Must be one of: name" },
        { field: "order", message: "Must be one of: asc, desc" },
      ]),
    );
  });
});

describe("POST /api/tags", () => {
  it("rejects a request without authentication", async () => {
    const response = await createTagRequest(undefined, {
      body: { name: "Work" },
    });

    expect(response.status).toBe(401);
    expect(await readError(response)).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("creates a tag for the authenticated user", async () => {
    const { user, accessToken } = await createUser("alice");

    const response = await createTagRequest(accessToken, {
      body: { name: "Work" },
    });

    expect(response.status).toBe(201);

    const body = await readJson<TagBody>(response);
    expect(body).toEqual({ id: expect.any(String), name: "Work" });

    const stored = await prisma.tags.findUnique({ where: { id: body.id } });
    expect(stored).toMatchObject({ user_id: user.id, name: "Work" });
  });

  it("trims surrounding whitespace", async () => {
    const { accessToken } = await createUser("alice");

    const response = await createTagRequest(accessToken, {
      body: { name: "  Personal  " },
    });

    expect(response.status).toBe(201);
    expect(await readJson<TagBody>(response)).toMatchObject({
      name: "Personal",
    });
  });

  it("allows duplicate tag names per user", async () => {
    const { user, accessToken } = await createUser("alice");

    const first = await createTagRequest(accessToken, {
      body: { name: "Work" },
    });
    const second = await createTagRequest(accessToken, {
      body: { name: "Work" },
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(await prisma.tags.count({ where: { user_id: user.id } })).toBe(2);
  });

  it.each([
    [{}, "name", "Is required"],
    [{ name: "" }, "name", "Must not be empty"],
    [{ name: "   " }, "name", "Must not be empty"],
    [
      { name: "a".repeat(256) },
      "name",
      "Must be at most 255 characters",
    ],
    [{ name: "Work", user_id: MISSING_TAG_ID }, "user_id", "Unknown field"],
  ])("rejects the invalid body %j", async (body, field, message) => {
    const { accessToken } = await createUser("alice");

    const response = await createTagRequest(accessToken, { body });

    expect(response.status).toBe(422);
    const error = await readError(response);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual(
      expect.arrayContaining([{ field, message }]),
    );
  });

  it("rejects malformed JSON", async () => {
    const { accessToken } = await createUser("alice");

    const response = await createTagRequest(accessToken, { rawBody: "{" });

    expect(response.status).toBe(422);
    expect(await readError(response)).toMatchObject({
      code: "VALIDATION_ERROR",
      details: [{ message: "Request body must be valid JSON" }],
    });
  });
});

describe("GET /api/tags/{tagId}", () => {
  it("rejects a request without authentication", async () => {
    const { user } = await createUser("alice");
    const [tag] = await seedTags(user.id, ["Work"]);

    const response = await getTagRequest(undefined, tag.id);

    expect(response.status).toBe(401);
    expect(await readError(response)).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("returns a tag owned by the authenticated user", async () => {
    const { user, accessToken } = await createUser("alice");
    const [tag] = await seedTags(user.id, ["Work"]);

    const response = await getTagRequest(accessToken, tag.id);

    expect(response.status).toBe(200);
    expect(await readJson<TagBody>(response)).toEqual({
      id: tag.id,
      name: "Work",
    });
  });

  it("hides another user's tag", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const [tag] = await seedTags(bob.user.id, ["Work"]);

    const response = await getTagRequest(alice.accessToken, tag.id);

    expect(response.status).toBe(404);
    expect(await readError(response)).toMatchObject({
      code: "NOT_FOUND",
      message: "Tag not found",
    });
  });

  it("returns 404 for an unknown tag id", async () => {
    const { accessToken } = await createUser("alice");

    const response = await getTagRequest(accessToken, MISSING_TAG_ID);

    expect(response.status).toBe(404);
  });

  it("returns 404 for a malformed tag id", async () => {
    const { accessToken } = await createUser("alice");

    const response = await getTagRequest(accessToken, "not-a-uuid");

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/tags/{tagId}", () => {
  it("rejects a request without authentication", async () => {
    const { user } = await createUser("alice");
    const [tag] = await seedTags(user.id, ["Work"]);

    const response = await updateTagRequest(undefined, tag.id, {
      body: { name: "Personal" },
    });

    expect(response.status).toBe(401);
    expect(await readError(response)).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("updates a tag owned by the authenticated user", async () => {
    const { user, accessToken } = await createUser("alice");
    const [tag] = await seedTags(user.id, ["Work"]);

    const response = await updateTagRequest(accessToken, tag.id, {
      body: { name: "Personal" },
    });

    expect(response.status).toBe(200);
    expect(await readJson<TagBody>(response)).toEqual({
      id: tag.id,
      name: "Personal",
    });

    const stored = await prisma.tags.findUnique({ where: { id: tag.id } });
    expect(stored?.name).toBe("Personal");
  });

  it("trims surrounding whitespace", async () => {
    const { user, accessToken } = await createUser("alice");
    const [tag] = await seedTags(user.id, ["Work"]);

    const response = await updateTagRequest(accessToken, tag.id, {
      body: { name: "  Personal  " },
    });

    expect(response.status).toBe(200);
    const stored = await prisma.tags.findUnique({ where: { id: tag.id } });
    expect(stored?.name).toBe("Personal");
  });

  it("does not update another user's tag", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const [tag] = await seedTags(bob.user.id, ["Work"]);

    const response = await updateTagRequest(alice.accessToken, tag.id, {
      body: { name: "Hijacked" },
    });

    expect(response.status).toBe(404);
    const stored = await prisma.tags.findUnique({ where: { id: tag.id } });
    expect(stored?.name).toBe("Work");
  });

  it("returns 404 for an unknown tag id", async () => {
    const { accessToken } = await createUser("alice");

    const response = await updateTagRequest(accessToken, MISSING_TAG_ID, {
      body: { name: "Personal" },
    });

    expect(response.status).toBe(404);
  });

  it("returns 404 for a malformed tag id", async () => {
    const { accessToken } = await createUser("alice");

    const response = await updateTagRequest(accessToken, "not-a-uuid", {
      body: { name: "Personal" },
    });

    expect(response.status).toBe(404);
  });

  it.each([
    [{}, "name", "Is required"],
    [{ name: "" }, "name", "Must not be empty"],
    [{ name: "   " }, "name", "Must not be empty"],
    [
      { name: "a".repeat(256) },
      "name",
      "Must be at most 255 characters",
    ],
    [{ name: "Work", user_id: MISSING_TAG_ID }, "user_id", "Unknown field"],
  ])("rejects the invalid body %j", async (body, field, message) => {
    const { user, accessToken } = await createUser("alice");
    const [tag] = await seedTags(user.id, ["Work"]);

    const response = await updateTagRequest(accessToken, tag.id, { body });

    expect(response.status).toBe(422);
    const error = await readError(response);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual(
      expect.arrayContaining([{ field, message }]),
    );

    const stored = await prisma.tags.findUnique({ where: { id: tag.id } });
    expect(stored?.name).toBe("Work");
  });

  it("rejects malformed JSON", async () => {
    const { user, accessToken } = await createUser("alice");
    const [tag] = await seedTags(user.id, ["Work"]);

    const response = await updateTagRequest(accessToken, tag.id, {
      rawBody: "{",
    });

    expect(response.status).toBe(422);
    expect(await readError(response)).toMatchObject({
      code: "VALIDATION_ERROR",
      details: [{ message: "Request body must be valid JSON" }],
    });
  });
});

describe("DELETE /api/tags/{tagId}", () => {
  it("rejects a request without authentication", async () => {
    const { user } = await createUser("alice");
    const [tag] = await seedTags(user.id, ["Work"]);

    const response = await deleteTagRequest(undefined, tag.id);

    expect(response.status).toBe(401);
    expect(await readError(response)).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("deletes a tag owned by the authenticated user", async () => {
    const { user, accessToken } = await createUser("alice");
    const [tag] = await seedTags(user.id, ["Work"]);

    const response = await deleteTagRequest(accessToken, tag.id);

    expect(response.status).toBe(204);
    expect(await prisma.tags.findUnique({ where: { id: tag.id } })).toBeNull();
  });

  it("does not delete another user's tag", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const [tag] = await seedTags(bob.user.id, ["Work"]);

    const response = await deleteTagRequest(alice.accessToken, tag.id);

    expect(response.status).toBe(404);
    expect(
      await prisma.tags.findUnique({ where: { id: tag.id } }),
    ).not.toBeNull();
  });

  it("returns 404 for an unknown tag id", async () => {
    const { accessToken } = await createUser("alice");

    const response = await deleteTagRequest(accessToken, MISSING_TAG_ID);

    expect(response.status).toBe(404);
  });

  it("returns 404 for a malformed tag id", async () => {
    const { accessToken } = await createUser("alice");

    const response = await deleteTagRequest(accessToken, "not-a-uuid");

    expect(response.status).toBe(404);
  });

  it("detaches projects that referenced the tag", async () => {
    const { user, accessToken } = await createUser("alice");
    const [tag] = await seedTags(user.id, ["Work"]);
    const project = await prisma.projects.create({
      data: {
        user_id: user.id,
        tag_id: tag.id,
        title: "Project",
      },
    });

    const response = await deleteTagRequest(accessToken, tag.id);

    expect(response.status).toBe(204);

    const stored = await prisma.projects.findUnique({
      where: { id: project.id },
    });
    expect(stored).not.toBeNull();
    expect(stored?.tag_id).toBeNull();
  });
});

describe("tags CRUD flow", () => {
  it("supports create, list, get, update and delete", async () => {
    const { accessToken } = await createUser("alice");

    const createResponse = await createTagRequest(accessToken, {
      body: { name: "Roadmap" },
    });
    expect(createResponse.status).toBe(201);
    const created = await readJson<TagBody>(createResponse);

    const listResponse = await listTagsRequest(accessToken);
    const list = await readJson<TagListBody>(listResponse);
    expect(list.items).toEqual([created]);

    const getResponse = await getTagRequest(accessToken, created.id);
    expect(getResponse.status).toBe(200);
    expect(await readJson<TagBody>(getResponse)).toEqual(created);

    const updateResponse = await updateTagRequest(accessToken, created.id, {
      body: { name: "Product roadmap" },
    });
    expect(updateResponse.status).toBe(200);
    expect(await readJson<TagBody>(updateResponse)).toEqual({
      id: created.id,
      name: "Product roadmap",
    });

    const deleteResponse = await deleteTagRequest(accessToken, created.id);
    expect(deleteResponse.status).toBe(204);

    const missingResponse = await getTagRequest(accessToken, created.id);
    expect(missingResponse.status).toBe(404);
  });
});
