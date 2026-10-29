export interface Project {
  id: string;
  title: string;
  description: string | null;
  tag_id: string | null;
}

export interface CreateProjectInput {
  title: string;
  description: string | null;
  tag_id: string | null;
}

export interface UpdateProjectInput {
  title?: string;
  description?: string | null;
  tag_id?: string | null;
}

export interface ListProjectsQuery {
  page: number;
  perPage: number;
  search: string | null;
  tag_id: string | null;
  sort: "title";
  order: "asc" | "desc";
}
