import { describe, expect, it, vi, beforeEach } from "vitest";

// The module under test reads config.RECORDING_RETENTION_DAYS, so mock config.
vi.mock("../config", () => ({
  config: { RECORDING_RETENTION_DAYS: 90 },
}));

import { config } from "../config";

// Mock the prisma module before importing it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mock("../utils/prisma-shared", () => ({
  prisma: { call: { updateMany: vi.fn().mockResolvedValue({ count: 3 }) } } as any,
}));

import { runRecordingRetention } from "../cron/recording-retention";

describe("recording retention (T14)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is a no-op when retention is unset", async () => {
    (config as any).RECORDING_RETENTION_DAYS = undefined;
    const result = await runRecordingRetention(new Date("2026-11-06T03:00:00Z"));
    expect(result).toEqual({ days: 0, cleared: 0 });
  });

  it("is a no-op when retention is explicitly zero", async () => {
    (config as any).RECORDING_RETENTION_DAYS = 0;
    const result = await runRecordingRetention(new Date("2026-11-06T03:00:00Z"));
    expect(result).toEqual({ days: 0, cleared: 0 });
  });

  it("clears older recordings when retention is set", async () => {
    (config as any).RECORDING_RETENTION_DAYS = 90;
    const result = await runRecordingRetention(new Date("2026-11-06T03:00:00Z"));
    expect(result).toEqual({ days: 90, cleared: 3 });
  });
});

