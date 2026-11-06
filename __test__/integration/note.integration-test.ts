import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  inject,
  it,
} from "vitest";
import type { Prisma, PrismaClient } from "@/prisma/generated/client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth-cookies";
import { signAccessToken } from "@/lib/jwt";
import { EMPTY_NOTE_DOCUMENT, noteDocumentToText } from "@/lib/note-content";
import type { NoteDocument } from "@/types/note.types";
import { callRoute, jsonRequest } from "./helpers/auth";

interface NoteBody {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface NoteDetailBody extends NoteBody {
  content: NoteDocument;
}

interface NoteListBody {
  items: NoteBody[];
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

interface SeedNote {
  title: string;
  description?: string | null;
  project_id?: string | null;
  content?: NoteDocument;
  created_at?: Date;
  updated_at?: Date | null;
}

const JWT_SECRET = "integration-test-jwt-secret-0123456789abcdef";
const MISSING_NOTE_ID = "11111111-1111-1111-1111-111111111111";
const MISSING_PROJECT_ID = "22222222-2222-2222-2222-222222222222";

const content: NoteDocument = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Hello " },
        {
          type: "text",
          text: "world",
          marks: [
            { type: "bold" },
            { type: "textStyle", attrs: { fontSize: "18px" } },
          ],
        },
      ],
    },
  ],
};

