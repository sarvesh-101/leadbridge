"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export interface LandingStats {
  activeBrokers: number;
  callsMade: number;
  visitsBooked: number;
  citiesClaimed: number;
  citiesAvailable: number;
  totalCitiesTracked: number;
}

export interface LandingData {
  territories?: Array<{ city: string; zone: string | null; status: "available" | "taken" }>;
  stats?: LandingStats;
}

const CACHE_TTL_MS = 60_000;
let cachedPromise: Promise<LandingData> | null = null;
let cacheExpiresAt = 0;

/**
 * Fetch landing-page stats ONCE per minute and share across all sections —
 * prevents 4 duplicate /public/landing requests per page load.
 */
export function fetchLandingData(): Promise<LandingData> {
  const now = Date.now();
  if (cachedPromise && now < cacheExpiresAt) return cachedPromise;

  cachedPromise = apiFetch<LandingData>("/public/landing", { skipAuth: true }).catch((err) => {
    cachedPromise = null; // allow retry on next caller
    throw err;
  });
  cacheExpiresAt = now + CACHE_TTL_MS;
  return cachedPromise;
}

/** Shared hook for all landing-page sections. Honest fallback: null data on failure. */
export function useLandingData() {
  const [data, setData] = useState<LandingData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchLandingData()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        // API unreachable — sections render their honest empty/fallback states
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loaded };
}
