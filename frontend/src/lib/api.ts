import { useAuthStore } from "../stores/auth.store";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, login } = useAuthStore.getState();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      useAuthStore.getState().logout();
      return null;
    }

    const data = await res.json();
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) {
      useAuthStore.getState().logout();
      return null;
    }
    login({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: currentUser,
    });
    return data.accessToken;
  } catch {
    useAuthStore.getState().logout();
    return null;
  }
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { accessToken, isAuthenticated } = useAuthStore.getState();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (!options.skipAuth && isAuthenticated && accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  let res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  // Token expired — refresh and retry
  if (res.status === 401 && isAuthenticated) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshAccessToken();
    }

    const newToken = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;

    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });
    } else {
      throw new Error("Session expired");
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || error.message || `HTTP ${res.status}`);
  }

  return res.json();
}

// Convenience methods
export const api = {
  get: <T = any>(endpoint: string, options?: FetchOptions) =>
    apiFetch<T>(endpoint, { ...options, method: "GET" }),

  post: <T = any>(endpoint: string, body?: any, options?: FetchOptions) => {
    const isFormData = body instanceof FormData;
    return apiFetch<T>(endpoint, {
      ...options,
      method: "POST",
      body: isFormData ? body : JSON.stringify(body),
      headers: isFormData ? { ...(options?.headers as Record<string, string>) } : undefined,
    });
  },

  patch: <T = any>(endpoint: string, body?: any, options?: FetchOptions) =>
    apiFetch<T>(endpoint, { ...options, method: "PATCH", body: JSON.stringify(body) }),

  delete: <T = any>(endpoint: string, options?: FetchOptions) =>
    apiFetch<T>(endpoint, { ...options, method: "DELETE" }),
};