let prisma: PrismaClient;
let routes: {
  collection: typeof import("@/app/api/notes/route");
  item: typeof import("@/app/api/notes/[noteId]/route");
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

async function seedTag(userId: string, name: string) {
  return prisma.tags.create({ data: { user_id: userId, name } });
}

async function seedProject(
  userId: string,
  project: { title: string; tag_id?: string | null },
) {
  return prisma.projects.create({
    data: {
      user_id: userId,
      title: project.title,
      tag_id: project.tag_id ?? null,
    },
  });
}

async function seedNotes(userId: string, notes: SeedNote[]) {
  return Promise.all(
    notes.map((note) => {
      const noteContent = note.content ?? EMPTY_NOTE_DOCUMENT;

      return prisma.notes.create({
        data: {
          user_id: userId,
          title: note.title,
          description: note.description ?? null,
          project_id: note.project_id ?? null,
          content_json: noteContent as unknown as Prisma.InputJsonValue,
          content_text: noteDocumentToText(noteContent),
          ...(note.created_at !== undefined
            ? { created_at: note.created_at }
            : {}),
          ...(note.updated_at !== undefined
            ? { updated_at: note.updated_at }
            : {}),
        },
      });
    }),
  );
}

function authCookies(accessToken: string | undefined) {
  return { [ACCESS_TOKEN_COOKIE]: accessToken };
}

function listNotesRequest(accessToken: string | undefined, query = "") {
  return callRoute(
    routes.collection.GET,
    jsonRequest(`/api/notes${query}`, {
      method: "GET",
      cookies: authCookies(accessToken),
    }),
  );
}

function createNoteRequest(
  accessToken: string | undefined,
  options: { body?: unknown; rawBody?: string },
) {
  return callRoute(
    routes.collection.POST,
    jsonRequest("/api/notes", {
      method: "POST",
      cookies: authCookies(accessToken),
      ...options,
    }),
  );
}

function getNoteRequest(accessToken: string | undefined, noteId: string) {
  return callRoute(
    routes.item.GET,
    jsonRequest(`/api/notes/${noteId}`, {
      method: "GET",
      cookies: authCookies(accessToken),
    }),
    { params: Promise.resolve({ noteId }) },
  );
}

function updateNoteRequest(
  accessToken: string | undefined,
  noteId: string,
  options: { body?: unknown; rawBody?: string },
) {
  return callRoute(
    routes.item.PATCH,
    jsonRequest(`/api/notes/${noteId}`, {
      method: "PATCH",
      cookies: authCookies(accessToken),
      ...options,
    }),
    { params: Promise.resolve({ noteId }) },
  );
}

function deleteNoteRequest(accessToken: string | undefined, noteId: string) {
  return callRoute(
    routes.item.DELETE,
    jsonRequest(`/api/notes/${noteId}`, {
      method: "DELETE",
      cookies: authCookies(accessToken),
    }),
    { params: Promise.resolve({ noteId }) },
  );
}

beforeAll(async () => {
  process.env.DATABASE_URL = inject("databaseUrl");
  process.env.JWT_SECRET = JWT_SECRET;

  ({ prisma } = await import("@/lib/prisma"));

  routes = {
    collection: await import("@/app/api/notes/route"),
    item: await import("@/app/api/notes/[noteId]/route"),
  };
});

afterEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "users" CASCADE');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/notes", () => {
  it("rejects a request without authentication", async () => {
    const response = await listNotesRequest(undefined);

    expect(response.status).toBe(401);
    expect(await readError(response)).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("returns an empty first page for a user without notes", async () => {
    const { accessToken } = await createUser("alice");

    const response = await listNotesRequest(accessToken);

    expect(response.status).toBe(200);
    expect(await readJson<NoteListBody>(response)).toEqual({
      items: [],
      meta: { page: 1, perPage: 20, total: 0, totalPage: 0 },
    });
  });

  it("lists only the authenticated user's notes sorted by created_at descending", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");

    await seedNotes(alice.user.id, [
      {
        title: "oldest",
        created_at: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        title: "newest",
        created_at: new Date("2026-01-03T00:00:00.000Z"),
      },
      {
        title: "middle",
        created_at: new Date("2026-01-02T00:00:00.000Z"),
      },
    ]);
    await seedNotes(bob.user.id, [{ title: "bob-note" }]);

    const response = await listNotesRequest(alice.accessToken);

    const body = await readJson<NoteListBody>(response);
    expect(body.items.map((item) => item.title)).toEqual([
      "newest",
      "middle",
      "oldest",
    ]);
    expect(body.meta).toEqual({
      page: 1,
      perPage: 20,
      total: 3,
      totalPage: 1,
    });
  });

  it("supports ascending order", async () => {
    const { user, accessToken } = await createUser("alice");
    await seedNotes(user.id, [
      {
        title: "oldest",
        created_at: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        title: "newest",
        created_at: new Date("2026-01-03T00:00:00.000Z"),
      },
    ]);

    const response = await listNotesRequest(accessToken, "?order=asc");

    const body = await readJson<NoteListBody>(response);
    expect(body.items.map((item) => item.title)).toEqual([
      "oldest",
      "newest",
    ]);
  });

  it("sorts by title", async () => {
    const { user, accessToken } = await createUser("alice");
    await seedNotes(user.id, [
      { title: "zeta" },
      { title: "alpha" },
      { title: "beta" },
    ]);

    const response = await listNotesRequest(accessToken, "?sort=title&order=asc");

    const body = await readJson<NoteListBody>(response);
    expect(body.items.map((item) => item.title)).toEqual([
      "alpha",
      "beta",
      "zeta",
    ]);
  });

  it("sorts by updated_at", async () => {
    const { user, accessToken } = await createUser("alice");
    await seedNotes(user.id, [
      {
        title: "recently-updated",
        created_at: new Date("2026-01-01T00:00:00.000Z"),
        updated_at: new Date("2026-01-05T00:00:00.000Z"),
      },
      {
        title: "stale",
        created_at: new Date("2026-01-02T00:00:00.000Z"),
        updated_at: new Date("2026-01-03T00:00:00.000Z"),
      },
    ]);

    const response = await listNotesRequest(
      accessToken,
      "?sort=updated_at&order=desc",
    );

    const body = await readJson<NoteListBody>(response);
    expect(body.items.map((item) => item.title)).toEqual([
      "recently-updated",
      "stale",
    ]);
  });

  it("searches titles, descriptions and body text case-insensitively as a substring", async () => {
    const { user, accessToken } = await createUser("alice");
    await seedNotes(user.id, [
      {
        title: "Shopping",
        description: "Weekly groceries",
        created_at: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        title: "Meeting",
        description: "DISCUSS shopping list",
        created_at: new Date("2026-01-02T00:00:00.000Z"),
      },
      {
        title: "Personal",
        description: "Ideas",
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "SHOPPING list" }],
            },
          ],
        },
        created_at: new Date("2026-01-03T00:00:00.000Z"),
      },
    ]);

    const query = `?${new URLSearchParams({ search: "  shop  " })}`;
    const response = await listNotesRequest(accessToken, query);

    const body = await readJson<NoteListBody>(response);
    expect(body.items.map((item) => item.title)).toEqual([
      "Personal",
      "Meeting",
      "Shopping",
    ]);
    expect(body.meta.total).toBe(3);
  });

  it("filters notes by project id", async () => {
    const { user, accessToken } = await createUser("alice");
    const project = await seedProject(user.id, { title: "Home" });

    await seedNotes(user.id, [
      { title: "Attached", project_id: project.id },
      { title: "Unattached" },
    ]);

    const response = await listNotesRequest(
      accessToken,
      `?project_id=${project.id}`,
    );

    const body = await readJson<NoteListBody>(response);
    expect(body.items.map((item) => item.title)).toEqual(["Attached"]);
    expect(body.meta.total).toBe(1);
  });

  it("filters notes by the tag of their project", async () => {
    const { user, accessToken } = await createUser("alice");
    const tag = await seedTag(user.id, "Work");
    const taggedProject = await seedProject(user.id, {
      title: "Tagged",
      tag_id: tag.id,
    });
    const untaggedProject = await seedProject(user.id, { title: "Untagged" });

    await seedNotes(user.id, [
      { title: "Tagged note", project_id: taggedProject.id },
      { title: "Untagged project note", project_id: untaggedProject.id },
      { title: "No project" },
    ]);

    const response = await listNotesRequest(accessToken, `?tag_id=${tag.id}`);

    const body = await readJson<NoteListBody>(response);
    expect(body.items.map((item) => item.title)).toEqual(["Tagged note"]);
    expect(body.meta.total).toBe(1);
  });

  it("paginates the result set", async () => {
    const { user, accessToken } = await createUser("alice");
    await seedNotes(
      user.id,
      Array.from({ length: 5 }, (_, index) => ({
        title: `note-${index + 1}`,
        created_at: new Date(`2026-01-0${index + 1}T00:00:00.000Z`),
      })),
    );

    const response = await listNotesRequest(
      accessToken,
      "?page=2&perPage=2",
    );

    const body = await readJson<NoteListBody>(response);
    expect(body.items.map((item) => item.title)).toEqual([
      "note-3",
      "note-2",
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
    await seedNotes(user.id, [{ title: "alpha" }]);

    const response = await listNotesRequest(accessToken, "?perPage=1000");

    const body = await readJson<NoteListBody>(response);
    expect(body.meta.perPage).toBe(100);
  });

  it("rejects invalid query parameters", async () => {
    const { accessToken } = await createUser("alice");

    const response = await listNotesRequest(
      accessToken,
      "?page=0&perPage=abc&project_id=nope&tag_id=nope&sort=name&order=sideways",
    );

    expect(response.status).toBe(422);
    const error = await readError(response);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual(
      expect.arrayContaining([
        { field: "page", message: "Must be a positive integer" },
        { field: "perPage", message: "Must be a positive integer" },
        { field: "project_id", message: "Must be a valid UUID" },
        { field: "tag_id", message: "Must be a valid UUID" },
        {
          field: "sort",
          message: "Must be one of: created_at, updated_at, title",
        },
        { field: "order", message: "Must be one of: asc, desc" },
      ]),
    );
  });
});

