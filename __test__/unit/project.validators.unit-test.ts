import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  validateCreateProjectInput,
  validateListProjectsQuery,
  validateProjectId,
  validateUpdateProjectInput,
} from "@/validators/project.validators";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const TAG_ID = "22222222-2222-2222-2222-222222222222";
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

describe("validateCreateProjectInput", () => {
  it("accepts a title and defaults the optional fields to null", () => {
    expect(validateCreateProjectInput({ title: "  Roadmap  " })).toEqual({
      title: "Roadmap",
      description: null,
      tag_id: null,
    });
  });

  it("accepts description and tag_id", () => {
    expect(
      validateCreateProjectInput({
        title: "Roadmap",
        description: "Quarterly plan",
        tag_id: TAG_ID,
      }),
    ).toEqual({
      title: "Roadmap",
      description: "Quarterly plan",
      tag_id: TAG_ID,
    });
  });

  it("accepts explicit null description and tag_id", () => {
    expect(
      validateCreateProjectInput({
        title: "Roadmap",
        description: null,
        tag_id: null,
      }),
    ).toEqual({ title: "Roadmap", description: null, tag_id: null });
  });

  it("accepts an empty description", () => {
    expect(
      validateCreateProjectInput({ title: "Roadmap", description: "" }),
    ).toEqual({ title: "Roadmap", description: "", tag_id: null });
  });

  it("accepts a title with exactly the maximum length", () => {
    const title = "a".repeat(TITLE_MAX_LENGTH);

    expect(validateCreateProjectInput({ title })).toEqual({
      title,
      description: null,
      tag_id: null,
    });
  });

  it("rejects a missing title", () => {
    const error = captureApiError(() => validateCreateProjectInput({}));

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.status).toBe(422);
    expect(error.details).toEqual([{ field: "title", message: "Is required" }]);
  });

  it.each(["", "   ", "\t\n"])("rejects the blank title %j", (title) => {
    const error = captureApiError(() =>
      validateCreateProjectInput({ title }),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { field: "title", message: "Must not be empty" },
    ]);
  });

  it.each([null, 42, true, [], {}])(
    "rejects the non-string title %j",
    (title) => {
      const error = captureApiError(() =>
        validateCreateProjectInput({ title }),
      );

      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details).toEqual([
        { field: "title", message: "Must be a string" },
      ]);
    },
  );

  it("rejects a title longer than the maximum length", () => {
    const error = captureApiError(() =>
      validateCreateProjectInput({ title: "a".repeat(TITLE_MAX_LENGTH + 1) }),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
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
        validateCreateProjectInput({ title: "Roadmap", description }),
      );

      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details).toEqual([
        { field: "description", message: "Must be a string or null" },
      ]);
    },
  );

  it.each([42, true, [], {}])(
    "rejects the non-string tag_id %j",
    (tag_id) => {
      const error = captureApiError(() =>
        validateCreateProjectInput({ title: "Roadmap", tag_id }),
      );

      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details).toEqual([
        { field: "tag_id", message: "Must be a string or null" },
      ]);
    },
  );

  it.each(["", "not-a-uuid", `${TAG_ID}-extra`, "22222222222222222222222222222222"])(
    "rejects the malformed tag_id %j",
    (tag_id) => {
      const error = captureApiError(() =>
        validateCreateProjectInput({ title: "Roadmap", tag_id }),
      );

      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details).toEqual([
        { field: "tag_id", message: "Must be a valid UUID" },
      ]);
    },
  );

  it("rejects unknown fields", () => {
    const error = captureApiError(() =>
      validateCreateProjectInput({ title: "Roadmap", user_id: PROJECT_ID }),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { field: "user_id", message: "Unknown field" },
    ]);
  });

  it("reports multiple problems at once", () => {
    const error = captureApiError(() =>
      validateCreateProjectInput({
        title: "",
        description: 42,
        tag_id: "nope",
        extra: true,
      }),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { field: "extra", message: "Unknown field" },
      { field: "title", message: "Must not be empty" },
      { field: "description", message: "Must be a string or null" },
      { field: "tag_id", message: "Must be a valid UUID" },
    ]);
  });

  it.each([null, [], "Roadmap", 42, true])(
    "rejects the non-object body %j",
    (body) => {
      const error = captureApiError(() => validateCreateProjectInput(body));

      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details).toEqual([
        { message: "Request body must be a JSON object" },
      ]);
    },
  );
});

