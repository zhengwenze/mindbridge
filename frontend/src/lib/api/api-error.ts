import { AxiosError } from "axios";

export interface ApiError {
  status: number | null;
  message: string;
  details: unknown;
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof AxiosError) {
    const details = error.response?.data;
    const message =
      typeof details === "string"
        ? details
        : typeof details === "object" && details !== null && "detail" in details
          ? typeof details.detail === "object" && details.detail !== null && "message" in details.detail
            ? String(details.detail.message)
            : String(details.detail)
          : error.message;

    return {
      status: error.response?.status ?? null,
      message,
      details
    };
  }

  if (error instanceof Error) {
    return {
      status: null,
      message: error.message,
      details: null
    };
  }

  return {
    status: null,
    message: "未知错误",
    details: error
  };
}