describe("POST /api/notes", () => {
  it("rejects a request without authentication", async () => {
    const response = await createNoteRequest(undefined, {
      body: { title: "Shopping" },
    });

    expect(response.status).toBe(401);
    expect(await readError(response)).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("creates a note with null optional fields and an empty document", async () => {
    const { user, accessToken } = await createUser("alice");

    const response = await createNoteRequest(accessToken, {
      body: { title: "Shopping" },
    });

    expect(response.status).toBe(201);

    const body = await readJson<NoteDetailBody>(response);
    expect(body).toEqual({
      id: expect.any(String),
      project_id: null,
      title: "Shopping",
      description: null,
      created_at: expect.any(String),
      updated_at: null,
      content: EMPTY_NOTE_DOCUMENT,
    });

    const stored = await prisma.notes.findUnique({ where: { id: body.id } });
    expect(stored).toMatchObject({
      user_id: user.id,
      title: "Shopping",
      description: null,
      project_id: null,
      content_json: EMPTY_NOTE_DOCUMENT,
      content_text: "",
    });
  });

  it("creates a note linked to a project owned by the user", async () => {
    const { user, accessToken } = await createUser("alice");
    const project = await seedProject(user.id, { title: "Home" });

    const response = await createNoteRequest(accessToken, {
      body: {
        title: "Shopping",
        description: "Weekly groceries",
        project_id: project.id,
      },
    });

    expect(response.status).toBe(201);
    expect(await readJson<NoteDetailBody>(response)).toMatchObject({
      title: "Shopping",
      description: "Weekly groceries",
      project_id: project.id,
      content: EMPTY_NOTE_DOCUMENT,
    });
  });

  it("trims surrounding whitespace in the title", async () => {
    const { accessToken } = await createUser("alice");

    const response = await createNoteRequest(accessToken, {
      body: { title: "  Personal  " },
    });

    expect(response.status).toBe(201);
    expect(await readJson<NoteDetailBody>(response)).toMatchObject({
      title: "Personal",
    });
  });

  it("creates a note with its rich-text content", async () => {
    const { accessToken } = await createUser("alice");

    const response = await createNoteRequest(accessToken, {
      body: { title: "Shopping", content },
    });

    expect(response.status).toBe(201);

    const body = await readJson<NoteDetailBody>(response);
    expect(body.content).toEqual(content);

    const stored = await prisma.notes.findUnique({ where: { id: body.id } });
    expect(stored?.content_json).toEqual(content);
    expect(stored?.content_text).toBe("Hello world");
  });

  it("rejects a project owned by another user", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const project = await seedProject(bob.user.id, { title: "Bob's project" });

    const response = await createNoteRequest(alice.accessToken, {
      body: { title: "Shopping", project_id: project.id },
    });

    expect(response.status).toBe(404);
    expect(await readError(response)).toMatchObject({
      code: "NOT_FOUND",
      message: "Project not found",
    });
    expect(
      await prisma.notes.count({ where: { user_id: alice.user.id } }),
    ).toBe(0);
  });

  it("rejects an unknown project id", async () => {
    const { accessToken } = await createUser("alice");

    const response = await createNoteRequest(accessToken, {
      body: { title: "Shopping", project_id: MISSING_PROJECT_ID },
    });

    expect(response.status).toBe(404);
    expect(await readError(response)).toMatchObject({
      code: "NOT_FOUND",
      message: "Project not found",
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
      { title: "Shopping", description: 42 },
      "description",
      "Must be a string or null",
    ],
    [
      { title: "Shopping", project_id: "not-a-uuid" },
      "project_id",
      "Must be a valid UUID",
    ],
    [
      { title: "Shopping", content: "nope" },
      "content",
      "Must be an object",
    ],
    [
      { title: "Shopping", content: { type: "paragraph", content: [] } },
      "content.type",
      'Must be "doc"',
    ],
    [
      { title: "Shopping", content: { type: "doc", content: "nope" } },
      "content.content",
      "Must be an array",
    ],
    [
      {
        title: "Shopping",
        content: { type: "doc", content: [{ type: "text" }] },
      },
      "content.content[0].text",
      "Is required for text nodes",
    ],
    [
      {
        title: "Shopping",
        content: { type: "doc", content: [{ type: "text", text: 42 }] },
      },
      "content.content[0].text",
      "Must be a string",
    ],
    [{ title: "Shopping", user_id: MISSING_NOTE_ID }, "user_id", "Unknown field"],
  ])("rejects the invalid body %j", async (body, field, message) => {
    const { accessToken } = await createUser("alice");

    const response = await createNoteRequest(accessToken, { body });

    expect(response.status).toBe(422);
    const error = await readError(response);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual(
      expect.arrayContaining([{ field, message }]),
    );
  });

  it("rejects malformed JSON", async () => {
    const { accessToken } = await createUser("alice");

    const response = await createNoteRequest(accessToken, { rawBody: "{" });

    expect(response.status).toBe(422);
    expect(await readError(response)).toMatchObject({
      code: "VALIDATION_ERROR",
      details: [{ message: "Request body must be valid JSON" }],
    });
  });
});

describe("GET /api/notes/{noteId}", () => {
  it("rejects a request without authentication", async () => {
    const { user } = await createUser("alice");
    const [note] = await seedNotes(user.id, [{ title: "Shopping" }]);

    const response = await getNoteRequest(undefined, note.id);

    expect(response.status).toBe(401);
    expect(await readError(response)).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("returns a note with its content", async () => {
    const { user, accessToken } = await createUser("alice");
    const project = await seedProject(user.id, { title: "Home" });
    const [note] = await seedNotes(user.id, [
      {
        title: "Shopping",
        description: "Weekly groceries",
        project_id: project.id,
        content,
      },
    ]);

    const response = await getNoteRequest(accessToken, note.id);

    expect(response.status).toBe(200);

    const body = await readJson<NoteDetailBody>(response);
    expect(body).toMatchObject({
      id: note.id,
      project_id: project.id,
      title: "Shopping",
      description: "Weekly groceries",
      content,
    });
  });

  it("returns an empty document", async () => {
    const { user, accessToken } = await createUser("alice");
    const [note] = await seedNotes(user.id, [{ title: "Shopping" }]);

    const response = await getNoteRequest(accessToken, note.id);

    expect(response.status).toBe(200);
    expect(await readJson<NoteDetailBody>(response)).toMatchObject({
      content: EMPTY_NOTE_DOCUMENT,
    });
  });

  it("hides another user's note", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const [note] = await seedNotes(bob.user.id, [{ title: "Shopping" }]);

    const response = await getNoteRequest(alice.accessToken, note.id);

    expect(response.status).toBe(404);
    expect(await readError(response)).toMatchObject({
      code: "NOT_FOUND",
      message: "Note not found",
    });
  });

  it("returns 404 for an unknown note id", async () => {
    const { accessToken } = await createUser("alice");

    const response = await getNoteRequest(accessToken, MISSING_NOTE_ID);

    expect(response.status).toBe(404);
  });

  it("returns 404 for a malformed note id", async () => {
    const { accessToken } = await createUser("alice");

    const response = await getNoteRequest(accessToken, "not-a-uuid");

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/notes/{noteId}", () => {
  it("rejects a request without authentication", async () => {
    const { user } = await createUser("alice");
    const [note] = await seedNotes(user.id, [{ title: "Shopping" }]);

    const response = await updateNoteRequest(undefined, note.id, {
      body: { title: "Groceries" },
    });

    expect(response.status).toBe(401);
    expect(await readError(response)).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("updates the title and leaves omitted fields unchanged", async () => {
    const { user, accessToken } = await createUser("alice");
    const project = await seedProject(user.id, { title: "Home" });
    const [note] = await seedNotes(user.id, [
      {
        title: "Shopping",
        description: "Plan",
        project_id: project.id,
        content,
      },
    ]);

    const response = await updateNoteRequest(accessToken, note.id, {
      body: { title: "  Groceries  " },
    });

    expect(response.status).toBe(200);
    const body = await readJson<NoteDetailBody>(response);
    expect(body).toMatchObject({
      id: note.id,
      title: "Groceries",
      description: "Plan",
      project_id: project.id,
      content,
    });
  });

  it("refreshes updated_at", async () => {
    const { user, accessToken } = await createUser("alice");
    const oldUpdatedAt = new Date("2020-01-01T00:00:00.000Z");
    const [note] = await seedNotes(user.id, [
      { title: "Shopping", updated_at: oldUpdatedAt },
    ]);

    const response = await updateNoteRequest(accessToken, note.id, {
      body: { title: "Groceries" },
    });

    expect(response.status).toBe(200);

    const body = await readJson<NoteDetailBody>(response);
    expect(body.updated_at).not.toBeNull();
    expect(new Date(body.updated_at as string).getTime()).toBeGreaterThan(
      oldUpdatedAt.getTime(),
    );

    const stored = await prisma.notes.findUnique({ where: { id: note.id } });
    expect(stored?.updated_at?.getTime()).toBeGreaterThan(
      oldUpdatedAt.getTime(),
    );
  });

  it("updates the description", async () => {
    const { user, accessToken } = await createUser("alice");
    const [note] = await seedNotes(user.id, [{ title: "Shopping" }]);

    const response = await updateNoteRequest(accessToken, note.id, {
      body: { description: "Updated plan" },
    });

    expect(response.status).toBe(200);
    expect(await readJson<NoteDetailBody>(response)).toMatchObject({
      description: "Updated plan",
    });
  });

  it("clears the description with null", async () => {
    const { user, accessToken } = await createUser("alice");
    const [note] = await seedNotes(user.id, [
      { title: "Shopping", description: "Plan" },
    ]);

    const response = await updateNoteRequest(accessToken, note.id, {
      body: { description: null },
    });

    expect(response.status).toBe(200);
    expect(await readJson<NoteDetailBody>(response)).toMatchObject({
      description: null,
    });

    const stored = await prisma.notes.findUnique({ where: { id: note.id } });
    expect(stored?.description).toBeNull();
  });

  it("replaces the content and its derived plain text", async () => {
    const { user, accessToken } = await createUser("alice");
    const [note] = await seedNotes(user.id, [{ title: "Shopping" }]);

    const response = await updateNoteRequest(accessToken, note.id, {
      body: { content },
    });

    expect(response.status).toBe(200);
    expect(await readJson<NoteDetailBody>(response)).toMatchObject({
      content,
    });

    const stored = await prisma.notes.findUnique({ where: { id: note.id } });
    expect(stored?.content_json).toEqual(content);
    expect(stored?.content_text).toBe("Hello world");
  });

  it("attaches a project owned by the user", async () => {
    const { user, accessToken } = await createUser("alice");
    const project = await seedProject(user.id, { title: "Home" });
    const [note] = await seedNotes(user.id, [{ title: "Shopping" }]);

    const response = await updateNoteRequest(accessToken, note.id, {
      body: { project_id: project.id },
    });

    expect(response.status).toBe(200);
    expect(await readJson<NoteDetailBody>(response)).toMatchObject({
      project_id: project.id,
    });
  });

  it("detaches the project with null", async () => {
    const { user, accessToken } = await createUser("alice");
    const project = await seedProject(user.id, { title: "Home" });
    const [note] = await seedNotes(user.id, [
      { title: "Shopping", project_id: project.id },
    ]);

    const response = await updateNoteRequest(accessToken, note.id, {
      body: { project_id: null },
    });

    expect(response.status).toBe(200);
    expect(await readJson<NoteDetailBody>(response)).toMatchObject({
      project_id: null,
    });
  });

  it("does not attach a project owned by another user", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const project = await seedProject(bob.user.id, { title: "Bob's project" });
    const [note] = await seedNotes(alice.user.id, [{ title: "Shopping" }]);

    const response = await updateNoteRequest(alice.accessToken, note.id, {
      body: { project_id: project.id },
    });

    expect(response.status).toBe(404);
    expect(await readError(response)).toMatchObject({
      code: "NOT_FOUND",
      message: "Project not found",
    });

    const stored = await prisma.notes.findUnique({ where: { id: note.id } });
    expect(stored?.project_id).toBeNull();
  });

  it("does not update another user's note", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const [note] = await seedNotes(bob.user.id, [{ title: "Shopping" }]);

    const response = await updateNoteRequest(alice.accessToken, note.id, {
      body: { title: "Hijacked" },
    });

    expect(response.status).toBe(404);
    const stored = await prisma.notes.findUnique({ where: { id: note.id } });
    expect(stored?.title).toBe("Shopping");
  });

  it("returns 404 for an unknown note id", async () => {
    const { accessToken } = await createUser("alice");

    const response = await updateNoteRequest(accessToken, MISSING_NOTE_ID, {
      body: { title: "Groceries" },
    });

    expect(response.status).toBe(404);
  });

  it("returns 404 for a malformed note id", async () => {
    const { accessToken } = await createUser("alice");

    const response = await updateNoteRequest(accessToken, "not-a-uuid", {
      body: { title: "Groceries" },
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
    [{ project_id: "not-a-uuid" }, "project_id", "Must be a valid UUID"],
    [{ content: null }, "content", "Must be an object"],
    [
      { content: { type: "doc", content: [{ type: "text" }] } },
      "content.content[0].text",
      "Is required for text nodes",
    ],
    [
      { title: "Groceries", sections: [{ content: "Milk" }] },
      "sections",
      "Unknown field",
    ],
    [
      { title: "Groceries", user_id: MISSING_NOTE_ID },
      "user_id",
      "Unknown field",
    ],
  ])("rejects the invalid body %j", async (body, field, message) => {
    const { user, accessToken } = await createUser("alice");
    const [note] = await seedNotes(user.id, [{ title: "Shopping" }]);

    const response = await updateNoteRequest(accessToken, note.id, { body });

    expect(response.status).toBe(422);
    const error = await readError(response);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual(
      expect.arrayContaining([
        field === undefined ? { message } : { field, message },
      ]),
    );

    const stored = await prisma.notes.findUnique({ where: { id: note.id } });
    expect(stored?.title).toBe("Shopping");
  });

  it("rejects malformed JSON", async () => {
    const { user, accessToken } = await createUser("alice");
    const [note] = await seedNotes(user.id, [{ title: "Shopping" }]);

    const response = await updateNoteRequest(accessToken, note.id, {
      rawBody: "{",
    });

    expect(response.status).toBe(422);
    expect(await readError(response)).toMatchObject({
      code: "VALIDATION_ERROR",
      details: [{ message: "Request body must be valid JSON" }],
    });
  });
});

describe("DELETE /api/notes/{noteId}", () => {
  it("rejects a request without authentication", async () => {
    const { user } = await createUser("alice");
    const [note] = await seedNotes(user.id, [{ title: "Shopping" }]);

    const response = await deleteNoteRequest(undefined, note.id);

    expect(response.status).toBe(401);
    expect(await readError(response)).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("deletes a note owned by the authenticated user", async () => {
    const { user, accessToken } = await createUser("alice");
    const [note] = await seedNotes(user.id, [{ title: "Shopping" }]);

    const response = await deleteNoteRequest(accessToken, note.id);

    expect(response.status).toBe(204);
    expect(await prisma.notes.findUnique({ where: { id: note.id } })).toBeNull();
  });

  it("keeps the project the note was attached to", async () => {
    const { user, accessToken } = await createUser("alice");
    const project = await seedProject(user.id, { title: "Home" });
    const [note] = await seedNotes(user.id, [
      { title: "Shopping", project_id: project.id },
    ]);

    const response = await deleteNoteRequest(accessToken, note.id);

    expect(response.status).toBe(204);
    expect(
      await prisma.projects.findUnique({ where: { id: project.id } }),
    ).not.toBeNull();
  });

  it("does not delete another user's note", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const [note] = await seedNotes(bob.user.id, [{ title: "Shopping" }]);

    const response = await deleteNoteRequest(alice.accessToken, note.id);

    expect(response.status).toBe(404);
    expect(
      await prisma.notes.findUnique({ where: { id: note.id } }),
    ).not.toBeNull();
  });

  it("returns 404 for an unknown note id", async () => {
    const { accessToken } = await createUser("alice");

    const response = await deleteNoteRequest(accessToken, MISSING_NOTE_ID);

    expect(response.status).toBe(404);
  });

  it("returns 404 for a malformed note id", async () => {
    const { accessToken } = await createUser("alice");

    const response = await deleteNoteRequest(accessToken, "not-a-uuid");

    expect(response.status).toBe(404);
  });
});

describe("notes CRUD flow", () => {
  it("supports create, list, get, update and delete", async () => {
    const { user, accessToken } = await createUser("alice");
    const project = await seedProject(user.id, { title: "Home" });

    const createResponse = await createNoteRequest(accessToken, {
      body: {
        title: "Shopping",
        description: "Weekly groceries",
        project_id: project.id,
        content,
      },
    });
    expect(createResponse.status).toBe(201);
    const created = await readJson<NoteDetailBody>(createResponse);
    expect(created.content).toEqual(content);

    const listResponse = await listNotesRequest(accessToken);
    const list = await readJson<NoteListBody>(listResponse);
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).not.toHaveProperty("content");
    expect(list.items[0]).toMatchObject({ id: created.id, title: "Shopping" });

    const getResponse = await getNoteRequest(accessToken, created.id);
    expect(getResponse.status).toBe(200);
    expect(await readJson<NoteDetailBody>(getResponse)).toEqual(created);

    const updateResponse = await updateNoteRequest(accessToken, created.id, {
      body: { title: "Groceries", project_id: null, description: null },
    });
    expect(updateResponse.status).toBe(200);
    const updated = await readJson<NoteDetailBody>(updateResponse);
    expect(updated).toMatchObject({
      id: created.id,
      title: "Groceries",
      description: null,
      project_id: null,
      content,
    });

    const deleteResponse = await deleteNoteRequest(accessToken, created.id);
    expect(deleteResponse.status).toBe(204);

    const missingResponse = await getNoteRequest(accessToken, created.id);
    expect(missingResponse.status).toBe(404);
  });
});
