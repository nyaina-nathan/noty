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

interface NoteSectionBody {
  id: string;
  note_id: string;
  note_order: number | null;
  content: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface NoteDetailBody {
  id: string;
  title: string;
  sections: NoteSectionBody[];
}

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: Array<{ field?: string; message: string }>;
  };
}

interface SeedSection {
  content: string | null;
  note_order?: number;
}

const JWT_SECRET = "integration-test-jwt-secret-0123456789abcdef";
const MISSING_NOTE_ID = "11111111-1111-1111-1111-111111111111";
const MISSING_SECTION_ID = "22222222-2222-2222-2222-222222222222";
const OTHER_SECTION_ID = "33333333-3333-3333-3333-333333333333";

let prisma: PrismaClient;
let routes: {
  collection: typeof import("@/app/api/notes/[noteId]/sections/route");
  item: typeof import("@/app/api/notes/[noteId]/sections/[sectionId]/route");
  order: typeof import("@/app/api/notes/[noteId]/sections/order/route");
  noteItem: typeof import("@/app/api/notes/[noteId]/route");
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

async function seedNote(
  userId: string,
  note: { title: string },
) {
  return prisma.notes.create({
    data: { user_id: userId, title: note.title },
  });
}

async function seedSections(noteId: string, sections: SeedSection[]) {
  return Promise.all(
    sections.map((section, index) =>
      prisma.note_section.create({
        data: {
          note_id: noteId,
          content: section.content,
          note_order: section.note_order ?? index + 1,
        },
      }),
    ),
  );
}

function authCookies(accessToken: string | undefined) {
  return { [ACCESS_TOKEN_COOKIE]: accessToken };
}

function listSectionsRequest(
  accessToken: string | undefined,
  noteId: string,
  query = "",
) {
  return callRoute(
    routes.collection.GET,
    jsonRequest(`/api/notes/${noteId}/sections${query}`, {
      method: "GET",
      cookies: authCookies(accessToken),
    }),
    { params: Promise.resolve({ noteId }) },
  );
}

function createSectionRequest(
  accessToken: string | undefined,
  noteId: string,
  options: { body?: unknown; rawBody?: string },
) {
  return callRoute(
    routes.collection.POST,
    jsonRequest(`/api/notes/${noteId}/sections`, {
      method: "POST",
      cookies: authCookies(accessToken),
      ...options,
    }),
    { params: Promise.resolve({ noteId }) },
  );
}

function updateSectionRequest(
  accessToken: string | undefined,
  noteId: string,
  sectionId: string,
  options: { body?: unknown; rawBody?: string },
) {
  return callRoute(
    routes.item.PATCH,
    jsonRequest(`/api/notes/${noteId}/sections/${sectionId}`, {
      method: "PATCH",
      cookies: authCookies(accessToken),
      ...options,
    }),
    { params: Promise.resolve({ noteId, sectionId }) },
  );
}

function deleteSectionRequest(
  accessToken: string | undefined,
  noteId: string,
  sectionId: string,
) {
  return callRoute(
    routes.item.DELETE,
    jsonRequest(`/api/notes/${noteId}/sections/${sectionId}`, {
      method: "DELETE",
      cookies: authCookies(accessToken),
    }),
    { params: Promise.resolve({ noteId, sectionId }) },
  );
}

function reorderSectionsRequest(
  accessToken: string | undefined,
  noteId: string,
  options: { body?: unknown; rawBody?: string },
) {
  return callRoute(
    routes.order.PUT,
    jsonRequest(`/api/notes/${noteId}/sections/order`, {
      method: "PUT",
      cookies: authCookies(accessToken),
      ...options,
    }),
    { params: Promise.resolve({ noteId }) },
  );
}

function getNoteRequest(accessToken: string | undefined, noteId: string) {
  return callRoute(
    routes.noteItem.GET,
    jsonRequest(`/api/notes/${noteId}`, {
      method: "GET",
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
    collection: await import("@/app/api/notes/[noteId]/sections/route"),
    item: await import("@/app/api/notes/[noteId]/sections/[sectionId]/route"),
    order: await import("@/app/api/notes/[noteId]/sections/order/route"),
    noteItem: await import("@/app/api/notes/[noteId]/route"),
  };
});

afterEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "users" CASCADE');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/notes/{noteId}/sections", () => {
  it("rejects a request without authentication", async () => {
    const { user } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });

    const response = await listSectionsRequest(undefined, note.id);

    expect(response.status).toBe(401);
    expect(await readError(response)).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("returns an empty array for a note without sections", async () => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });

    const response = await listSectionsRequest(accessToken, note.id);

    expect(response.status).toBe(200);
    expect(await readJson<NoteSectionBody[]>(response)).toEqual([]);
  });

  it("returns the note's sections ordered by note_order ascending by default", async () => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });
    await seedSections(note.id, [
      { content: "Third", note_order: 3 },
      { content: "First", note_order: 1 },
      { content: "Second", note_order: 2 },
    ]);

    const response = await listSectionsRequest(accessToken, note.id);

    expect(response.status).toBe(200);

    const body = await readJson<NoteSectionBody[]>(response);
    expect(body.map((section) => section.content)).toEqual([
      "First",
      "Second",
      "Third",
    ]);
    expect(body.map((section) => section.note_id)).toEqual([
      note.id,
      note.id,
      note.id,
    ]);
  });

  it("supports descending order", async () => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });
    await seedSections(note.id, [
      { content: "First", note_order: 1 },
      { content: "Third", note_order: 3 },
      { content: "Second", note_order: 2 },
    ]);

    const response = await listSectionsRequest(accessToken, note.id, "?order=desc");

    expect(response.status).toBe(200);

    const body = await readJson<NoteSectionBody[]>(response);
    expect(body.map((section) => section.content)).toEqual([
      "Third",
      "Second",
      "First",
    ]);
  });

  it("does not return sections of another note", async () => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });
    const otherNote = await seedNote(user.id, { title: "Personal" });
    await seedSections(note.id, [{ content: "Milk" }]);
    await seedSections(otherNote.id, [{ content: "Gym" }]);

    const response = await listSectionsRequest(accessToken, note.id);

    const body = await readJson<NoteSectionBody[]>(response);
    expect(body.map((section) => section.content)).toEqual(["Milk"]);
  });

  it("hides another user's note", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const note = await seedNote(bob.user.id, { title: "Shopping" });

    const response = await listSectionsRequest(alice.accessToken, note.id);

    expect(response.status).toBe(404);
    expect(await readError(response)).toMatchObject({
      code: "NOT_FOUND",
      message: "Note not found",
    });
  });

  it("returns 404 for an unknown or malformed note id", async () => {
    const { accessToken } = await createUser("alice");

    const unknown = await listSectionsRequest(accessToken, MISSING_NOTE_ID);
    expect(unknown.status).toBe(404);

    const malformed = await listSectionsRequest(accessToken, "not-a-uuid");
    expect(malformed.status).toBe(404);
  });

  it("rejects an invalid order", async () => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });

    const response = await listSectionsRequest(accessToken, note.id, "?order=sideways");

    expect(response.status).toBe(422);
    expect(await readError(response)).toMatchObject({
      code: "VALIDATION_ERROR",
      details: [{ field: "order", message: "Must be one of: asc, desc" }],
    });
  });
});

