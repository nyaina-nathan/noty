export interface CreateNoteSectionInput {
  content: string | null;
  note_order?: number;
}

export interface UpdateNoteSectionInput {
  content?: string | null;
  note_order?: number;
}

export interface ReorderNoteSectionsInput {
  sectionIds: string[];
}

export interface ListNoteSectionsQuery {
  order: "asc" | "desc";
}
