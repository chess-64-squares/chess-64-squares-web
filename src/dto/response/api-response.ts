export class ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
  errorCode?: string;
  timeStamp: string;
}