describe("POST /api/notes/{noteId}/sections", () => {
  it("rejects a request without authentication", async () => {
    const { user } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });

    const response = await createSectionRequest(undefined, note.id, {
      body: { content: "Milk" },
    });

    expect(response.status).toBe(401);
    expect(await readError(response)).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("appends a section after the current highest note_order", async () => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });
    await seedSections(note.id, [
      { content: "First", note_order: 1 },
      { content: "Fifth", note_order: 5 },
    ]);

    const response = await createSectionRequest(accessToken, note.id, {
      body: { content: "Sixth" },
    });

    expect(response.status).toBe(201);

    const body = await readJson<NoteSectionBody>(response);
    expect(body).toMatchObject({
      note_id: note.id,
      note_order: 6,
      content: "Sixth",
      created_at: expect.any(String),
    });

    const stored = await prisma.note_section.findUnique({
      where: { id: body.id },
    });
    expect(stored).toMatchObject({
      note_id: note.id,
      note_order: 6,
      content: "Sixth",
    });
  });

  it("starts at note_order 1 for a note without sections", async () => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });

    const response = await createSectionRequest(accessToken, note.id, {
      body: { content: "First" },
    });

    expect(response.status).toBe(201);
    expect(await readJson<NoteSectionBody>(response)).toMatchObject({
      note_order: 1,
    });
  });

  it("keeps an explicit note_order", async () => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });

    const response = await createSectionRequest(accessToken, note.id, {
      body: { content: "Fifth", note_order: 5 },
    });

    expect(response.status).toBe(201);
    expect(await readJson<NoteSectionBody>(response)).toMatchObject({
      note_order: 5,
    });
  });

  it("defaults the content to null", async () => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });

    const response = await createSectionRequest(accessToken, note.id, {
      body: {},
    });

    expect(response.status).toBe(201);
    expect(await readJson<NoteSectionBody>(response)).toMatchObject({
      content: null,
      note_order: 1,
    });
  });

  it("accepts an explicit null content", async () => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });

    const response = await createSectionRequest(accessToken, note.id, {
      body: { content: null },
    });

    expect(response.status).toBe(201);
    expect(await readJson<NoteSectionBody>(response)).toMatchObject({
      content: null,
    });
  });

  it("rejects another user's note", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const note = await seedNote(bob.user.id, { title: "Shopping" });

    const response = await createSectionRequest(alice.accessToken, note.id, {
      body: { content: "Milk" },
    });

    expect(response.status).toBe(404);
    expect(await readError(response)).toMatchObject({
      code: "NOT_FOUND",
      message: "Note not found",
    });
    expect(
      await prisma.note_section.count({ where: { note_id: note.id } }),
    ).toBe(0);
  });

  it("returns 404 for an unknown or malformed note id", async () => {
    const { accessToken } = await createUser("alice");

    const unknown = await createSectionRequest(accessToken, MISSING_NOTE_ID, {
      body: { content: "Milk" },
    });
    expect(unknown.status).toBe(404);

    const malformed = await createSectionRequest(accessToken, "not-a-uuid", {
      body: { content: "Milk" },
    });
    expect(malformed.status).toBe(404);
  });

  it.each([
    [{ content: 42 }, "content", "Must be a string or null"],
    [{ note_order: 0 }, "note_order", "Must be a positive integer"],
    [{ note_order: 1.5 }, "note_order", "Must be a positive integer"],
    [
      { content: "Milk", note_id: MISSING_NOTE_ID },
      "note_id",
      "Unknown field",
    ],
  ])("rejects the invalid body %j", async (body, field, message) => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });

    const response = await createSectionRequest(accessToken, note.id, { body });

    expect(response.status).toBe(422);
    expect(await readError(response)).toMatchObject({
      code: "VALIDATION_ERROR",
      details: [{ field, message }],
    });
    expect(
      await prisma.note_section.count({ where: { note_id: note.id } }),
    ).toBe(0);
  });

  it("rejects malformed JSON", async () => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });

    const response = await createSectionRequest(accessToken, note.id, {
      rawBody: "{",
    });

    expect(response.status).toBe(422);
    expect(await readError(response)).toMatchObject({
      code: "VALIDATION_ERROR",
      details: [{ message: "Request body must be valid JSON" }],
    });
  });
});

