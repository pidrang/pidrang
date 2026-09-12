export interface GetOneParams {
  id: string;
}

export interface CreateParams<T> {
  data: Partial<T>;
}

export interface UpdateParams<T> {
  id: string;
  data: Partial<T>;
}

export interface DeleteParams {
  id: string;
}
