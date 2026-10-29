import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  validateCreateNoteSectionInput,
  validateListNoteSectionsQuery,
  validateReorderNoteSectionsInput,
  validateSectionId,
  validateUpdateNoteSectionInput,
} from "@/validators/note-section.validators";

const SECTION_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_SECTION_ID = "22222222-2222-2222-2222-222222222222";

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

describe("validateCreateNoteSectionInput", () => {
  it("defaults the content to null and leaves note_order unset", () => {
    expect(validateCreateNoteSectionInput({})).toEqual({
      content: null,
      note_order: undefined,
    });
  });

  it("accepts content and an explicit note_order", () => {
    expect(
      validateCreateNoteSectionInput({ content: "Milk", note_order: 3 }),
    ).toEqual({ content: "Milk", note_order: 3 });
  });

  it("accepts null and empty content", () => {
    expect(validateCreateNoteSectionInput({ content: null })).toMatchObject({
      content: null,
    });
    expect(validateCreateNoteSectionInput({ content: "" })).toMatchObject({
      content: "",
    });
  });

  it.each([42, true, [], {}])(
    "rejects the non-string content %j",
    (content) => {
      const error = captureApiError(() =>
        validateCreateNoteSectionInput({ content }),
      );

      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details).toEqual([
        { field: "content", message: "Must be a string or null" },
      ]);
    },
  );

  it.each([0, -1, 1.5, "2", null, true, {}])(
    "rejects the invalid note_order %j",
    (note_order) => {
      const error = captureApiError(() =>
        validateCreateNoteSectionInput({ note_order }),
      );

      expect(error.details).toEqual([
        { field: "note_order", message: "Must be a positive integer" },
      ]);
    },
  );

  it("rejects unknown fields", () => {
    const error = captureApiError(() =>
      validateCreateNoteSectionInput({
        content: "Milk",
        note_id: SECTION_ID,
      }),
    );

    expect(error.details).toEqual([
      { field: "note_id", message: "Unknown field" },
    ]);
  });

  it("reports multiple problems at once", () => {
    const error = captureApiError(() =>
      validateCreateNoteSectionInput({
        content: 42,
        note_order: 0,
        extra: true,
      }),
    );

    expect(error.details).toEqual([
      { field: "extra", message: "Unknown field" },
      { field: "content", message: "Must be a string or null" },
      { field: "note_order", message: "Must be a positive integer" },
    ]);
  });

  it.each([null, [], "Milk", 42, true])(
    "rejects the non-object body %j",
    (body) => {
      const error = captureApiError(() =>
        validateCreateNoteSectionInput(body),
      );

      expect(error.details).toEqual([
        { message: "Request body must be a JSON object" },
      ]);
    },
  );
});

describe("validateUpdateNoteSectionInput", () => {
  it("accepts content only", () => {
    expect(validateUpdateNoteSectionInput({ content: "Milk" })).toEqual({
      content: "Milk",
    });
  });

  it("accepts null to clear the content", () => {
    expect(validateUpdateNoteSectionInput({ content: null })).toEqual({
      content: null,
    });
  });

  it("accepts note_order only", () => {
    expect(validateUpdateNoteSectionInput({ note_order: 4 })).toEqual({
      note_order: 4,
    });
  });

  it("accepts both fields", () => {
    expect(
      validateUpdateNoteSectionInput({ content: "Milk", note_order: 2 }),
    ).toEqual({ content: "Milk", note_order: 2 });
  });

  it("rejects an empty body", () => {
    const error = captureApiError(() =>
      validateUpdateNoteSectionInput({}),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { message: "At least one field is required" },
    ]);
  });

  it("rejects unknown fields and reports the empty body", () => {
    const error = captureApiError(() =>
      validateUpdateNoteSectionInput({ section_id: SECTION_ID }),
    );

    expect(error.details).toEqual([
      { field: "section_id", message: "Unknown field" },
      { message: "At least one field is required" },
    ]);
  });

  it.each([42, true, [], {}])(
    "rejects the non-string content %j",
    (content) => {
      const error = captureApiError(() =>
        validateUpdateNoteSectionInput({ content }),
      );

      expect(error.details).toEqual([
        { field: "content", message: "Must be a string or null" },
      ]);
    },
  );

  it.each([0, -1, 1.5, "2", null, true])(
    "rejects the invalid note_order %j",
    (note_order) => {
      const error = captureApiError(() =>
        validateUpdateNoteSectionInput({ note_order }),
      );

      expect(error.details).toEqual([
        { field: "note_order", message: "Must be a positive integer" },
      ]);
    },
  );
});

