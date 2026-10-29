export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPage: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}