describe("PATCH /api/notes/{noteId}/sections/{sectionId}", () => {
  it("rejects a request without authentication", async () => {
    const { user } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });
    const [section] = await seedSections(note.id, [{ content: "Milk" }]);

    const response = await updateSectionRequest(undefined, note.id, section.id, {
      body: { content: "Oat milk" },
    });

    expect(response.status).toBe(401);
    expect(await readError(response)).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("updates the content and leaves omitted fields unchanged", async () => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });
    const [section] = await seedSections(note.id, [
      { content: "Milk", note_order: 4 },
    ]);

    const response = await updateSectionRequest(accessToken, note.id, section.id, {
      body: { content: "Oat milk" },
    });

    expect(response.status).toBe(200);
    expect(await readJson<NoteSectionBody>(response)).toMatchObject({
      id: section.id,
      note_id: note.id,
      content: "Oat milk",
      note_order: 4,
    });
  });

  it("clears the content with null", async () => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });
    const [section] = await seedSections(note.id, [{ content: "Milk" }]);

    const response = await updateSectionRequest(accessToken, note.id, section.id, {
      body: { content: null },
    });

    expect(response.status).toBe(200);
    expect(await readJson<NoteSectionBody>(response)).toMatchObject({
      content: null,
    });

    const stored = await prisma.note_section.findUnique({
      where: { id: section.id },
    });
    expect(stored?.content).toBeNull();
  });

  it("updates note_order and refreshes updated_at", async () => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });
    const [section] = await seedSections(note.id, [
      { content: "Milk", note_order: 1 },
    ]);

    const response = await updateSectionRequest(accessToken, note.id, section.id, {
      body: { note_order: 3 },
    });

    expect(response.status).toBe(200);

    const body = await readJson<NoteSectionBody>(response);
    expect(body.note_order).toBe(3);
    expect(body.updated_at).not.toBeNull();

    const stored = await prisma.note_section.findUnique({
      where: { id: section.id },
    });
    expect(stored?.note_order).toBe(3);
    expect(stored?.updated_at).not.toBeNull();
  });

  it("does not update a section of another note", async () => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });
    const otherNote = await seedNote(user.id, { title: "Personal" });
    const [section] = await seedSections(otherNote.id, [{ content: "Gym" }]);

    const response = await updateSectionRequest(accessToken, note.id, section.id, {
      body: { content: "Hijacked" },
    });

    expect(response.status).toBe(404);
    expect(await readError(response)).toMatchObject({
      code: "NOT_FOUND",
      message: "Note section not found",
    });

    const stored = await prisma.note_section.findUnique({
      where: { id: section.id },
    });
    expect(stored?.content).toBe("Gym");
  });

  it("hides sections of another user's note", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const note = await seedNote(bob.user.id, { title: "Shopping" });
    const [section] = await seedSections(note.id, [{ content: "Milk" }]);

    const response = await updateSectionRequest(
      alice.accessToken,
      note.id,
      section.id,
      { body: { content: "Hijacked" } },
    );

    expect(response.status).toBe(404);
    expect(await readError(response)).toMatchObject({
      code: "NOT_FOUND",
      message: "Note not found",
    });
  });

  it("returns 404 for an unknown section id", async () => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });

    const response = await updateSectionRequest(
      accessToken,
      note.id,
      MISSING_SECTION_ID,
      { body: { content: "Milk" } },
    );

    expect(response.status).toBe(404);
    expect(await readError(response)).toMatchObject({
      code: "NOT_FOUND",
      message: "Note section not found",
    });
  });

  it("returns 404 for malformed ids", async () => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });
    const [section] = await seedSections(note.id, [{ content: "Milk" }]);

    const malformedNote = await updateSectionRequest(
      accessToken,
      "not-a-uuid",
      section.id,
      { body: { content: "Milk" } },
    );
    expect(malformedNote.status).toBe(404);

    const malformedSection = await updateSectionRequest(
      accessToken,
      note.id,
      "not-a-uuid",
      { body: { content: "Milk" } },
    );
    expect(malformedSection.status).toBe(404);
  });

  it.each([
    [{}, undefined, "At least one field is required"],
    [{ content: 42 }, "content", "Must be a string or null"],
    [{ note_order: 0 }, "note_order", "Must be a positive integer"],
    [{ note_order: null }, "note_order", "Must be a positive integer"],
    [
      { content: "Milk", section_id: MISSING_SECTION_ID },
      "section_id",
      "Unknown field",
    ],
  ])("rejects the invalid body %j", async (body, field, message) => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });
    const [section] = await seedSections(note.id, [{ content: "Milk" }]);

    const response = await updateSectionRequest(accessToken, note.id, section.id, {
      body,
    });

    expect(response.status).toBe(422);
    expect(await readError(response)).toMatchObject({
      code: "VALIDATION_ERROR",
      details: expect.arrayContaining([
        field === undefined ? { message } : { field, message },
      ]),
    });

    const stored = await prisma.note_section.findUnique({
      where: { id: section.id },
    });
    expect(stored?.content).toBe("Milk");
  });

  it("rejects malformed JSON", async () => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });
    const [section] = await seedSections(note.id, [{ content: "Milk" }]);

    const response = await updateSectionRequest(accessToken, note.id, section.id, {
      rawBody: "{",
    });

    expect(response.status).toBe(422);
    expect(await readError(response)).toMatchObject({
      code: "VALIDATION_ERROR",
      details: [{ message: "Request body must be valid JSON" }],
    });
  });
});

