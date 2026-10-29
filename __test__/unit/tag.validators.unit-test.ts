import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  validateCreateTagInput,
  validateListTagsQuery,
  validateTagId,
  validateUpdateTagInput,
} from "@/validators/tag.validators";

const TAG_ID = "11111111-1111-1111-1111-111111111111";
const NAME_MAX_LENGTH = 255;

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

describe("validateCreateTagInput", () => {
  it("accepts a name and trims surrounding whitespace", () => {
    expect(validateCreateTagInput({ name: "  Work  " })).toEqual({
      name: "Work",
    });
  });

  it("accepts a name with exactly the maximum length", () => {
    const name = "a".repeat(NAME_MAX_LENGTH);

    expect(validateCreateTagInput({ name })).toEqual({ name });
  });

  it("rejects a missing name", () => {
    const error = captureApiError(() => validateCreateTagInput({}));

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.status).toBe(422);
    expect(error.details).toEqual([{ field: "name", message: "Is required" }]);
  });

  it.each(["", "   ", "\t\n"])("rejects the blank name %j", (name) => {
    const error = captureApiError(() => validateCreateTagInput({ name }));

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { field: "name", message: "Must not be empty" },
    ]);
  });

  it.each([null, 42, true, [], {}])(
    "rejects the non-string name %j",
    (name) => {
      const error = captureApiError(() => validateCreateTagInput({ name }));

      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details).toEqual([
        { field: "name", message: "Must be a string" },
      ]);
    },
  );

  it("rejects a name longer than the maximum length", () => {
    const error = captureApiError(() =>
      validateCreateTagInput({ name: "a".repeat(NAME_MAX_LENGTH + 1) }),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      {
        field: "name",
        message: `Must be at most ${NAME_MAX_LENGTH} characters`,
      },
    ]);
  });

  it("rejects unknown fields", () => {
    const error = captureApiError(() =>
      validateCreateTagInput({ name: "Work", user_id: TAG_ID }),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([{ field: "user_id", message: "Unknown field" }]);
  });

  it("reports multiple problems at once", () => {
    const error = captureApiError(() =>
      validateCreateTagInput({ name: "", extra: true }),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { field: "extra", message: "Unknown field" },
      { field: "name", message: "Must not be empty" },
    ]);
  });

  it.each([null, [], "Work", 42, true])(
    "rejects the non-object body %j",
    (body) => {
      const error = captureApiError(() => validateCreateTagInput(body));

      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details).toEqual([
        { message: "Request body must be a JSON object" },
      ]);
    },
  );
});

describe("validateUpdateTagInput", () => {
  it("applies the same rules as creating a tag", () => {
    expect(validateUpdateTagInput({ name: "  Personal  " })).toEqual({
      name: "Personal",
    });

    const error = captureApiError(() => validateUpdateTagInput({}));

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([{ field: "name", message: "Is required" }]);
  });
});

describe("validateTagId", () => {
  it("returns a valid UUID unchanged", () => {
    expect(validateTagId(TAG_ID)).toBe(TAG_ID);
  });

  it("accepts uppercase UUIDs", () => {
    const uppercaseId = TAG_ID.toUpperCase();

    expect(validateTagId(uppercaseId)).toBe(uppercaseId);
  });

  it.each([
    "",
    "not-a-uuid",
    `${TAG_ID}-extra`,
    `{${TAG_ID}}`,
    "11111111111111111111111111111111",
  ])("rejects the malformed id %j", (tagId) => {
    const error = captureApiError(() => validateTagId(tagId));

    expect(error.code).toBe("NOT_FOUND");
    expect(error.status).toBe(404);
    expect(error.message).toBe("Tag not found");
  });
});

describe("validateListTagsQuery", () => {
  it("applies the default pagination and sorting", () => {
    expect(validateListTagsQuery(query())).toEqual({
      page: 1,
      perPage: 20,
      search: null,
      sort: "name",
      order: "asc",
    });
  });

  it("parses explicit query parameters", () => {
    expect(
      validateListTagsQuery(
        query({
          page: "3",
          perPage: "15",
          search: "  Work  ",
          sort: "name",
          order: "desc",
        }),
      ),
    ).toEqual({
      page: 3,
      perPage: 15,
      search: "Work",
      sort: "name",
      order: "desc",
    });
  });

  it.each(["", "   ", "\t"])(
    "treats the blank search %j as no filter",
    (search) => {
      expect(validateListTagsQuery(query({ search })).search).toBeNull();
    },
  );

  it("accepts a search at the maximum length", () => {
    const search = "a".repeat(NAME_MAX_LENGTH);

    expect(validateListTagsQuery(query({ search })).search).toBe(search);
  });

  it("rejects a search longer than the maximum length", () => {
    const error = captureApiError(() =>
      validateListTagsQuery(
        query({ search: "a".repeat(NAME_MAX_LENGTH + 1) }),
      ),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      {
        field: "search",
        message: `Must be at most ${NAME_MAX_LENGTH} characters`,
      },
    ]);
  });

  it("caps perPage at the maximum", () => {
    expect(validateListTagsQuery(query({ perPage: "1000" })).perPage).toBe(100);
  });

  it.each(["0", "-1", "1.5", "abc", "", "9007199254740993"])(
    "rejects the invalid page %j",
    (page) => {
      const error = captureApiError(() =>
        validateListTagsQuery(query({ page })),
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
        validateListTagsQuery(query({ perPage })),
      );

      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details).toEqual([
        { field: "perPage", message: "Must be a positive integer" },
      ]);
    },
  );

  it("rejects unsupported sort fields", () => {
    const error = captureApiError(() =>
      validateListTagsQuery(query({ sort: "created_at" })),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { field: "sort", message: "Must be one of: name" },
    ]);
  });

  it.each(["descending", "DESC", "sideways"])(
    "rejects the unsupported order %j",
    (order) => {
      const error = captureApiError(() =>
        validateListTagsQuery(query({ order })),
      );

      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details).toEqual([
        { field: "order", message: "Must be one of: asc, desc" },
      ]);
    },
  );

  it("reports every invalid query parameter at once", () => {
    const error = captureApiError(() =>
      validateListTagsQuery(
        query({
          page: "0",
          perPage: "abc",
          sort: "created_at",
          order: "sideways",
        }),
      ),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { field: "page", message: "Must be a positive integer" },
      { field: "perPage", message: "Must be a positive integer" },
      { field: "sort", message: "Must be one of: name" },
      { field: "order", message: "Must be one of: asc, desc" },
    ]);
  });
});
