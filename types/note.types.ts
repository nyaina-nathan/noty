export interface Note {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  created_at: Date | null;
  updated_at: Date | null;
}

export interface NoteMark {
  type: string;
  attrs?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface NoteNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: NoteNode[];
  marks?: NoteMark[];
  text?: string;
  [key: string]: unknown;
}

export interface NoteDocument {
  type: "doc";
  content: NoteNode[];
  [key: string]: unknown;
}

export interface NoteDetail extends Note {
  content: NoteDocument;
}

export interface CreateNoteInput {
  title: string;
  description: string | null;
  project_id: string | null;
  content: NoteDocument;
}

export interface UpdateNoteInput {
  title?: string;
  description?: string | null;
  project_id?: string | null;
  content?: NoteDocument;
}

export type NoteSortField = "created_at" | "updated_at" | "title";

export interface ListNotesQuery {
  page: number;
  perPage: number;
  search: string | null;
  project_id: string | null;
  tag_id: string | null;
  sort: NoteSortField;
  order: "asc" | "desc";
}