describe("DELETE /api/notes/{noteId}/sections/{sectionId}", () => {
  it("rejects a request without authentication", async () => {
    const { user } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });
    const [section] = await seedSections(note.id, [{ content: "Milk" }]);

    const response = await deleteSectionRequest(undefined, note.id, section.id);

    expect(response.status).toBe(401);
    expect(await readError(response)).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("deletes a section and leaves the remaining orders unchanged", async () => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });
    const [first, second, third] = await seedSections(note.id, [
      { content: "First", note_order: 1 },
      { content: "Second", note_order: 2 },
      { content: "Third", note_order: 3 },
    ]);

    const response = await deleteSectionRequest(accessToken, note.id, second.id);

    expect(response.status).toBe(204);
    expect(
      await prisma.note_section.findUnique({ where: { id: second.id } }),
    ).toBeNull();

    const remaining = await prisma.note_section.findMany({
      where: { note_id: note.id },
      orderBy: { note_order: "asc" },
    });
    expect(remaining.map((section) => section.id)).toEqual([
      first.id,
      third.id,
    ]);
    expect(remaining.map((section) => section.note_order)).toEqual([1, 3]);
  });

  it("does not delete a section of another note", async () => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });
    const otherNote = await seedNote(user.id, { title: "Personal" });
    const [section] = await seedSections(otherNote.id, [{ content: "Gym" }]);

    const response = await deleteSectionRequest(accessToken, note.id, section.id);

    expect(response.status).toBe(404);
    expect(
      await prisma.note_section.findUnique({ where: { id: section.id } }),
    ).not.toBeNull();
  });

  it("hides sections of another user's note", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const note = await seedNote(bob.user.id, { title: "Shopping" });
    const [section] = await seedSections(note.id, [{ content: "Milk" }]);

    const response = await deleteSectionRequest(
      alice.accessToken,
      note.id,
      section.id,
    );

    expect(response.status).toBe(404);
    expect(
      await prisma.note_section.findUnique({ where: { id: section.id } }),
    ).not.toBeNull();
  });

  it("returns 404 for unknown or malformed ids", async () => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });
    const [section] = await seedSections(note.id, [{ content: "Milk" }]);

    const unknown = await deleteSectionRequest(
      accessToken,
      note.id,
      MISSING_SECTION_ID,
    );
    expect(unknown.status).toBe(404);
    expect(await readError(unknown)).toMatchObject({
      message: "Note section not found",
    });

    const malformedNote = await deleteSectionRequest(
      accessToken,
      "not-a-uuid",
      section.id,
    );
    expect(malformedNote.status).toBe(404);

    const malformedSection = await deleteSectionRequest(
      accessToken,
      note.id,
      "not-a-uuid",
    );
    expect(malformedSection.status).toBe(404);
  });
});

