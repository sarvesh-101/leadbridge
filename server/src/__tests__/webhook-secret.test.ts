import { describe, expect, it } from "vitest";
import {
  isWebhookRequestAuthorized,
  presentedSecret,
  secretMatches,
} from "../utils/webhook-secret";

const SECRET = "s3cret-for-tests";
const basic = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;

describe("webhook shared secret", () => {
  it("lets everything through when no secret is configured", () => {
    expect(isWebhookRequestAuthorized({ headers: {}, expected: undefined })).toBe(true);
    expect(isWebhookRequestAuthorized({ headers: {}, expected: "" })).toBe(true);
    expect(isWebhookRequestAuthorized({ headers: {}, expected: "   " })).toBe(true);
  });

  it("rejects a request with no credentials once a secret is set", () => {
    expect(isWebhookRequestAuthorized({ headers: {}, expected: SECRET })).toBe(false);
  });

  it("accepts the secret from a header, a bearer token and the query", () => {
    expect(isWebhookRequestAuthorized({ headers: { "x-webhook-secret": SECRET }, expected: SECRET })).toBe(true);
    expect(isWebhookRequestAuthorized({ headers: { authorization: `Bearer ${SECRET}` }, expected: SECRET })).toBe(true);
    expect(isWebhookRequestAuthorized({ headers: {}, query: { secret: SECRET }, expected: SECRET })).toBe(true);
  });

  it("accepts basic auth with the secret as the password", () => {
    const headers = { authorization: basic("converza", SECRET) };
    expect(presentedSecret(headers)).toBe(SECRET);
    expect(isWebhookRequestAuthorized({ headers, expected: SECRET })).toBe(true);
  });

  it("accepts basic auth when the provider sends the secret as the user", () => {
    const headers = { authorization: basic(SECRET, "") };
    expect(isWebhookRequestAuthorized({ headers, expected: SECRET })).toBe(true);
  });

  it("rejects a wrong or empty secret", () => {
    expect(isWebhookRequestAuthorized({ headers: { "x-webhook-secret": "nope" }, expected: SECRET })).toBe(false);
    expect(isWebhookRequestAuthorized({ headers: { "x-webhook-secret": `${SECRET}x` }, expected: SECRET })).toBe(false);
    expect(isWebhookRequestAuthorized({ headers: { authorization: "Bearer " }, expected: SECRET })).toBe(false);
    expect(isWebhookRequestAuthorized({ headers: { authorization: "Bearer" }, expected: SECRET })).toBe(false);
  });

  it("trims the configured secret and the presented header", () => {
    expect(isWebhookRequestAuthorized({ headers: { "x-webhook-secret": ` ${SECRET} ` }, expected: ` ${SECRET}\n` })).toBe(true);
  });

  it("compares in constant time regardless of length", () => {
    expect(secretMatches(SECRET, SECRET)).toBe(true);
    expect(secretMatches("a", SECRET)).toBe(false);
    expect(secretMatches(SECRET, "a")).toBe(false);
    expect(secretMatches("", SECRET)).toBe(false);
  });
});