describe("validateUpdateProjectInput", () => {
  it("accepts a title only", () => {
    expect(validateUpdateProjectInput({ title: "  Roadmap  " })).toEqual({
      title: "Roadmap",
    });
  });

  it("accepts a description only", () => {
    expect(validateUpdateProjectInput({ description: "Plan" })).toEqual({
      description: "Plan",
    });
  });

  it("accepts null to clear the description", () => {
    expect(validateUpdateProjectInput({ description: null })).toEqual({
      description: null,
    });
  });

  it("accepts a tag id to attach a tag", () => {
    expect(validateUpdateProjectInput({ tag_id: TAG_ID })).toEqual({
      tag_id: TAG_ID,
    });
  });

  it("accepts null to detach the tag", () => {
    expect(validateUpdateProjectInput({ tag_id: null })).toEqual({
      tag_id: null,
    });
  });

  it("accepts multiple fields", () => {
    expect(
      validateUpdateProjectInput({
        title: "Personal",
        description: null,
        tag_id: null,
      }),
    ).toEqual({ title: "Personal", description: null, tag_id: null });
  });

  it("rejects an empty body", () => {
    const error = captureApiError(() => validateUpdateProjectInput({}));

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { message: "At least one field is required" },
    ]);
  });

  it("rejects an unknown field and reports the empty body", () => {
    const error = captureApiError(() =>
      validateUpdateProjectInput({ user_id: PROJECT_ID }),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { field: "user_id", message: "Unknown field" },
      { message: "At least one field is required" },
    ]);
  });

  it("rejects a null title", () => {
    const error = captureApiError(() =>
      validateUpdateProjectInput({ title: null }),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { field: "title", message: "Must be a string" },
    ]);
  });

  it("rejects a blank title", () => {
    const error = captureApiError(() =>
      validateUpdateProjectInput({ title: "   " }),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { field: "title", message: "Must not be empty" },
    ]);
  });

  it("rejects a title longer than the maximum length", () => {
    const error = captureApiError(() =>
      validateUpdateProjectInput({ title: "a".repeat(TITLE_MAX_LENGTH + 1) }),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      {
        field: "title",
        message: `Must be at most ${TITLE_MAX_LENGTH} characters`,
      },
    ]);
  });

  it("rejects an invalid description alongside a valid title", () => {
    const error = captureApiError(() =>
      validateUpdateProjectInput({ title: "Roadmap", description: 42 }),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { field: "description", message: "Must be a string or null" },
    ]);
  });

  it("rejects an invalid tag id alongside a valid title", () => {
    const error = captureApiError(() =>
      validateUpdateProjectInput({ title: "Roadmap", tag_id: "nope" }),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { field: "tag_id", message: "Must be a valid UUID" },
    ]);
  });
});

describe("validateProjectId", () => {
  it("returns a valid UUID unchanged", () => {
    expect(validateProjectId(PROJECT_ID)).toBe(PROJECT_ID);
  });

  it("accepts uppercase UUIDs", () => {
    const uppercaseId = PROJECT_ID.toUpperCase();

    expect(validateProjectId(uppercaseId)).toBe(uppercaseId);
  });

  it.each([
    "",
    "not-a-uuid",
    `${PROJECT_ID}-extra`,
    `{${PROJECT_ID}}`,
    "11111111111111111111111111111111",
  ])("rejects the malformed id %j", (projectId) => {
    const error = captureApiError(() => validateProjectId(projectId));

    expect(error.code).toBe("NOT_FOUND");
    expect(error.status).toBe(404);
    expect(error.message).toBe("Project not found");
  });
});