describe("PUT /api/notes/{noteId}/sections/order", () => {
  it("rejects a request without authentication", async () => {
    const { user } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });
    const [section] = await seedSections(note.id, [{ content: "Milk" }]);

    const response = await reorderSectionsRequest(undefined, note.id, {
      body: { sectionIds: [section.id] },
    });

    expect(response.status).toBe(401);
    expect(await readError(response)).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rewrites note_order as 1..n and returns the new order", async () => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });
    const [first, second, third] = await seedSections(note.id, [
      { content: "First" },
      { content: "Second" },
      { content: "Third" },
    ]);

    const response = await reorderSectionsRequest(accessToken, note.id, {
      body: { sectionIds: [third.id, first.id, second.id] },
    });

    expect(response.status).toBe(200);

    const body = await readJson<NoteSectionBody[]>(response);
    expect(body.map((section) => section.id)).toEqual([
      third.id,
      first.id,
      second.id,
    ]);
    expect(body.map((section) => section.note_order)).toEqual([1, 2, 3]);

    const stored = await prisma.note_section.findMany({
      where: { note_id: note.id },
      orderBy: { note_order: "asc" },
    });
    expect(stored.map((section) => section.id)).toEqual([
      third.id,
      first.id,
      second.id,
    ]);
  });

  it("accepts section ids in uppercase", async () => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });
    const [first, second] = await seedSections(note.id, [
      { content: "First" },
      { content: "Second" },
    ]);

    const response = await reorderSectionsRequest(accessToken, note.id, {
      body: { sectionIds: [second.id.toUpperCase(), first.id.toUpperCase()] },
    });

    expect(response.status).toBe(200);
  });

  it("rejects a list that misses a section and leaves the order unchanged", async () => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });
    const [first, second] = await seedSections(note.id, [
      { content: "First", note_order: 1 },
      { content: "Second", note_order: 2 },
    ]);

    const response = await reorderSectionsRequest(accessToken, note.id, {
      body: { sectionIds: [second.id] },
    });

    expect(response.status).toBe(422);
    expect(await readError(response)).toMatchObject({
      code: "VALIDATION_ERROR",
      details: [
        {
          field: "sectionIds",
          message: "Must contain every section of the note exactly once",
        },
      ],
    });

    const stored = await prisma.note_section.findMany({
      where: { note_id: note.id },
      orderBy: { note_order: "asc" },
    });
    expect(stored.map((section) => section.id)).toEqual([first.id, second.id]);
  });

  it("rejects an unknown section id and leaves the order unchanged", async () => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });
    const [first, second] = await seedSections(note.id, [
      { content: "First", note_order: 1 },
      { content: "Second", note_order: 2 },
    ]);

    const response = await reorderSectionsRequest(accessToken, note.id, {
      body: { sectionIds: [second.id, first.id, OTHER_SECTION_ID] },
    });

    expect(response.status).toBe(422);

    const stored = await prisma.note_section.findMany({
      where: { note_id: note.id },
      orderBy: { note_order: "asc" },
    });
    expect(stored.map((section) => section.id)).toEqual([first.id, second.id]);
  });

  it("rejects section ids that belong to another note", async () => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });
    const otherNote = await seedNote(user.id, { title: "Personal" });
    const [section] = await seedSections(note.id, [{ content: "Milk" }]);
    const [otherSection] = await seedSections(otherNote.id, [
      { content: "Gym" },
    ]);

    const response = await reorderSectionsRequest(accessToken, note.id, {
      body: { sectionIds: [section.id, otherSection.id] },
    });

    expect(response.status).toBe(422);
  });

  it.each([
    [{}, "sectionIds", "Is required"],
    [{ sectionIds: [] }, "sectionIds", "Must not be empty"],
    [
      { sectionIds: [MISSING_SECTION_ID, MISSING_SECTION_ID] },
      "sectionIds[1]",
      "Must not contain duplicates",
    ],
    [
      { sectionIds: [MISSING_SECTION_ID, "not-a-uuid"] },
      "sectionIds[1]",
      "Must be a valid UUID",
    ],
    [
      { sectionIds: [MISSING_SECTION_ID], note_id: MISSING_NOTE_ID },
      "note_id",
      "Unknown field",
    ],
  ])("rejects the invalid body %j", async (body, field, message) => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });

    const response = await reorderSectionsRequest(accessToken, note.id, { body });

    expect(response.status).toBe(422);
    expect(await readError(response)).toMatchObject({
      code: "VALIDATION_ERROR",
      details: [{ field, message }],
    });
  });

  it("hides another user's note", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const note = await seedNote(bob.user.id, { title: "Shopping" });
    const [section] = await seedSections(note.id, [{ content: "Milk" }]);

    const response = await reorderSectionsRequest(alice.accessToken, note.id, {
      body: { sectionIds: [section.id] },
    });

    expect(response.status).toBe(404);
    expect(await readError(response)).toMatchObject({
      code: "NOT_FOUND",
      message: "Note not found",
    });
  });

  it("returns 404 for an unknown or malformed note id", async () => {
    const { accessToken } = await createUser("alice");

    const unknown = await reorderSectionsRequest(accessToken, MISSING_NOTE_ID, {
      body: { sectionIds: [MISSING_SECTION_ID] },
    });
    expect(unknown.status).toBe(404);

    const malformed = await reorderSectionsRequest(accessToken, "not-a-uuid", {
      body: { sectionIds: [MISSING_SECTION_ID] },
    });
    expect(malformed.status).toBe(404);
  });

  it("rejects malformed JSON", async () => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });

    const response = await reorderSectionsRequest(accessToken, note.id, {
      rawBody: "{",
    });

    expect(response.status).toBe(422);
    expect(await readError(response)).toMatchObject({
      code: "VALIDATION_ERROR",
      details: [{ message: "Request body must be valid JSON" }],
    });
  });
});

