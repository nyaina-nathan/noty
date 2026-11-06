import type { NoteDocument, NoteNode } from "@/types/note.types";

export const EMPTY_NOTE_DOCUMENT: NoteDocument = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

/**
 * Block nodes that own a line in the plain-text projection. Container nodes
 * such as lists and blockquotes are traversed so each nested paragraph becomes
 * its own line.
 */
const LINE_NODE_TYPES = new Set(["paragraph", "heading", "codeBlock"]);

function inlineText(node: NoteNode): string {
  if (node.type === "text") {
    return node.text ?? "";
  }

  if (node.type === "hardBreak") {
    return "\n";
  }

  return (node.content ?? []).map(inlineText).join("");
}

function collectLines(node: NoteNode, lines: string[]): void {
  if (LINE_NODE_TYPES.has(node.type)) {
    lines.push(inlineText(node));
    return;
  }

  if (node.type === "text") {
    lines.push(node.text ?? "");
    return;
  }

  if (node.type === "hardBreak") {
    lines.push("");
    return;
  }

  for (const child of node.content ?? []) {
    collectLines(child, lines);
  }
}

/**
 * Derives the text used for note search. Text nodes are concatenated inline and
 * each block becomes one line, matching the shape produced by the database
 * migration that split section content on newlines.
 */
export function noteDocumentToText(document: NoteDocument): string {
  const lines: string[] = [];

  for (const node of document.content) {
    collectLines(node, lines);
  }

  return lines.join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Compares documents structurally. PostgreSQL `jsonb` reorders object keys, so
 * a plain `JSON.stringify` comparison would report a change after every save.
 */
export function noteDocumentsEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => noteDocumentsEqual(value, right[index]))
    );
  }

  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left);

    if (leftKeys.length !== Object.keys(right).length) {
      return false;
    }

    return leftKeys.every(
      (key) =>
        Object.hasOwn(right, key) && noteDocumentsEqual(left[key], right[key]),
    );
  }

  return false;
}
