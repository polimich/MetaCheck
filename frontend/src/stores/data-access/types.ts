/**
 * Common response type for data access operations
 */
export interface DAResponse<T = unknown> {
  data?: T;
  error?: string;
  success?: boolean;
}
