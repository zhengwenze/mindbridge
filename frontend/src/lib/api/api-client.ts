import axios from "axios";

import { handleUnauthorizedSession } from "@/lib/auth/session";
import { readAuthSession } from "@/lib/auth/token-storage";
import { apiBaseUrl } from "@/lib/config/api";
import { routes } from "@/lib/config/routes";

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 20_000
});

apiClient.interceptors.request.use((config) => {
  const session = readAuthSession();
  if (session?.token && !config.headers.Authorization) {
    config.headers.Authorization = `Basic ${session.token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = axios.isAxiosError(error) ? error.response?.status : null;

    if (typeof window !== "undefined") {
      if (status === 401) {
        handleUnauthorizedSession();
      }

      if (status === 403) {
        window.location.assign(routes.forbidden);
      }
    }

    return Promise.reject(error);
  }
);
