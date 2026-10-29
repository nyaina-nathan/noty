export interface Tag {
  id: string;
  name: string;
}

export interface CreateTagInput {
  name: string;
}

export interface UpdateTagInput {
  name: string;
}

export interface ListTagsQuery {
  page: number;
  perPage: number;
  search: string | null;
  sort: "name";
  order: "asc" | "desc";
}
