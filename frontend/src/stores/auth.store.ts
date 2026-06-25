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
  plan?: "STARTER" | "GROWTH" | "PRO";
  planStatus?: "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELLED";
  city?: string;
  zone?: string;
  callsThisMonth?: number;
  callsLimit?: number;
  picture?: string;
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
      name: "leadbridge-auth",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
