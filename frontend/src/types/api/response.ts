// @author Michael Polívka (xpoliv07)
export type ApiResponse<T> = {
  data?: T;
  error?: string;
  success?: boolean;
};
