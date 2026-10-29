import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  validateCreateNoteInput,
  validateListNotesQuery,
  validateNoteId,
  validateUpdateNoteInput,
} from "@/validators/note.validators";

const NOTE_ID = "11111111-1111-1111-1111-111111111111";
const PROJECT_ID = "22222222-2222-2222-2222-222222222222";
const TAG_ID = "33333333-3333-3333-3333-333333333333";
const TITLE_MAX_LENGTH = 255;

function captureApiError(run: () => unknown): ApiError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }

  throw new Error("Expected the validator to throw");
}

function query(params: Record<string, string> = {}): URLSearchParams {
  return new URLSearchParams(params);
}

describe("validateCreateNoteInput", () => {
  it("accepts a title and defaults the optional fields", () => {
    expect(validateCreateNoteInput({ title: "  Shopping  " })).toEqual({
      title: "Shopping",
      description: null,
      project_id: null,
      sections: [],
    });
  });

  it("accepts description and project_id", () => {
    expect(
      validateCreateNoteInput({
        title: "Shopping",
        description: "Weekly groceries",
        project_id: PROJECT_ID,
      }),
    ).toEqual({
      title: "Shopping",
      description: "Weekly groceries",
      project_id: PROJECT_ID,
      sections: [],
    });
  });

  it("accepts explicit null description and project_id", () => {
    expect(
      validateCreateNoteInput({
        title: "Shopping",
        description: null,
        project_id: null,
      }),
    ).toEqual({
      title: "Shopping",
      description: null,
      project_id: null,
      sections: [],
    });
  });

  it("accepts an empty description", () => {
    expect(
      validateCreateNoteInput({ title: "Shopping", description: "" }),
    ).toMatchObject({ description: "" });
  });

  it("accepts a title with exactly the maximum length", () => {
    const title = "a".repeat(TITLE_MAX_LENGTH);

    expect(validateCreateNoteInput({ title })).toMatchObject({ title });
  });

  it("accepts sections and assigns sequential orders when omitted", () => {
    expect(
      validateCreateNoteInput({
        title: "Shopping",
        sections: [{ content: "Milk" }, { content: null }, { content: "" }],
      }),
    ).toEqual({
      title: "Shopping",
      description: null,
      project_id: null,
      sections: [
        { content: "Milk", note_order: 1 },
        { content: null, note_order: 2 },
        { content: "", note_order: 3 },
      ],
    });
  });

  it("keeps explicit section orders", () => {
    expect(
      validateCreateNoteInput({
        title: "Shopping",
        sections: [
          { content: "Milk", note_order: 5 },
          { content: "Bread" },
        ],
      }).sections,
    ).toEqual([
      { content: "Milk", note_order: 5 },
      { content: "Bread", note_order: 2 },
    ]);
  });

  it("rejects a missing title", () => {
    const error = captureApiError(() => validateCreateNoteInput({}));

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.status).toBe(422);
    expect(error.details).toEqual([{ field: "title", message: "Is required" }]);
  });

  it.each(["", "   ", "\t\n"])("rejects the blank title %j", (title) => {
    const error = captureApiError(() => validateCreateNoteInput({ title }));

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { field: "title", message: "Must not be empty" },
    ]);
  });

  it.each([null, 42, true, [], {}])(
    "rejects the non-string title %j",
    (title) => {
      const error = captureApiError(() => validateCreateNoteInput({ title }));

      expect(error.details).toEqual([
        { field: "title", message: "Must be a string" },
      ]);
    },
  );

  it("rejects a title longer than the maximum length", () => {
    const error = captureApiError(() =>
      validateCreateNoteInput({ title: "a".repeat(TITLE_MAX_LENGTH + 1) }),
    );

    expect(error.details).toEqual([
      {
        field: "title",
        message: `Must be at most ${TITLE_MAX_LENGTH} characters`,
      },
    ]);
  });

  it.each([42, true, [], {}])(
    "rejects the non-string description %j",
    (description) => {
      const error = captureApiError(() =>
        validateCreateNoteInput({ title: "Shopping", description }),
      );

      expect(error.details).toEqual([
        { field: "description", message: "Must be a string or null" },
      ]);
    },
  );

  it.each([42, true, [], {}])(
    "rejects the non-string project_id %j",
    (project_id) => {
      const error = captureApiError(() =>
        validateCreateNoteInput({ title: "Shopping", project_id }),
      );

      expect(error.details).toEqual([
        { field: "project_id", message: "Must be a string or null" },
      ]);
    },
  );

  it.each([
    "",
    "not-a-uuid",
    `${PROJECT_ID}-extra`,
    "22222222222222222222222222222222",
  ])("rejects the malformed project_id %j", (project_id) => {
    const error = captureApiError(() =>
      validateCreateNoteInput({ title: "Shopping", project_id }),
    );

    expect(error.details).toEqual([
      { field: "project_id", message: "Must be a valid UUID" },
    ]);
  });

  it.each([null, "sections", 42, {}])(
    "rejects the non-array sections %j",
    (sections) => {
      const error = captureApiError(() =>
        validateCreateNoteInput({ title: "Shopping", sections }),
      );

      expect(error.details).toEqual([
        { field: "sections", message: "Must be an array" },
      ]);
    },
  );

  it("rejects a non-object section", () => {
    const error = captureApiError(() =>
      validateCreateNoteInput({ title: "Shopping", sections: ["Milk"] }),
    );

    expect(error.details).toEqual([
      { field: "sections[0]", message: "Must be an object" },
    ]);
  });

  it("rejects unknown section fields and reports their path", () => {
    const error = captureApiError(() =>
      validateCreateNoteInput({
        title: "Shopping",
        sections: [{ content: "Milk", note_id: NOTE_ID }],
      }),
    );

    expect(error.details).toEqual([
      { field: "note_id", message: "Unknown field" },
    ]);
  });

  it.each([42, true, [], {}])(
    "rejects the non-string section content %j",
    (content) => {
      const error = captureApiError(() =>
        validateCreateNoteInput({
          title: "Shopping",
          sections: [{ content }],
        }),
      );

      expect(error.details).toEqual([
        {
          field: "sections[0].content",
          message: "Must be a string or null",
        },
      ]);
    },
  );

  it.each([0, -1, 1.5, "2", null, true])(
    "rejects the invalid note_order %j",
    (note_order) => {
      const error = captureApiError(() =>
        validateCreateNoteInput({
          title: "Shopping",
          sections: [{ content: "Milk", note_order }],
        }),
      );

      expect(error.details).toEqual([
        {
          field: "sections[0].note_order",
          message: "Must be a positive integer",
        },
      ]);
    },
  );

  it("rejects unknown top-level fields", () => {
    const error = captureApiError(() =>
      validateCreateNoteInput({ title: "Shopping", user_id: NOTE_ID }),
    );

    expect(error.details).toEqual([
      { field: "user_id", message: "Unknown field" },
    ]);
  });

  it("reports multiple problems at once", () => {
    const error = captureApiError(() =>
      validateCreateNoteInput({
        title: "",
        description: 42,
        project_id: "nope",
        sections: [{ content: 1, note_order: 0 }],
        extra: true,
      }),
    );

    expect(error.details).toEqual([
      { field: "extra", message: "Unknown field" },
      { field: "title", message: "Must not be empty" },
      { field: "description", message: "Must be a string or null" },
      { field: "project_id", message: "Must be a valid UUID" },
      {
        field: "sections[0].content",
        message: "Must be a string or null",
      },
      {
        field: "sections[0].note_order",
        message: "Must be a positive integer",
      },
    ]);
  });

  it.each([null, [], "Shopping", 42, true])(
    "rejects the non-object body %j",
    (body) => {
      const error = captureApiError(() => validateCreateNoteInput(body));

      expect(error.details).toEqual([
        { message: "Request body must be a JSON object" },
      ]);
    },
  );
});

