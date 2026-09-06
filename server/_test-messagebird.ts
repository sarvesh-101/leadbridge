/**
 * MessageBird live test:
 * 1. Validate key against the new platform API (Bearer auth)
 * 2. Send a real SMS via the actual sendSms() code path to +91 7045525531
 */
import { config } from "./src/config";
import { sendSms } from "./src/services/sms.service";

(async () => {
  const key = config.MESSAGEBIRD_API_KEY;
  console.log("=== MessageBird Live Test ===");
  console.log(`Key: ${key ? key.slice(0, 7) + "…" + key.slice(-4) : "NOT SET"} (len ${key?.length ?? 0})`);
  console.log(`Sender: ${config.SMS_SENDER_ID}`);
  console.log("");

  // 1. Validate the key against the NEW platform API. The legacy
  //    `rest.messagebird.com/balance` endpoint + `AccessKey` auth rejects new
  //    `bk_...` keys, so probe the regional host with Bearer auth instead.
  //    A 401/403 means the key is bad; anything else means it authenticated.
  console.log("--- 1. Key validation ---");
  try {
    const host = key?.startsWith("bk_us1_")
      ? "us1.platform.bird.com"
      : key?.startsWith("bk_eu1_")
        ? "eu1.platform.bird.com"
        : "api.bird.com";
    const res = await fetch(`https://${host}/v1/sms/messages`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    console.log(`HTTP ${res.status}`);
    if (res.status === 401 || res.status === 403) {
      console.log(`   ❌ Key invalid (unauthorized)`);
      process.exit(1);
    }
    console.log("   ✅ Key VALID — auth passed");
    if (res.status >= 400) {
      console.log(`      (endpoint returned ${res.status}: ${(await res.text()).slice(0, 250)})`);
    }
  } catch (err: any) {
    console.log(`   ❌ Request failed: ${err.message}`);
    process.exit(1);
  }

  // 2. Send a real SMS through the actual code path
  console.log("");
  console.log("--- 2. Real SMS send ---");
  console.log(`   Using sender ID: ${config.SMS_SENDER_ID}`);
  const ok = await sendSms(
    "+91 7045525531",
    "🔔 Converza SMS test — if you got this, MessageBird works! Timestamp: " + new Date().toISOString()
  );
  if (ok) {
    console.log("✅ SMS ACCEPTED by MessageBird — check your phone!");
  } else {
    console.log("❌ SMS failed — see server logs above for the MessageBird error");
    process.exitCode = 1;
  }
})();