describe("validateSectionId", () => {
  it("returns a valid UUID unchanged", () => {
    expect(validateSectionId(SECTION_ID)).toBe(SECTION_ID);
  });

  it("accepts uppercase UUIDs", () => {
    const uppercaseId = SECTION_ID.toUpperCase();

    expect(validateSectionId(uppercaseId)).toBe(uppercaseId);
  });

  it.each([
    "",
    "not-a-uuid",
    `${SECTION_ID}-extra`,
    `{${SECTION_ID}}`,
    "11111111111111111111111111111111",
  ])("rejects the malformed id %j", (sectionId) => {
    const error = captureApiError(() => validateSectionId(sectionId));

    expect(error.code).toBe("NOT_FOUND");
    expect(error.status).toBe(404);
    expect(error.message).toBe("Note section not found");
  });
});

describe("validateReorderNoteSectionsInput", () => {
  it("accepts a list of section ids", () => {
    expect(
      validateReorderNoteSectionsInput({
        sectionIds: [OTHER_SECTION_ID, SECTION_ID],
      }),
    ).toEqual({ sectionIds: [OTHER_SECTION_ID, SECTION_ID] });
  });

  it("accepts a single section id", () => {
    expect(
      validateReorderNoteSectionsInput({ sectionIds: [SECTION_ID] }),
    ).toEqual({ sectionIds: [SECTION_ID] });
  });

  it("rejects a missing sectionIds field", () => {
    const error = captureApiError(() =>
      validateReorderNoteSectionsInput({}),
    );

    expect(error.details).toEqual([
      { field: "sectionIds", message: "Is required" },
    ]);
  });

  it.each(["nope", 42, true, {}, null])(
    "rejects the non-array sectionIds %j",
    (sectionIds) => {
      const error = captureApiError(() =>
        validateReorderNoteSectionsInput({ sectionIds }),
      );

      expect(error.details).toEqual([
        { field: "sectionIds", message: "Must be an array" },
      ]);
    },
  );

  it("rejects an empty sectionIds array", () => {
    const error = captureApiError(() =>
      validateReorderNoteSectionsInput({ sectionIds: [] }),
    );

    expect(error.details).toEqual([
      { field: "sectionIds", message: "Must not be empty" },
    ]);
  });

  it("rejects malformed ids and reports their index", () => {
    const error = captureApiError(() =>
      validateReorderNoteSectionsInput({
        sectionIds: [SECTION_ID, "not-a-uuid"],
      }),
    );

    expect(error.details).toEqual([
      { field: "sectionIds[1]", message: "Must be a valid UUID" },
    ]);
  });

  it.each([42, null, true, {}])(
    "rejects the non-string id %j",
    (sectionId) => {
      const error = captureApiError(() =>
        validateReorderNoteSectionsInput({ sectionIds: [sectionId] }),
      );

      expect(error.details).toEqual([
        { field: "sectionIds[0]", message: "Must be a valid UUID" },
      ]);
    },
  );

  it("rejects duplicate ids case-insensitively", () => {
    const error = captureApiError(() =>
      validateReorderNoteSectionsInput({
        sectionIds: [SECTION_ID, SECTION_ID.toUpperCase()],
      }),
    );

    expect(error.details).toEqual([
      { field: "sectionIds[1]", message: "Must not contain duplicates" },
    ]);
  });

  it("rejects unknown fields", () => {
    const error = captureApiError(() =>
      validateReorderNoteSectionsInput({
        sectionIds: [SECTION_ID],
        note_id: SECTION_ID,
      }),
    );

    expect(error.details).toEqual([
      { field: "note_id", message: "Unknown field" },
    ]);
  });

  it("reports multiple problems at once", () => {
    const error = captureApiError(() =>
      validateReorderNoteSectionsInput({
        sectionIds: ["nope", SECTION_ID, SECTION_ID],
        extra: true,
      }),
    );

    expect(error.details).toEqual([
      { field: "extra", message: "Unknown field" },
      { field: "sectionIds[0]", message: "Must be a valid UUID" },
      { field: "sectionIds[2]", message: "Must not contain duplicates" },
    ]);
  });

  it.each([null, [], "nope", 42])(
    "rejects the non-object body %j",
    (body) => {
      const error = captureApiError(() =>
        validateReorderNoteSectionsInput(body),
      );

      expect(error.details).toEqual([
        { message: "Request body must be a JSON object" },
      ]);
    },
  );
});

describe("validateListNoteSectionsQuery", () => {
  it("defaults to ascending order", () => {
    expect(validateListNoteSectionsQuery(query())).toEqual({ order: "asc" });
  });

  it.each(["asc", "desc"])("accepts the order %j", (order) => {
    expect(validateListNoteSectionsQuery(query({ order })).order).toBe(order);
  });

  it.each(["ascending", "DESC", "sideways", ""])(
    "rejects the unsupported order %j",
    (order) => {
      const error = captureApiError(() =>
        validateListNoteSectionsQuery(query({ order })),
      );

      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details).toEqual([
        { field: "order", message: "Must be one of: asc, desc" },
      ]);
    },
  );
});