describe("validateUpdateNoteInput", () => {
  it("accepts a title only", () => {
    expect(validateUpdateNoteInput({ title: "  Shopping  " })).toEqual({
      title: "Shopping",
    });
  });

  it("accepts a description only", () => {
    expect(validateUpdateNoteInput({ description: "Groceries" })).toEqual({
      description: "Groceries",
    });
  });

  it("accepts null to clear the description", () => {
    expect(validateUpdateNoteInput({ description: null })).toEqual({
      description: null,
    });
  });

  it("accepts a project id to attach a project", () => {
    expect(validateUpdateNoteInput({ project_id: PROJECT_ID })).toEqual({
      project_id: PROJECT_ID,
    });
  });

  it("accepts null to detach the project", () => {
    expect(validateUpdateNoteInput({ project_id: null })).toEqual({
      project_id: null,
    });
  });

  it("accepts multiple fields", () => {
    expect(
      validateUpdateNoteInput({
        title: "Shopping",
        description: null,
        project_id: null,
      }),
    ).toEqual({ title: "Shopping", description: null, project_id: null });
  });

  it("rejects an empty body", () => {
    const error = captureApiError(() => validateUpdateNoteInput({}));

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { message: "At least one field is required" },
    ]);
  });

  it("rejects an unknown field and reports the empty body", () => {
    const error = captureApiError(() =>
      validateUpdateNoteInput({ user_id: NOTE_ID }),
    );

    expect(error.details).toEqual([
      { field: "user_id", message: "Unknown field" },
      { message: "At least one field is required" },
    ]);
  });

  it("rejects sections on update", () => {
    const error = captureApiError(() =>
      validateUpdateNoteInput({
        title: "Shopping",
        sections: [{ content: "Milk" }],
      }),
    );

    expect(error.details).toEqual([
      { field: "sections", message: "Unknown field" },
    ]);
  });

  it("rejects a null title", () => {
    const error = captureApiError(() =>
      validateUpdateNoteInput({ title: null }),
    );

    expect(error.details).toEqual([
      { field: "title", message: "Must be a string" },
    ]);
  });

  it("rejects a blank title", () => {
    const error = captureApiError(() =>
      validateUpdateNoteInput({ title: "   " }),
    );

    expect(error.details).toEqual([
      { field: "title", message: "Must not be empty" },
    ]);
  });

  it("rejects a title longer than the maximum length", () => {
    const error = captureApiError(() =>
      validateUpdateNoteInput({ title: "a".repeat(TITLE_MAX_LENGTH + 1) }),
    );

    expect(error.details).toEqual([
      {
        field: "title",
        message: `Must be at most ${TITLE_MAX_LENGTH} characters`,
      },
    ]);
  });

  it("rejects an invalid description alongside a valid title", () => {
    const error = captureApiError(() =>
      validateUpdateNoteInput({ title: "Shopping", description: 42 }),
    );

    expect(error.details).toEqual([
      { field: "description", message: "Must be a string or null" },
    ]);
  });

  it("rejects an invalid project id alongside a valid title", () => {
    const error = captureApiError(() =>
      validateUpdateNoteInput({ title: "Shopping", project_id: "nope" }),
    );

    expect(error.details).toEqual([
      { field: "project_id", message: "Must be a valid UUID" },
    ]);
  });
});

