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
