import { describe, it, expect, vi, afterEach } from "vitest";
import {
  extractIndiaMartResponse,
  normalizeIndiaMartLead,
  formatIndiaMartTime,
  fetchIndiaMartLeads,
  testIndiaMartConnection,
} from "../services/indiamart.service";

// Sample payload from IndiaMART's Push API documentation
const SAMPLE_RESPONSE = {
  UNIQUE_QUERY_ID: "621654886",
  QUERY_TYPE: "B",
  QUERY_TIME: "2024-04-10 11:17:14",
  SENDER_NAME: "Prabhat",
  SENDER_MOBILE: "+91-9999999999",
  SENDER_EMAIL: "abcdeprabhat@gmail.com",
  SUBJECT: "Requirement for Empty Mineral Water Bottle",
  SENDER_COMPANY: "ABC Pvt Ltd.",
  SENDER_CITY: "Noida",
  SENDER_STATE: "Uttar Pradesh",
  SENDER_PINCODE: "201304",
  SENDER_COUNTRY_ISO: "IN",
  QUERY_PRODUCT_NAME: "Mineral Water Bottle",
  QUERY_MESSAGE: "I want to purchase an Empty Mineral Water Bottle. Quantity: 100000 Piece",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("extractIndiaMartResponse", () => {
  it("extracts RESPONSE nested under body (documented Push API shape)", () => {
    const body = {
      method: "POST",
      json: true,
      headers: { "Content-Type": "application/json" },
      url: "https://example.com/api/v1/webhooks/indiamart/client-1",
      body: { CODE: 200, STATUS: "SUCCESS", RESPONSE: SAMPLE_RESPONSE },
      timeout: 10000,
    };
    expect(extractIndiaMartResponse(body)).toEqual(SAMPLE_RESPONSE);
  });

  it("accepts a bare record at the top level", () => {
    expect(extractIndiaMartResponse(SAMPLE_RESPONSE)).toEqual(SAMPLE_RESPONSE);
  });

  it("returns null for an unusable payload", () => {
    expect(extractIndiaMartResponse({ foo: "bar" })).toBeNull();
  });
});

describe("normalizeIndiaMartLead", () => {
  it("normalizes a documented payload into our lead shape", () => {
    const lead = normalizeIndiaMartLead(SAMPLE_RESPONSE)!;
    expect(lead.uniqueQueryId).toBe("621654886");
    expect(lead.name).toBe("Prabhat");
    expect(lead.phone).toBe("+919999999999"); // normalized to E.164
    expect(lead.email).toBe("abcdeprabhat@gmail.com");
    expect(lead.productName).toBe("Mineral Water Bottle");
    expect(lead.queryType).toBe("B");
  });

  it("defaults SENDER_NAME to 'IndiaMART Buyer'", () => {
    const { SENDER_NAME: _omit, ...noName } = SAMPLE_RESPONSE;
    const lead = normalizeIndiaMartLead(noName)!;
    expect(lead.name).toBe("IndiaMART Buyer");
  });

  it("rejects leads without a query id", () => {
    const { UNIQUE_QUERY_ID: _omit, ...noId } = SAMPLE_RESPONSE;
    expect(normalizeIndiaMartLead(noId)).toBeNull();
  });

  it("rejects leads without a usable phone", () => {
    const { SENDER_MOBILE: _omit, ...noPhone } = SAMPLE_RESPONSE;
    expect(normalizeIndiaMartLead(noPhone)).toBeNull();
  });
});

describe("formatIndiaMartTime", () => {
  it("formats as dd-mm-yyyy hh:mm:ss", () => {
    // 2024-04-10 11:17:14 IST (UTC+5:30) → construct in local time to avoid TZ flakes
    const d = new Date(2024, 3, 10, 11, 17, 14);
    expect(formatIndiaMartTime(d)).toBe("10-04-2024 11:17:14");
  });
});

describe("fetchIndiaMartLeads", () => {
  it("calls the Pull API with the correct signed params and normalizes leads", async () => {
    let capturedUrl = "";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      capturedUrl = url;
      return {
        ok: true,
        json: async () => ({ STATUS: "SUCCESS", RESPONSE: [SAMPLE_RESPONSE] }),
      };
    }));

    const leads = await fetchIndiaMartLeads("crm-key-123", "9876543210", new Date(2024, 3, 10, 11, 0, 0), new Date(2024, 3, 10, 11, 5, 0));

    expect(capturedUrl).toContain("key=crm-key-123");
    expect(capturedUrl).toContain("user_id=9876543210");
    expect(capturedUrl).toContain("glusr_crm_key=crm-key-123");
    expect(capturedUrl).toContain("start_time=10-04-2024+11%3A00%3A00");
    expect(capturedUrl).toContain("end_time=10-04-2024+11%3A05%3A00");
    // signature = md5(key + mobile)
    expect(capturedUrl).toContain(`signature=`);
    expect(leads).toHaveLength(1);
    expect(leads[0].phone).toBe("+919999999999");
  });

  it("handles a single-object RESPONSE (non-array)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ STATUS: "SUCCESS", RESPONSE: SAMPLE_RESPONSE }),
    })));
    const leads = await fetchIndiaMartLeads("k", "9876543210", new Date(), new Date());
    expect(leads).toHaveLength(1);
  });

  it("throws on a non-SUCCESS response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ STATUS: "FAILURE", MESSAGE: "invalid signature" }),
    })));
    await expect(fetchIndiaMartLeads("k", "9876543210", new Date(), new Date())).rejects.toThrow();
  });
});

describe("testIndiaMartConnection", () => {
  it("reports ok:false with the error when the API fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401 })));
    const result = await testIndiaMartConnection("bad-key", "9876543210");
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });
});