describe("validateNoteId", () => {
  it("returns a valid UUID unchanged", () => {
    expect(validateNoteId(NOTE_ID)).toBe(NOTE_ID);
  });

  it("accepts uppercase UUIDs", () => {
    const uppercaseId = NOTE_ID.toUpperCase();

    expect(validateNoteId(uppercaseId)).toBe(uppercaseId);
  });

  it.each([
    "",
    "not-a-uuid",
    `${NOTE_ID}-extra`,
    `{${NOTE_ID}}`,
    "11111111111111111111111111111111",
  ])("rejects the malformed id %j", (noteId) => {
    const error = captureApiError(() => validateNoteId(noteId));

    expect(error.code).toBe("NOT_FOUND");
    expect(error.status).toBe(404);
    expect(error.message).toBe("Note not found");
  });
});

describe("validateListNotesQuery", () => {
  it("applies the default pagination and sorting", () => {
    expect(validateListNotesQuery(query())).toEqual({
      page: 1,
      perPage: 20,
      search: null,
      project_id: null,
      tag_id: null,
      sort: "created_at",
      order: "desc",
    });
  });

  it("parses explicit query parameters", () => {
    expect(
      validateListNotesQuery(
        query({
          page: "3",
          perPage: "15",
          search: "  Shopping  ",
          project_id: PROJECT_ID,
          tag_id: TAG_ID,
          sort: "title",
          order: "asc",
        }),
      ),
    ).toEqual({
      page: 3,
      perPage: 15,
      search: "Shopping",
      project_id: PROJECT_ID,
      tag_id: TAG_ID,
      sort: "title",
      order: "asc",
    });
  });

  it.each(["", "   ", "\t"])(
    "treats the blank search %j as no filter",
    (search) => {
      expect(validateListNotesQuery(query({ search })).search).toBeNull();
    },
  );

  it("accepts a search at the maximum length", () => {
    const search = "a".repeat(TITLE_MAX_LENGTH);

    expect(validateListNotesQuery(query({ search })).search).toBe(search);
  });

  it("rejects a search longer than the maximum length", () => {
    const error = captureApiError(() =>
      validateListNotesQuery(
        query({ search: "a".repeat(TITLE_MAX_LENGTH + 1) }),
      ),
    );

    expect(error.details).toEqual([
      {
        field: "search",
        message: `Must be at most ${TITLE_MAX_LENGTH} characters`,
      },
    ]);
  });

  it("accepts uppercase project and tag ids", () => {
    const result = validateListNotesQuery(
      query({
        project_id: PROJECT_ID.toUpperCase(),
        tag_id: TAG_ID.toUpperCase(),
      }),
    );

    expect(result.project_id).toBe(PROJECT_ID.toUpperCase());
    expect(result.tag_id).toBe(TAG_ID.toUpperCase());
  });

  it.each(["", "not-a-uuid", "22222222222222222222222222222222"])(
    "rejects the malformed project_id %j",
    (project_id) => {
      const error = captureApiError(() =>
        validateListNotesQuery(query({ project_id })),
      );

      expect(error.details).toEqual([
        { field: "project_id", message: "Must be a valid UUID" },
      ]);
    },
  );

  it.each(["", "not-a-uuid", "33333333333333333333333333333333"])(
    "rejects the malformed tag_id %j",
    (tag_id) => {
      const error = captureApiError(() =>
        validateListNotesQuery(query({ tag_id })),
      );

      expect(error.details).toEqual([
        { field: "tag_id", message: "Must be a valid UUID" },
      ]);
    },
  );

  it("caps perPage at the maximum", () => {
    expect(validateListNotesQuery(query({ perPage: "1000" })).perPage).toBe(
      100,
    );
  });

  it.each(["0", "-1", "1.5", "abc", "", "9007199254740993"])(
    "rejects the invalid page %j",
    (page) => {
      const error = captureApiError(() =>
        validateListNotesQuery(query({ page })),
      );

      expect(error.details).toEqual([
        { field: "page", message: "Must be a positive integer" },
      ]);
    },
  );

  it.each(["0", "-5", "2.5", "abc", ""])(
    "rejects the invalid perPage %j",
    (perPage) => {
      const error = captureApiError(() =>
        validateListNotesQuery(query({ perPage })),
      );

      expect(error.details).toEqual([
        { field: "perPage", message: "Must be a positive integer" },
      ]);
    },
  );

  it.each(["created_at", "updated_at", "title"])(
    "accepts the supported sort field %j",
    (sort) => {
      expect(validateListNotesQuery(query({ sort })).sort).toBe(sort);
    },
  );

  it("rejects unsupported sort fields", () => {
    const error = captureApiError(() =>
      validateListNotesQuery(query({ sort: "name" })),
    );

    expect(error.details).toEqual([
      {
        field: "sort",
        message: "Must be one of: created_at, updated_at, title",
      },
    ]);
  });

  it.each(["descending", "DESC", "sideways"])(
    "rejects the unsupported order %j",
    (order) => {
      const error = captureApiError(() =>
        validateListNotesQuery(query({ order })),
      );

      expect(error.details).toEqual([
        { field: "order", message: "Must be one of: asc, desc" },
      ]);
    },
  );

  it("reports every invalid query parameter at once", () => {
    const error = captureApiError(() =>
      validateListNotesQuery(
        query({
          page: "0",
          perPage: "abc",
          project_id: "nope",
          tag_id: "nope",
          sort: "name",
          order: "sideways",
        }),
      ),
    );

    expect(error.details).toEqual([
      { field: "page", message: "Must be a positive integer" },
      { field: "perPage", message: "Must be a positive integer" },
      { field: "project_id", message: "Must be a valid UUID" },
      { field: "tag_id", message: "Must be a valid UUID" },
      {
        field: "sort",
        message: "Must be one of: created_at, updated_at, title",
      },
      { field: "order", message: "Must be one of: asc, desc" },
    ]);
  });
});
