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
import { callRoute, jsonRequest } from "./helpers/auth";

interface ProjectBody {
  id: string;
  title: string;
  description: string | null;
  tag_id: string | null;
}

interface ProjectListBody {
  items: ProjectBody[];
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

interface SeedProject {
  title: string;
  description?: string | null;
  tag_id?: string | null;
}

const JWT_SECRET = "integration-test-jwt-secret-0123456789abcdef";
const MISSING_PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const MISSING_TAG_ID = "22222222-2222-2222-2222-222222222222";

let prisma: PrismaClient;
let routes: {
  collection: typeof import("@/app/api/projects/route");
  item: typeof import("@/app/api/projects/[projectId]/route");
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

async function seedProjects(userId: string, projects: SeedProject[]) {
  return Promise.all(
    projects.map((project) =>
      prisma.projects.create({
        data: {
          user_id: userId,
          title: project.title,
          description: project.description ?? null,
          tag_id: project.tag_id ?? null,
        },
      }),
    ),
  );
}

function authCookies(accessToken: string | undefined) {
  return { [ACCESS_TOKEN_COOKIE]: accessToken };
}

function listProjectsRequest(accessToken: string | undefined, query = "") {
  return callRoute(
    routes.collection.GET,
    jsonRequest(`/api/projects${query}`, {
      method: "GET",
      cookies: authCookies(accessToken),
    }),
  );
}

function createProjectRequest(
  accessToken: string | undefined,
  options: { body?: unknown; rawBody?: string },
) {
  return callRoute(
    routes.collection.POST,
    jsonRequest("/api/projects", {
      method: "POST",
      cookies: authCookies(accessToken),
      ...options,
    }),
  );
}

function getProjectRequest(accessToken: string | undefined, projectId: string) {
  return callRoute(
    routes.item.GET,
    jsonRequest(`/api/projects/${projectId}`, {
      method: "GET",
      cookies: authCookies(accessToken),
    }),
    { params: Promise.resolve({ projectId }) },
  );
}

function updateProjectRequest(
  accessToken: string | undefined,
  projectId: string,
  options: { body?: unknown; rawBody?: string },
) {
  return callRoute(
    routes.item.PATCH,
    jsonRequest(`/api/projects/${projectId}`, {
      method: "PATCH",
      cookies: authCookies(accessToken),
      ...options,
    }),
    { params: Promise.resolve({ projectId }) },
  );
}

function deleteProjectRequest(accessToken: string | undefined, projectId: string) {
  return callRoute(
    routes.item.DELETE,
    jsonRequest(`/api/projects/${projectId}`, {
      method: "DELETE",
      cookies: authCookies(accessToken),
    }),
    { params: Promise.resolve({ projectId }) },
  );
}

beforeAll(async () => {
  process.env.DATABASE_URL = inject("databaseUrl");
  process.env.JWT_SECRET = JWT_SECRET;

  ({ prisma } = await import("@/lib/prisma"));

  routes = {
    collection: await import("@/app/api/projects/route"),
    item: await import("@/app/api/projects/[projectId]/route"),
  };
});

afterEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "users" CASCADE');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/projects", () => {
  it("rejects a request without authentication", async () => {
    const response = await listProjectsRequest(undefined);

    expect(response.status).toBe(401);
    expect(await readError(response)).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("returns an empty first page for a user without projects", async () => {
    const { accessToken } = await createUser("alice");

    const response = await listProjectsRequest(accessToken);

    expect(response.status).toBe(200);
    expect(await readJson<ProjectListBody>(response)).toEqual({
      items: [],
      meta: { page: 1, perPage: 20, total: 0, totalPage: 0 },
    });
  });

  it("lists only the authenticated user's projects sorted by title", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");

    await seedProjects(alice.user.id, [
      { title: "zeta" },
      { title: "alpha" },
      { title: "beta" },
    ]);
    await seedProjects(bob.user.id, [{ title: "omega" }]);

    const response = await listProjectsRequest(alice.accessToken);

    const body = await readJson<ProjectListBody>(response);
    expect(body.items.map((item) => item.title)).toEqual([
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
    await seedProjects(user.id, [
      { title: "alpha" },
      { title: "beta" },
      { title: "zeta" },
    ]);

    const response = await listProjectsRequest(accessToken, "?order=desc");

    const body = await readJson<ProjectListBody>(response);
    expect(body.items.map((item) => item.title)).toEqual([
      "zeta",
      "beta",
      "alpha",
    ]);
  });

  it("searches titles and descriptions case-insensitively as a substring", async () => {
    const { user, accessToken } = await createUser("alice");
    await seedProjects(user.id, [
      { title: "Roadmap", description: "Quarterly plan" },
      { title: "Meeting notes", description: "Discuss ROADMAP" },
      { title: "Personal", description: "Ideas" },
    ]);

    const query = `?${new URLSearchParams({ search: "  road  " })}`;
    const response = await listProjectsRequest(accessToken, query);

    const body = await readJson<ProjectListBody>(response);
    expect(body.items.map((item) => item.title)).toEqual([
      "Meeting notes",
      "Roadmap",
    ]);
    expect(body.meta.total).toBe(2);
  });

  it("filters projects by tag id", async () => {
    const { user, accessToken } = await createUser("alice");
    const [tag] = await seedTags(user.id, ["Work"]);

    await seedProjects(user.id, [
      { title: "Tagged", tag_id: tag.id },
      { title: "Untagged" },
      { title: "Other tag" },
    ]);

    const response = await listProjectsRequest(
      accessToken,
      `?tag_id=${tag.id}`,
    );

    const body = await readJson<ProjectListBody>(response);
    expect(body.items.map((item) => item.title)).toEqual(["Tagged"]);
    expect(body.meta.total).toBe(1);
  });

  it("paginates the result set", async () => {
    const { user, accessToken } = await createUser("alice");
    await seedProjects(user.id, [
      { title: "project-1" },
      { title: "project-2" },
      { title: "project-3" },
      { title: "project-4" },
      { title: "project-5" },
    ]);

    const response = await listProjectsRequest(
      accessToken,
      "?page=2&perPage=2",
    );

    const body = await readJson<ProjectListBody>(response);
    expect(body.items.map((item) => item.title)).toEqual([
      "project-3",
      "project-4",
    ]);
    expect(body.meta).toEqual({
      page: 2,
      perPage: 2,
      total: 5,
      totalPage: 3,
    });
  });

  it("caps perPage at 100", async () => {
    const { user, accessToken } = await createUser("alice");
    await seedProjects(user.id, [{ title: "alpha" }]);

    const response = await listProjectsRequest(accessToken, "?perPage=1000");

    const body = await readJson<ProjectListBody>(response);
    expect(body.meta.perPage).toBe(100);
  });

  it("rejects invalid query parameters", async () => {
    const { accessToken } = await createUser("alice");

    const response = await listProjectsRequest(
      accessToken,
      "?page=0&perPage=abc&tag_id=not-a-uuid&sort=created_at&order=sideways",
    );

    expect(response.status).toBe(422);
    const error = await readError(response);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual(
      expect.arrayContaining([
        { field: "page", message: "Must be a positive integer" },
        { field: "perPage", message: "Must be a positive integer" },
        { field: "tag_id", message: "Must be a valid UUID" },
        { field: "sort", message: "Must be one of: title" },
        { field: "order", message: "Must be one of: asc, desc" },
      ]),
    );
  });
});

describe("POST /api/projects", () => {
  it("rejects a request without authentication", async () => {
    const response = await createProjectRequest(undefined, {
      body: { title: "Roadmap" },
    });

    expect(response.status).toBe(401);
    expect(await readError(response)).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("creates a project with null optional fields", async () => {
    const { user, accessToken } = await createUser("alice");

    const response = await createProjectRequest(accessToken, {
      body: { title: "Roadmap" },
    });

    expect(response.status).toBe(201);

    const body = await readJson<ProjectBody>(response);
    expect(body).toEqual({
      id: expect.any(String),
      title: "Roadmap",
      description: null,
      tag_id: null,
    });

    const stored = await prisma.projects.findUnique({ where: { id: body.id } });
    expect(stored).toMatchObject({
      user_id: user.id,
      title: "Roadmap",
      description: null,
      tag_id: null,
    });
  });

  it("creates a project linked to a tag owned by the user", async () => {
    const { user, accessToken } = await createUser("alice");
    const [tag] = await seedTags(user.id, ["Work"]);

    const response = await createProjectRequest(accessToken, {
      body: {
        title: "Roadmap",
        description: "Quarterly plan",
        tag_id: tag.id,
      },
    });

    expect(response.status).toBe(201);

    const body = await readJson<ProjectBody>(response);
    expect(body).toMatchObject({
      title: "Roadmap",
      description: "Quarterly plan",
      tag_id: tag.id,
    });
  });

  it("trims surrounding whitespace in the title", async () => {
    const { accessToken } = await createUser("alice");

    const response = await createProjectRequest(accessToken, {
      body: { title: "  Personal  " },
    });

    expect(response.status).toBe(201);
    expect(await readJson<ProjectBody>(response)).toMatchObject({
      title: "Personal",
    });
  });

  it("rejects a tag owned by another user", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const [tag] = await seedTags(bob.user.id, ["Work"]);

    const response = await createProjectRequest(alice.accessToken, {
      body: { title: "Roadmap", tag_id: tag.id },
    });

    expect(response.status).toBe(404);
    expect(await readError(response)).toMatchObject({
      code: "NOT_FOUND",
      message: "Tag not found",
    });
    expect(
      await prisma.projects.count({ where: { user_id: alice.user.id } }),
    ).toBe(0);
  });

  it("rejects an unknown tag id", async () => {
    const { accessToken } = await createUser("alice");

    const response = await createProjectRequest(accessToken, {
      body: { title: "Roadmap", tag_id: MISSING_TAG_ID },
    });

    expect(response.status).toBe(404);
    expect(await readError(response)).toMatchObject({
      code: "NOT_FOUND",
      message: "Tag not found",
    });
  });

  it.each([
    [{}, "title", "Is required"],
    [{ title: "" }, "title", "Must not be empty"],
    [{ title: "   " }, "title", "Must not be empty"],
    [
      { title: "a".repeat(256) },
      "title",
      "Must be at most 255 characters",
    ],
    [
      { title: "Roadmap", description: 42 },
      "description",
      "Must be a string or null",
    ],
    [
      { title: "Roadmap", tag_id: "not-a-uuid" },
      "tag_id",
      "Must be a valid UUID",
    ],
    [
      { title: "Roadmap", user_id: MISSING_PROJECT_ID },
      "user_id",
      "Unknown field",
    ],
  ])("rejects the invalid body %j", async (body, field, message) => {
    const { accessToken } = await createUser("alice");

    const response = await createProjectRequest(accessToken, { body });

    expect(response.status).toBe(422);
    const error = await readError(response);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual(
      expect.arrayContaining([{ field, message }]),
    );
  });

  it("rejects malformed JSON", async () => {
    const { accessToken } = await createUser("alice");

    const response = await createProjectRequest(accessToken, { rawBody: "{" });

    expect(response.status).toBe(422);
    expect(await readError(response)).toMatchObject({
      code: "VALIDATION_ERROR",
      details: [{ message: "Request body must be valid JSON" }],
    });
  });
});

describe("GET /api/projects/{projectId}", () => {
  it("rejects a request without authentication", async () => {
    const { user } = await createUser("alice");
    const [project] = await seedProjects(user.id, [{ title: "Roadmap" }]);

    const response = await getProjectRequest(undefined, project.id);

    expect(response.status).toBe(401);
    expect(await readError(response)).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("returns a project owned by the authenticated user", async () => {
    const { user, accessToken } = await createUser("alice");
    const [tag] = await seedTags(user.id, ["Work"]);
    const [project] = await seedProjects(user.id, [
      { title: "Roadmap", description: "Plan", tag_id: tag.id },
    ]);

    const response = await getProjectRequest(accessToken, project.id);

    expect(response.status).toBe(200);
    expect(await readJson<ProjectBody>(response)).toEqual({
      id: project.id,
      title: "Roadmap",
      description: "Plan",
      tag_id: tag.id,
    });
  });

  it("hides another user's project", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const [project] = await seedProjects(bob.user.id, [{ title: "Roadmap" }]);

    const response = await getProjectRequest(alice.accessToken, project.id);

    expect(response.status).toBe(404);
    expect(await readError(response)).toMatchObject({
      code: "NOT_FOUND",
      message: "Project not found",
    });
  });

  it("returns 404 for an unknown project id", async () => {
    const { accessToken } = await createUser("alice");

    const response = await getProjectRequest(accessToken, MISSING_PROJECT_ID);

    expect(response.status).toBe(404);
  });

  it("returns 404 for a malformed project id", async () => {
    const { accessToken } = await createUser("alice");

    const response = await getProjectRequest(accessToken, "not-a-uuid");

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/projects/{projectId}", () => {
  it("rejects a request without authentication", async () => {
    const { user } = await createUser("alice");
    const [project] = await seedProjects(user.id, [{ title: "Roadmap" }]);

    const response = await updateProjectRequest(undefined, project.id, {
      body: { title: "Personal" },
    });

    expect(response.status).toBe(401);
    expect(await readError(response)).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("updates the title and leaves omitted fields unchanged", async () => {
    const { user, accessToken } = await createUser("alice");
    const [tag] = await seedTags(user.id, ["Work"]);
    const [project] = await seedProjects(user.id, [
      { title: "Roadmap", description: "Plan", tag_id: tag.id },
    ]);

    const response = await updateProjectRequest(accessToken, project.id, {
      body: { title: "  Personal  " },
    });

    expect(response.status).toBe(200);
    expect(await readJson<ProjectBody>(response)).toEqual({
      id: project.id,
      title: "Personal",
      description: "Plan",
      tag_id: tag.id,
    });
  });

  it("updates the description", async () => {
    const { user, accessToken } = await createUser("alice");
    const [project] = await seedProjects(user.id, [{ title: "Roadmap" }]);

    const response = await updateProjectRequest(accessToken, project.id, {
      body: { description: "Updated plan" },
    });

    expect(response.status).toBe(200);
    expect(await readJson<ProjectBody>(response)).toMatchObject({
      description: "Updated plan",
    });
  });

  it("clears the description with null", async () => {
    const { user, accessToken } = await createUser("alice");
    const [project] = await seedProjects(user.id, [
      { title: "Roadmap", description: "Plan" },
    ]);

    const response = await updateProjectRequest(accessToken, project.id, {
      body: { description: null },
    });

    expect(response.status).toBe(200);
    expect(await readJson<ProjectBody>(response)).toMatchObject({
      description: null,
    });

    const stored = await prisma.projects.findUnique({
      where: { id: project.id },
    });
    expect(stored?.description).toBeNull();
  });

  it("attaches a tag owned by the user", async () => {
    const { user, accessToken } = await createUser("alice");
    const [tag] = await seedTags(user.id, ["Work"]);
    const [project] = await seedProjects(user.id, [{ title: "Roadmap" }]);

    const response = await updateProjectRequest(accessToken, project.id, {
      body: { tag_id: tag.id },
    });

    expect(response.status).toBe(200);
    expect(await readJson<ProjectBody>(response)).toMatchObject({
      tag_id: tag.id,
    });
  });

  it("detaches the tag with null", async () => {
    const { user, accessToken } = await createUser("alice");
    const [tag] = await seedTags(user.id, ["Work"]);
    const [project] = await seedProjects(user.id, [
      { title: "Roadmap", tag_id: tag.id },
    ]);

    const response = await updateProjectRequest(accessToken, project.id, {
      body: { tag_id: null },
    });

    expect(response.status).toBe(200);
    expect(await readJson<ProjectBody>(response)).toMatchObject({
      tag_id: null,
    });
  });

  it("does not attach a tag owned by another user", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const [tag] = await seedTags(bob.user.id, ["Work"]);
    const [project] = await seedProjects(alice.user.id, [{ title: "Roadmap" }]);

    const response = await updateProjectRequest(alice.accessToken, project.id, {
      body: { tag_id: tag.id },
    });

    expect(response.status).toBe(404);
    expect(await readError(response)).toMatchObject({
      code: "NOT_FOUND",
      message: "Tag not found",
    });

    const stored = await prisma.projects.findUnique({
      where: { id: project.id },
    });
    expect(stored?.tag_id).toBeNull();
  });

  it("does not update another user's project", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const [project] = await seedProjects(bob.user.id, [{ title: "Roadmap" }]);

    const response = await updateProjectRequest(alice.accessToken, project.id, {
      body: { title: "Hijacked" },
    });

    expect(response.status).toBe(404);
    const stored = await prisma.projects.findUnique({
      where: { id: project.id },
    });
    expect(stored?.title).toBe("Roadmap");
  });

  it("returns 404 for an unknown project id", async () => {
    const { accessToken } = await createUser("alice");

    const response = await updateProjectRequest(
      accessToken,
      MISSING_PROJECT_ID,
      { body: { title: "Personal" } },
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 for a malformed project id", async () => {
    const { accessToken } = await createUser("alice");

    const response = await updateProjectRequest(accessToken, "not-a-uuid", {
      body: { title: "Personal" },
    });

    expect(response.status).toBe(404);
  });

  it.each([
    [{}, undefined, "At least one field is required"],
    [{ title: null }, "title", "Must be a string"],
    [{ title: "" }, "title", "Must not be empty"],
    [{ title: "   " }, "title", "Must not be empty"],
    [
      { title: "a".repeat(256) },
      "title",
      "Must be at most 255 characters",
    ],
    [
      { description: 42 },
      "description",
      "Must be a string or null",
    ],
    [{ tag_id: "not-a-uuid" }, "tag_id", "Must be a valid UUID"],
    [
      { title: "Personal", user_id: MISSING_PROJECT_ID },
      "user_id",
      "Unknown field",
    ],
  ])("rejects the invalid body %j", async (body, field, message) => {
    const { user, accessToken } = await createUser("alice");
    const [project] = await seedProjects(user.id, [{ title: "Roadmap" }]);

    const response = await updateProjectRequest(accessToken, project.id, {
      body,
    });

    expect(response.status).toBe(422);
    const error = await readError(response);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual(
      expect.arrayContaining([
        field === undefined ? { message } : { field, message },
      ]),
    );

    const stored = await prisma.projects.findUnique({
      where: { id: project.id },
    });
    expect(stored?.title).toBe("Roadmap");
  });

  it("rejects malformed JSON", async () => {
    const { user, accessToken } = await createUser("alice");
    const [project] = await seedProjects(user.id, [{ title: "Roadmap" }]);

    const response = await updateProjectRequest(accessToken, project.id, {
      rawBody: "{",
    });

    expect(response.status).toBe(422);
    expect(await readError(response)).toMatchObject({
      code: "VALIDATION_ERROR",
      details: [{ message: "Request body must be valid JSON" }],
    });
  });
});

describe("DELETE /api/projects/{projectId}", () => {
  it("rejects a request without authentication", async () => {
    const { user } = await createUser("alice");
    const [project] = await seedProjects(user.id, [{ title: "Roadmap" }]);

    const response = await deleteProjectRequest(undefined, project.id);

    expect(response.status).toBe(401);
    expect(await readError(response)).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("deletes a project owned by the authenticated user", async () => {
    const { user, accessToken } = await createUser("alice");
    const [project] = await seedProjects(user.id, [{ title: "Roadmap" }]);

    const response = await deleteProjectRequest(accessToken, project.id);

    expect(response.status).toBe(204);
    expect(
      await prisma.projects.findUnique({ where: { id: project.id } }),
    ).toBeNull();
  });

  it("does not delete another user's project", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const [project] = await seedProjects(bob.user.id, [{ title: "Roadmap" }]);

    const response = await deleteProjectRequest(alice.accessToken, project.id);

    expect(response.status).toBe(404);
    expect(
      await prisma.projects.findUnique({ where: { id: project.id } }),
    ).not.toBeNull();
  });

  it("returns 404 for an unknown project id", async () => {
    const { accessToken } = await createUser("alice");

    const response = await deleteProjectRequest(accessToken, MISSING_PROJECT_ID);

    expect(response.status).toBe(404);
  });

  it("returns 404 for a malformed project id", async () => {
    const { accessToken } = await createUser("alice");

    const response = await deleteProjectRequest(accessToken, "not-a-uuid");

    expect(response.status).toBe(404);
  });

  it("detaches notes that referenced the project", async () => {
    const { user, accessToken } = await createUser("alice");
    const [project] = await seedProjects(user.id, [{ title: "Roadmap" }]);
    const note = await prisma.notes.create({
      data: {
        user_id: user.id,
        project_id: project.id,
        title: "Note",
        content_json: { type: "doc", content: [{ type: "paragraph" }] },
      },
    });

    const response = await deleteProjectRequest(accessToken, project.id);

    expect(response.status).toBe(204);

    const stored = await prisma.notes.findUnique({ where: { id: note.id } });
    expect(stored).not.toBeNull();
    expect(stored?.project_id).toBeNull();
  });
});

describe("projects CRUD flow", () => {
  it("supports create, list, get, update and delete", async () => {
    const { user, accessToken } = await createUser("alice");
    const [tag] = await seedTags(user.id, ["Work"]);

    const createResponse = await createProjectRequest(accessToken, {
      body: {
        title: "Roadmap",
        description: "Quarterly plan",
        tag_id: tag.id,
      },
    });
    expect(createResponse.status).toBe(201);
    const created = await readJson<ProjectBody>(createResponse);

    const listResponse = await listProjectsRequest(accessToken);
    const list = await readJson<ProjectListBody>(listResponse);
    expect(list.items).toEqual([created]);

    const getResponse = await getProjectRequest(accessToken, created.id);
    expect(getResponse.status).toBe(200);
    expect(await readJson<ProjectBody>(getResponse)).toEqual(created);

    const updateResponse = await updateProjectRequest(accessToken, created.id, {
      body: { title: "Product roadmap", tag_id: null },
    });
    expect(updateResponse.status).toBe(200);
    expect(await readJson<ProjectBody>(updateResponse)).toEqual({
      id: created.id,
      title: "Product roadmap",
      description: "Quarterly plan",
      tag_id: null,
    });

    const deleteResponse = await deleteProjectRequest(accessToken, created.id);
    expect(deleteResponse.status).toBe(204);

    const missingResponse = await getProjectRequest(accessToken, created.id);
    expect(missingResponse.status).toBe(404);
  });
});
