"use client";

import { useEffect, type ReactNode } from "react";
import { QueryClient, QueryClientProvider as BaseQueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { wsClient } from "./websocket";

/**
 * QueryClient configured for the LeadBridge dashboard.
 * - staleTime: 30s — don't refetch within 30 seconds of mount
 * - retry: 2 — retry failed queries twice
 * - refetchOnWindowFocus: true — refetch when user returns to tab
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        retry: 2,
        refetchOnWindowFocus: true,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always create a new client
    return makeQueryClient();
  }
  // Browser: reuse the same client
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

// ─── Query Key Constants ───────────────────────────────────────
export const QUERY_KEYS = {
  leads: {
    all: ["leads"] as const,
    list: (filters?: Record<string, string>) => ["leads", "list", filters] as const,
    detail: (id: string) => ["leads", "detail", id] as const,
  },
  calls: {
    all: ["calls"] as const,
    list: (filters?: Record<string, string>) => ["calls", "list", filters] as const,
  },
  bookings: {
    all: ["bookings"] as const,
    list: (filters?: Record<string, string>) => ["bookings", "list", filters] as const,
  },
  dashboard: {
    stats: ["dashboard", "stats"] as const,
  },
  me: ["me"] as const,
  usage: ["me", "usage"] as const,
};

function WsInvalidationProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubs: (() => void)[] = [];

    // Real-time lead events → invalidate leads + dashboard queries
    unsubs.push(
      wsClient.on("lead.status_changed", () => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leads.all });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboard.stats });
      })
    );

    unsubs.push(
      wsClient.on("lead.new", () => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leads.all });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboard.stats });
      })
    );

    unsubs.push(
      wsClient.on("lead.call_started", (event) => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leads.all });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.calls.all });
        if (event.data.leadId) {
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leads.detail(event.data.leadId as string) });
        }
      })
    );

    unsubs.push(
      wsClient.on("lead.call_ended", (event) => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leads.all });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.calls.all });
        if (event.data.leadId) {
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leads.detail(event.data.leadId as string) });
        }
      })
    );

    unsubs.push(
      wsClient.on("lead.booking_created", (event) => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leads.all });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.bookings.all });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboard.stats });
        if (event.data.leadId) {
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leads.detail(event.data.leadId as string) });
        }
      })
    );

    return () => unsubs.forEach((fn) => fn());
  }, [queryClient]);

  return <>{children}</>;
}

// ─── Provider ───────────────────────────────────────────────────
export function QueryProvider({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <BaseQueryClientProvider client={queryClient}>
      <WsInvalidationProvider>
        {children}
      </WsInvalidationProvider>
    </BaseQueryClientProvider>
  );
}
