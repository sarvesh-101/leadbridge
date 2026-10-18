import { useAuthStore } from "../stores/auth.store";

// Harden against env misconfiguration (2026-09-29 prod incident: env var was
// set without the /api/v1 suffix → every API call 404'd → "Not Found" on all
// auth screens). Normalize whatever we're given to always end in /api/v1.
const RAW_API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/+$/, "");
const API_BASE = /\/api\/v1$/.test(RAW_API_BASE) ? RAW_API_BASE : `${RAW_API_BASE}/api/v1`;

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

/**
 * User-initiated logout: best-effort revoke the refresh token server-side
 * (single-use rotation + denylist), then clear local auth state immediately.
 * Fire-and-forget — logout must never block on the network.
 *
 * FIX (2026-10-18): the route has `preHandler: fastify.authenticate`, so the
 * Authorization header is REQUIRED. Without it the server returned 401
 * "Missing or invalid authorization header" and the refresh token was never
 * revoked — leaving a replayable session behind a "successful" logout.
 */
export function serverLogout(): void {
  const { accessToken, refreshToken, logout } = useAuthStore.getState();
  if (refreshToken) {
    fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {});
  }
  logout();
  // Send the user to the login screen. A hard navigation also guarantees a
  // clean slate for any stale in-memory state (websocket fallback buffers,
  // polling timers, module-level caches) — previously the broker stayed
  // stranded on a /dashboard page whose every API call errored.
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth")) {
    window.location.href = "/auth/login";
  }
}

/**
 * Read the refresh token persisted by (possibly another) tab, for burned-token
 * recovery in multi-tab scenarios.
 */
function readPersistedRefreshToken(): string | null {
  try {
    const raw = window.localStorage.getItem("converza-auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { refreshToken?: string } };
    return parsed?.state?.refreshToken ?? null;
  } catch {
    return null;
  }
}

type RefreshResult = { token: string; fatal: false } | { token: null; fatal: boolean };

/**
 * Rotate the refresh token and return a fresh access token.
 *
 * FIX (2026-10-18) — two failure modes no longer log the broker out:
 * 1. Network errors (dropped Wi-Fi, phone lock): transient — return
 *    `fatal: false` WITHOUT clearing auth; the next request retries refresh.
 * 2. Multi-tab race: refresh tokens are single-use. If tab A rotates, tab B's
 *    in-memory token is burned and refresh 401s. Before logging out, check the
 *    persisted token (auth.store syncs it cross-tab via the storage event);
 *    if it changed, adopt it and retry once.
 * `fatal: true` means the refresh token is definitively dead → clear auth.
 */
async function refreshAccessToken(attempt = 0): Promise<RefreshResult> {
  const { refreshToken, login } = useAuthStore.getState();
  if (!refreshToken) return { token: null, fatal: true };

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Network hiccup — do NOT log out. Caller reports a connection error;
    // the session stays intact and the next request retries.
    return { token: null, fatal: false };
  }

  if (!res.ok) {
    // Maybe another tab burned this token and already persisted the rotation.
    if (attempt === 0 && typeof window !== "undefined") {
      const fresher = readPersistedRefreshToken();
      if (fresher && fresher !== refreshToken) {
        // auth.store's storage listener has already adopted it into state —
        // re-run; getState() below will pick up the new token.
        return refreshAccessToken(1);
      }
    }
    // 401 on a current token = definitively invalid → log out.
    // Other unexpected statuses: treat as soft failure too — don't nuke the
    // session because the server hiccuped on /auth/refresh.
    if (res.status === 401) {
      useAuthStore.getState().logout();
      return { token: null, fatal: true };
    }
    return { token: null, fatal: false };
  }

  let data: { accessToken?: string; refreshToken?: string };
  try {
    data = await res.json();
  } catch {
    return { token: null, fatal: false };
  }
  const currentUser = useAuthStore.getState().user;
  if (!data.accessToken || !data.refreshToken || !currentUser) {
    useAuthStore.getState().logout();
    return { token: null, fatal: true };
  }
  login({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: currentUser,
  });
  return { token: data.accessToken, fatal: false };
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { accessToken, isAuthenticated } = useAuthStore.getState();

  // For FormData, let the browser set Content-Type with boundary
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string>),
  };

  if (!options.skipAuth && isAuthenticated && accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  let res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });  // Token expired — refresh and retry
  if (res.status === 401 && isAuthenticated) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshAccessToken().then((r) => r.token);
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
      // The refresh attempt definitively failed (logged out) or was transient.
      // Only "Session expired" when auth was actually cleared; otherwise it's
      // a connection problem — the broker keeps their session and can retry.
      const stillAuthenticated = useAuthStore.getState().isAuthenticated;
      throw new Error(
        stillAuthenticated
          ? "Connection issue — your session is safe, please retry"
          : "Session expired"
      );
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    // Attach the status + full body so callers can branch on flags like
    // verificationRequired (FIX Round-2 #3) instead of just the message.
    const err = new Error(error.error || error.message || `HTTP ${res.status}`) as Error & {
      status?: number;
      data?: unknown;
    };
    err.status = res.status;
    err.data = error;
    throw err;
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
