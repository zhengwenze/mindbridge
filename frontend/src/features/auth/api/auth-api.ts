import { apiClient } from "@/lib/api/api-client";
import { createBasicToken } from "@/lib/auth/token-storage";
import type { AuthSession, UserProfile } from "@/lib/auth/types";

interface LoginParams {
  username: string;
  password: string;
}

export async function loginWithBasicAuth({ username, password }: LoginParams): Promise<AuthSession> {
  const token = createBasicToken(username, password);
  const response = await apiClient.get<UserProfile>("/api/profile", {
    headers: {
      Authorization: `Basic ${token}`
    }
  });

  return {
    token,
    profile: response.data
  };
}

export async function fetchProfile(): Promise<UserProfile> {
  const response = await apiClient.get<UserProfile>("/api/profile");
  return response.data;
}
