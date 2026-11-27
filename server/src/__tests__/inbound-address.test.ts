import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildInboundAddress,
  extractInboundToken,
  forwardingDomain,
  forwardingPrefix,
} from "../utils/inbound-address";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.IMAP_USER;
  delete process.env.FORWARDING_EMAIL;
  delete process.env.FORWARDING_DOMAIN;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("extractInboundToken", () => {
  it("finds the token in a To header", () => {
    process.env.IMAP_USER = "forward@converza.tech";
    expect(extractInboundToken(["Converza <forward+abcd1234ef@converza.tech>"])).toBe("abcd1234ef");
  });

  it("finds the token in Delivered-To when To still names the portal", () => {
    process.env.IMAP_USER = "chetan@gmail.com";
    expect(
      extractInboundToken([
        "no-reply@magicbricks.com",
        "Delivered-To: chetan+zz99yy88xx@gmail.com\nX-Forwarded-To: chetan+zz99yy88xx@gmail.com",
      ])
    ).toBe("zz99yy88xx");
  });

  it("still accepts legacy leads+ addresses handed out by earlier builds", () => {
    process.env.IMAP_USER = "chetan@gmail.com";
    expect(extractInboundToken(["Delivered-To: leads+abcd1234ef@converza.tech"])).toBe("abcd1234ef");
  });

  it("ignores the shared mailbox and ordinary senders", () => {
    process.env.IMAP_USER = "forward@converza.tech";
    expect(
      extractInboundToken(["someone@gmail.com", "Delivered-To: forward@converza.tech"])
    ).toBeNull();
  });

  it("ignores short or non-alphanumeric lookalikes", () => {
    process.env.IMAP_USER = "forward@converza.tech";
    expect(extractInboundToken(["leads+a@converza.tech"])).toBeNull();
  });
});

describe("buildInboundAddress", () => {
  it("plus-addresses the mailbox the IMAP poller actually reads", () => {
    process.env.IMAP_USER = "chetan@gmail.com";
    process.env.FORWARDING_EMAIL = "forward@converza.tech";
    expect(buildInboundAddress("abcd1234ef")).toBe("chetan+abcd1234ef@gmail.com");
  });

  it("falls back to FORWARDING_EMAIL for webhook-only setups", () => {
    process.env.FORWARDING_EMAIL = "forward@converza.tech";
    expect(buildInboundAddress("abcd1234ef")).toBe("forward+abcd1234ef@converza.tech");
  });

  it("prefers FORWARDING_DOMAIN for a dedicated catch-all", () => {
    process.env.IMAP_USER = "chetan@gmail.com";
    process.env.FORWARDING_DOMAIN = "forward.converza.tech";
    expect(buildInboundAddress("abcd1234ef")).toBe("chetan+abcd1234ef@forward.converza.tech");
  });

  it("exposes the prefix and domain it will use", () => {
    process.env.IMAP_USER = "Chetan@Gmail.com";
    expect(forwardingPrefix()).toBe("chetan");
    expect(forwardingDomain()).toBe("gmail.com");
  });
});
