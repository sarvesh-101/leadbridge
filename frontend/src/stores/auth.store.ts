import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface UserProfile {
  id: string;
  email: string;
  role: "admin" | "client";
  name?: string;
  businessName?: string;
  ownerName?: string;
  phone?: string;
  plan?: "LAUNCH" | "STARTER" | "GROWTH" | "PRO";
  planStatus?: "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELLED";
  city?: string;
  zone?: string;
  callsThisMonth?: number;
  callsLimit?: number;
  picture?: string;
  trialEndsAt?: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  login: (tokens: { accessToken: string; refreshToken: string; user: UserProfile }) => void;
  logout: () => void;
  setAccessToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      login: (tokens) =>
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: tokens.user,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
        }),

      setAccessToken: (token) =>
        set({ accessToken: token }),
    }),
    {
      name: "converza-auth",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

/**
 * FIX (2026-10-18): Cross-tab auth sync.
 *
 * Refresh tokens are single-use rotating. Without this listener, two open tabs
 * each held their own copy in memory: tab A refreshed (burning the shared
 * stored token), tab B kept the burned one → next refresh 401'd → tab B got
 * logged out mid-work. Listening to the persisted-write means every tab adopts
 * the newest rotation immediately, and a logout in one tab logs out all.
 */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== "converza-auth") return;
    try {
      if (!event.newValue) {
        // Persisted entry was cleared (e.g. storage.clear()) — log this tab out too.
        useAuthStore.setState({
          accessToken: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
        });
        return;
      }
      const parsed = JSON.parse(event.newValue) as { state?: zPersistedAuth };
      const s = parsed?.state;
      if (s && s.refreshToken !== useAuthStore.getState().refreshToken) {
        useAuthStore.setState({
          accessToken: s.accessToken ?? null,
          refreshToken: s.refreshToken ?? null,
          user: s.user ?? null,
          isAuthenticated: s.isAuthenticated ?? false,
        });
      }
    } catch {
      // Malformed storage write — ignore, keep current state.
    }
  });
}

type zPersistedAuth = {
  accessToken?: string;
  refreshToken?: string;
  user?: UserProfile | null;
  isAuthenticated?: boolean;
};
