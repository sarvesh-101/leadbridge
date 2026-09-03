import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseLeadgenWebhook,
  normalizeFacebookFieldData,
  fetchFacebookLead,
  getPageFromToken,
} from "../services/facebook-leads.service";

afterEach(() => {
  vi.unstubAllGlobals();
});

const LEADGEN_PAYLOAD = {
  object: "page",
  entry: [
    {
      id: "123456789",
      time: 1712746634,
      changes: [
        {
          field: "leadgen",
          value: {
            leadgen_id: "987654321",
            page_id: "123456789",
            form_id: "555666777",
            created_time: 1712746634,
          },
        },
      ],
    },
  ],
};

describe("parseLeadgenWebhook", () => {
  it("extracts a leadgen event from the documented payload", () => {
    const events = parseLeadgenWebhook(LEADGEN_PAYLOAD);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ leadgenId: "987654321", pageId: "123456789", formId: "555666777" });
  });

  it("ignores non-leadgen changes", () => {
    const body = {
      object: "page",
      entry: [{ id: "1", changes: [{ field: "mention", value: {} }] }],
    };
    expect(parseLeadgenWebhook(body)).toHaveLength(0);
  });

  it("handles multiple entries and changes", () => {
    const body = {
      object: "page",
      entry: [
        { id: "1", changes: [{ field: "leadgen", value: { leadgen_id: "a", page_id: "1" } }] },
        { id: "2", changes: [{ field: "leadgen", value: { leadgen_id: "b", page_id: "2" } }] },
      ],
    };
    const events = parseLeadgenWebhook(body);
    expect(events).toHaveLength(2);
  });
});

describe("normalizeFacebookFieldData", () => {
  it("normalizes full_name / phone / email", () => {
    const result = normalizeFacebookFieldData([
      { name: "full_name", values: ["Rahul Sharma"] },
      { name: "phone_number", values: ["+91 98765 43210"] },
      { name: "email", values: ["rahul@example.com"] },
      { name: "city", values: ["Mumbai"] },
    ]);
    expect(result.name).toBe("Rahul Sharma");
    expect(result.phone).toBe("+919876543210");
    expect(result.email).toBe("rahul@example.com");
    expect(result.city).toBe("Mumbai");
  });

  it("falls back to first + last name", () => {
    const result = normalizeFacebookFieldData([
      { name: "first_name", values: ["Priya"] },
      { name: "last_name", values: ["Patel"] },
    ]);
    expect(result.name).toBe("Priya Patel");
  });

  it("leaves phone undefined for an unusable number", () => {
    const result = normalizeFacebookFieldData([
      { name: "phone_number", values: ["not-a-number"] },
    ]);
    expect(result.phone).toBeUndefined();
  });
});

describe("fetchFacebookLead", () => {
  it("fetches and normalizes the lead record via Graph API", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      expect(url).toContain("987654321?fields=id,created_time,field_data,page_id,form_id");
      return {
        ok: true,
        json: async () => ({
          id: "987654321",
          created_time: "2024-04-10T11:17:14+0000",
          page_id: "123456789",
          form_id: "555666777",
          field_data: [
            { name: "full_name", values: ["Rahul Sharma"] },
            { name: "phone_number", values: ["9876543210"] },
            { name: "email", values: ["rahul@example.com"] },
          ],
        }),
      };
    }));

    const lead = await fetchFacebookLead("987654321", "page-token");
    expect(lead).not.toBeNull();
    expect(lead!.name).toBe("Rahul Sharma");
    expect(lead!.phone).toBe("+919876543210");
    expect(lead!.email).toBe("rahul@example.com");
  });

  it("returns null when the lead has no usable phone", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: "1", page_id: "2", field_data: [{ name: "full_name", values: ["No Phone"] }] }),
    })));
    expect(await fetchFacebookLead("1", "t")).toBeNull();
  });
});

describe("getPageFromToken", () => {
  it("resolves the page behind a page token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: "123", name: "My Property Page" }),
    })));
    const page = await getPageFromToken("token");
    expect(page).toEqual({ id: "123", name: "My Property Page" });
  });
});