describe("validateListProjectsQuery", () => {
  it("applies the default pagination and sorting", () => {
    expect(validateListProjectsQuery(query())).toEqual({
      page: 1,
      perPage: 20,
      search: null,
      tag_id: null,
      sort: "title",
      order: "asc",
    });
  });

  it("parses explicit query parameters", () => {
    expect(
      validateListProjectsQuery(
        query({
          page: "3",
          perPage: "15",
          search: "  Roadmap  ",
          tag_id: TAG_ID,
          sort: "title",
          order: "desc",
        }),
      ),
    ).toEqual({
      page: 3,
      perPage: 15,
      search: "Roadmap",
      tag_id: TAG_ID,
      sort: "title",
      order: "desc",
    });
  });

  it.each(["", "   ", "\t"])(
    "treats the blank search %j as no filter",
    (search) => {
      expect(validateListProjectsQuery(query({ search })).search).toBeNull();
    },
  );

  it("accepts a search at the maximum length", () => {
    const search = "a".repeat(TITLE_MAX_LENGTH);

    expect(validateListProjectsQuery(query({ search })).search).toBe(search);
  });

  it("rejects a search longer than the maximum length", () => {
    const error = captureApiError(() =>
      validateListProjectsQuery(
        query({ search: "a".repeat(TITLE_MAX_LENGTH + 1) }),
      ),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      {
        field: "search",
        message: `Must be at most ${TITLE_MAX_LENGTH} characters`,
      },
    ]);
  });

  it("accepts an uppercase tag id", () => {
    const uppercaseId = TAG_ID.toUpperCase();

    expect(validateListProjectsQuery(query({ tag_id: uppercaseId })).tag_id).toBe(
      uppercaseId,
    );
  });

  it.each(["", "not-a-uuid", "22222222222222222222222222222222"])(
    "rejects the malformed tag_id %j",
    (tag_id) => {
      const error = captureApiError(() =>
        validateListProjectsQuery(query({ tag_id })),
      );

      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details).toEqual([
        { field: "tag_id", message: "Must be a valid UUID" },
      ]);
    },
  );

  it("caps perPage at the maximum", () => {
    expect(validateListProjectsQuery(query({ perPage: "1000" })).perPage).toBe(
      100,
    );
  });

  it.each(["0", "-1", "1.5", "abc", "", "9007199254740993"])(
    "rejects the invalid page %j",
    (page) => {
      const error = captureApiError(() =>
        validateListProjectsQuery(query({ page })),
      );

      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details).toEqual([
        { field: "page", message: "Must be a positive integer" },
      ]);
    },
  );

  it.each(["0", "-5", "2.5", "abc", ""])(
    "rejects the invalid perPage %j",
    (perPage) => {
      const error = captureApiError(() =>
        validateListProjectsQuery(query({ perPage })),
      );

      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details).toEqual([
        { field: "perPage", message: "Must be a positive integer" },
      ]);
    },
  );

  it("rejects unsupported sort fields", () => {
    const error = captureApiError(() =>
      validateListProjectsQuery(query({ sort: "created_at" })),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { field: "sort", message: "Must be one of: title" },
    ]);
  });

  it.each(["descending", "DESC", "sideways"])(
    "rejects the unsupported order %j",
    (order) => {
      const error = captureApiError(() =>
        validateListProjectsQuery(query({ order })),
      );

      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details).toEqual([
        { field: "order", message: "Must be one of: asc, desc" },
      ]);
    },
  );

  it("reports every invalid query parameter at once", () => {
    const error = captureApiError(() =>
      validateListProjectsQuery(
        query({
          page: "0",
          perPage: "abc",
          tag_id: "nope",
          sort: "created_at",
          order: "sideways",
        }),
      ),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { field: "page", message: "Must be a positive integer" },
      { field: "perPage", message: "Must be a positive integer" },
      { field: "tag_id", message: "Must be a valid UUID" },
      { field: "sort", message: "Must be one of: title" },
      { field: "order", message: "Must be one of: asc, desc" },
    ]);
  });
});
