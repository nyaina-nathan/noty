import { describe, expect, it } from "vitest";
import {
  EMPTY_NOTE_DOCUMENT,
  noteDocumentsEqual,
  noteDocumentToText,
} from "@/lib/note-content";
import type { NoteDocument } from "@/types/note.types";

function doc(content: NoteDocument["content"]): NoteDocument {
  return { type: "doc", content };
}

describe("noteDocumentToText", () => {
  it("returns an empty string for the empty document", () => {
    expect(noteDocumentToText(EMPTY_NOTE_DOCUMENT)).toBe("");
  });

  it("concatenates inline text nodes", () => {
    expect(
      noteDocumentToText(
        doc([
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Hello " },
              {
                type: "text",
                text: "world",
                marks: [{ type: "bold" }],
              },
            ],
          },
        ]),
      ),
    ).toBe("Hello world");
  });

  it("puts each block on its own line", () => {
    expect(
      noteDocumentToText(
        doc([
          { type: "paragraph", content: [{ type: "text", text: "First" }] },
          { type: "paragraph", content: [{ type: "text", text: "Second" }] },
        ]),
      ),
    ).toBe("First\nSecond");
  });

  it("includes headings", () => {
    expect(
      noteDocumentToText(
        doc([
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Title" }],
          },
          { type: "paragraph", content: [{ type: "text", text: "Body" }] },
        ]),
      ),
    ).toBe("Title\nBody");
  });

  it("flattens list items", () => {
    expect(
      noteDocumentToText(
        doc([
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "One" }],
                  },
                ],
              },
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Two" }],
                  },
                ],
              },
            ],
          },
        ]),
      ),
    ).toBe("One\nTwo");
  });

  it("flattens blockquotes", () => {
    expect(
      noteDocumentToText(
        doc([
          {
            type: "blockquote",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Quoted" }],
              },
            ],
          },
        ]),
      ),
    ).toBe("Quoted");
  });

  it("turns hard breaks into newlines", () => {
    expect(
      noteDocumentToText(
        doc([
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Line 1" },
              { type: "hardBreak" },
              { type: "text", text: "Line 2" },
            ],
          },
        ]),
      ),
    ).toBe("Line 1\nLine 2");
  });

  it("keeps code block newlines", () => {
    expect(
      noteDocumentToText(
        doc([
          {
            type: "codeBlock",
            content: [{ type: "text", text: "const a = 1;\nconst b = 2;" }],
          },
        ]),
      ),
    ).toBe("const a = 1;\nconst b = 2;");
  });

  it("handles root-level text nodes", () => {
    expect(
      noteDocumentToText(doc([{ type: "text", text: "Root" }])),
    ).toBe("Root");
  });

  it("preserves empty paragraphs as blank lines", () => {
    expect(
      noteDocumentToText(
        doc([
          { type: "paragraph" },
          { type: "paragraph", content: [{ type: "text", text: "After" }] },
        ]),
      ),
    ).toBe("\nAfter");
  });
});

describe("noteDocumentsEqual", () => {
  it("matches documents with reordered object keys", () => {
    expect(
      noteDocumentsEqual(
        {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }],
        },
        {
          content: [
            { content: [{ text: "Hi", type: "text" }], type: "paragraph" },
          ],
          type: "doc",
        },
      ),
    ).toBe(true);
  });

  it("detects different text", () => {
    expect(
      noteDocumentsEqual(
        doc([{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }]),
        doc([{ type: "paragraph", content: [{ type: "text", text: "Bye" }] }]),
      ),
    ).toBe(false);
  });

  it("detects different array lengths", () => {
    expect(
      noteDocumentsEqual(
        doc([{ type: "paragraph" }]),
        doc([{ type: "paragraph" }, { type: "paragraph" }]),
      ),
    ).toBe(false);
  });

  it("detects missing keys", () => {
    expect(
      noteDocumentsEqual(
        { type: "doc", content: [] },
        { type: "doc", content: [], extra: true },
      ),
    ).toBe(false);
  });
});
