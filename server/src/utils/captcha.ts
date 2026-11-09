/**
 * V2 (T6) — captcha verification for the public demo funnel.
 *
 * Cloudflare Turnstile and hCaptcha are both server-verified POSTs. When no
 * key is configured, verification is skipped (the honeypot + rate limits still
 * apply) and index.ts logs a loud boot warning.
 */
interface VerifyResult {
  ok: boolean;
  provider: "turnstile" | "hcaptcha" | "none";
  reason?: string;
}

export async function verifyCaptcha(token: string, ip: string | null): Promise<VerifyResult> {
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  const hcaptchaSecret = process.env.HCAPTCHA_SECRET_KEY;

  if (!turnstileSecret && !hcaptchaSecret) {
    return { ok: true, provider: "none" };
  }
  if (!token) {
    return { ok: false, provider: turnstileSecret ? "turnstile" : "hcaptcha", reason: "missing-token" };
  }

  const endpoint = turnstileSecret
    ? "https://challenges.cloudflare.com/turnstile/v0/siteverify"
    : "https://hcaptcha.com/siteverify";
  const secret = turnstileSecret || hcaptchaSecret!;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json: any = await res.json();
    return {
      ok: Boolean(json.success),
      provider: turnstileSecret ? "turnstile" : "hcaptcha",
      reason: json.success ? undefined : "provider-rejected",
    };
  } catch (err: any) {
    // Fail closed on a verification outage: a demo call costs real money.
    return {
      ok: false,
      provider: turnstileSecret ? "turnstile" : "hcaptcha",
      reason: `verify-error: ${err.message}`,
    };
  }
}
