import { describe, it, expect, vi, beforeEach } from "vitest";

const listPhoneNumbers = vi.fn();
vi.mock("../services/omnidimension-phone.service", () => ({
  listPhoneNumbers: (...args: unknown[]) => listPhoneNumbers(...args),
}));

const { resolveCallerNumber } = await import("../services/phone/caller-id");

function fakePrisma(client: Record<string, unknown>, holders: Array<{ omniPhoneNumberId: number | null }> = []) {
  const update = vi.fn().mockResolvedValue({});
  return {
    prisma: {
      client: {
        findUnique: vi.fn().mockResolvedValue(client),
        findMany: vi.fn().mockResolvedValue(holders),
        update,
      },
    } as never,
    update,
  };
}

const numbers = [
  { id: 11, phone_number: "+919000000011", active_bot_id: null },
  { id: 22, phone_number: "+919000000022", active_bot_id: 7 },
  { id: 33, phone_number: "+919000000033", active_bot_id: null },
];

describe("resolveCallerNumber", () => {
  beforeEach(() => {
    listPhoneNumbers.mockReset();
    listPhoneNumbers.mockResolvedValue(numbers);
  });

  it("reuses the number the client already holds", async () => {
    const { prisma, update } = fakePrisma({
      id: "c1",
      omniPhoneNumberId: 22,
      omniPhoneNumber: "+919000000022",
      omniAgentId: "7",
    });

    const result = await resolveCallerNumber(prisma, "c1");

    expect(result).toEqual({ id: 22, phoneNumber: "+919000000022", assignedNow: false });
    expect(update).not.toHaveBeenCalled();
  });

  it("assigns a free number when the client holds none", async () => {
    // Agent 5 matches none of the numbers, so the first free one wins.
    const { prisma, update } = fakePrisma({
      id: "c1",
      omniPhoneNumberId: null,
      omniPhoneNumber: null,
      omniAgentId: "5",
    });

    const result = await resolveCallerNumber(prisma, "c1");

    expect(result).toEqual({ id: 11, phoneNumber: "+919000000011", assignedNow: true });
    expect(update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { omniPhoneNumberId: 11, omniPhoneNumber: "+919000000011" },
    });
  });

  it("never takes a number another broker holds", async () => {
    const { prisma } = fakePrisma(
      { id: "c1", omniPhoneNumberId: null, omniPhoneNumber: null, omniAgentId: "5" },
      [{ omniPhoneNumberId: 11 }],
    );

    const result = await resolveCallerNumber(prisma, "c1");

    expect(result?.id).toBe(22);
    expect(result?.id).not.toBe(11);
  });

  it("prefers a free number already attached to the client's agent", async () => {
    const { prisma } = fakePrisma({
      id: "c1",
      omniPhoneNumberId: null,
      omniPhoneNumber: null,
      omniAgentId: "9",
    });
    listPhoneNumbers.mockResolvedValue([
      { id: 11, phone_number: "+919000000011", active_bot_id: null },
      { id: 44, phone_number: "+919000000044", active_bot_id: 9 },
    ]);

    const result = await resolveCallerNumber(prisma, "c1");

    expect(result?.id).toBe(44);
  });

  it("returns null when every number is taken", async () => {
    const { prisma } = fakePrisma(
      { id: "c1", omniPhoneNumberId: null, omniPhoneNumber: null, omniAgentId: "7" },
      [{ omniPhoneNumberId: 11 }, { omniPhoneNumberId: 22 }, { omniPhoneNumberId: 33 }],
    );

    expect(await resolveCallerNumber(prisma, "c1")).toBeNull();
  });

  it("replaces a number that is gone from the platform inventory", async () => {
    const { prisma } = fakePrisma({
      id: "c1",
      omniPhoneNumberId: 999,
      omniPhoneNumber: "+919000000999",
      omniAgentId: "7",
    });

    const result = await resolveCallerNumber(prisma, "c1");

    expect(result?.assignedNow).toBe(true);
    expect(result?.id).not.toBe(999);
  });
});
