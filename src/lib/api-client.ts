import type { ApiResponse } from "@/types/api";
import { getAccessToken } from "./client-auth";

interface RequestOptions extends RequestInit {
  withAuth?: boolean;
}

export async function apiRequest<T>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  const { withAuth = false, headers, ...rest } = options;
  const authToken = withAuth ? getAccessToken() : null;

  const response = await fetch(url, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...headers,
    },
  });

  const json = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !json.success) {
    const message = "message" in json ? json.message : "Request failed";
    throw new Error(message);
  }

  return json.data;
}
