/**
 * MessageBird live test:
 * 1. Validate key via GET /balance
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

  // 1. Validate the key — GET /balance (works for both live & test keys)
  console.log("--- 1. Key validation (balance) ---");
  try {
    const res = await fetch("https://rest.messagebird.com/balance", {
      headers: { Authorization: `AccessKey ${key}` },
    });
    const body = await res.json().catch(() => ({}));
    console.log(`HTTP ${res.status}`);
    if (res.status === 200) {
      console.log(`   ✅ Key VALID — balance: ${body.payment} ${body.currency} | type: ${body.type}`);
    } else {
      console.log(`   ❌ Key invalid: ${JSON.stringify(body).slice(0, 250)}`);
      process.exit(1);
    }
  } catch (err: any) {
    console.log(`   ❌ Request failed: ${err.message}`);
    process.exit(1);
  }

  // 2. Send a real SMS through the actual code path
  console.log("");
  console.log("--- 2. Real SMS send ---");
  const ok = await sendSms(
    "+91 7045525531",
    "🔔 LeadBridge SMS test — if you got this, MessageBird works! Timestamp: " + new Date().toISOString()
  );
  if (ok) {
    console.log("✅ SMS ACCEPTED by MessageBird — check your phone!");
  } else {
    console.log("❌ SMS failed — see server logs above for the MessageBird error");
    process.exitCode = 1;
  }
})();
