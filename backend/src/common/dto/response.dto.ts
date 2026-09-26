export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  meta?: ApiMeta;
}

export interface ApiError {
  success: false;
  message: string;
  error?: string;
  statusCode?: number;
  path?: string;
  timestamp?: string;
}

