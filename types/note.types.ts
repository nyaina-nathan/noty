export interface Note {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  created_at: Date | null;
  updated_at: Date | null;
}

export interface NoteSection {
  id: string;
  note_id: string;
  note_order: number | null;
  content: string | null;
  created_at: Date | null;
  updated_at: Date | null;
}

export interface NoteDetail extends Note {
  sections: NoteSection[];
}

export interface NoteSectionInput {
  content: string | null;
  note_order?: number;
}

export interface CreateNoteInput {
  title: string;
  description: string | null;
  project_id: string | null;
  sections: NoteSectionInput[];
}

export interface UpdateNoteInput {
  title?: string;
  description?: string | null;
  project_id?: string | null;
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