describe("note sections flow", () => {
  it("supports add, list, update, reorder and delete", async () => {
    const { user, accessToken } = await createUser("alice");
    const note = await seedNote(user.id, { title: "Shopping" });

    const firstResponse = await createSectionRequest(accessToken, note.id, {
      body: { content: "Milk" },
    });
    const first = await readJson<NoteSectionBody>(firstResponse);
    const secondResponse = await createSectionRequest(accessToken, note.id, {
      body: { content: "Bread" },
    });
    const second = await readJson<NoteSectionBody>(secondResponse);

    expect([first.note_order, second.note_order]).toEqual([1, 2]);

    const listResponse = await listSectionsRequest(accessToken, note.id);
    expect(
      (await readJson<NoteSectionBody[]>(listResponse)).map(
        (section) => section.content,
      ),
    ).toEqual(["Milk", "Bread"]);

    const updateResponse = await updateSectionRequest(
      accessToken,
      note.id,
      first.id,
      { body: { content: "Oat milk" } },
    );
    expect(updateResponse.status).toBe(200);

    const reorderResponse = await reorderSectionsRequest(accessToken, note.id, {
      body: { sectionIds: [second.id, first.id] },
    });
    expect(reorderResponse.status).toBe(200);
    expect(
      (await readJson<NoteSectionBody[]>(reorderResponse)).map(
        (section) => section.content,
      ),
    ).toEqual(["Bread", "Oat milk"]);

    const getNoteResponse = await getNoteRequest(accessToken, note.id);
    expect(getNoteResponse.status).toBe(200);
    const noteBody = await readJson<NoteDetailBody>(getNoteResponse);
    expect(noteBody.sections.map((section) => section.content)).toEqual([
      "Bread",
      "Oat milk",
    ]);

    const deleteResponse = await deleteSectionRequest(
      accessToken,
      note.id,
      first.id,
    );
    expect(deleteResponse.status).toBe(204);

    expect(
      await prisma.note_section.count({ where: { note_id: note.id } }),
    ).toBe(1);
  });
});
