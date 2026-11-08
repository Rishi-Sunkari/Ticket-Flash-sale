/** Shape of every successful API response (see backend `res.json({ data })`). */
export interface ApiResponse<T> {
  data: T;
}

/** Shape of every error response produced by the backend error middleware. */
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
