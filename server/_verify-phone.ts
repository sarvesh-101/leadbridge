import { config } from "./src/config";

async function graph(url: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

(async () => {
  const token = config.WHATSAPP_TOKEN;
  const pid = config.WHATSAPP_PHONE_ID;
  const waba = config.WHATSAPP_BUSINESS_ACCOUNT_ID;
  console.log("=== Phone Number ID", pid, "— verification ===");

  const phone = await graph(
    `https://graph.facebook.com/v19.0/${pid}?fields=display_phone_number,verified_name,quality_rating,code_verification_status,name_status,platform_type,throughput`,
    token
  );
  if (phone.status === 200) {
    const d = phone.body;
    console.log(`✅ Phone ID ${pid}:`);
    console.log(`   number       : ${d.display_phone_number}`);
    console.log(`   verified_name: ${d.verified_name}`);
    console.log(`   code_status  : ${d.code_verification_status}`);
    console.log(`   name_status  : ${d.name_status ?? "-"}`);
    console.log(`   quality      : ${d.quality_rating}`);
    console.log(`   platform     : ${d.platform_type}`);
  } else {
    console.log(`❌ Phone query failed HTTP ${phone.status}:`, JSON.stringify(phone.body).slice(0, 300));
  }

  console.log("");
  if (waba) {
    const acct = await graph(
      `https://graph.facebook.com/v19.0/${waba}?fields=phone_numbers{id,display_phone_number,verified_name,code_verification_status}`,
      token
    );
    if (acct.status === 200 && Array.isArray(acct.body.phone_numbers?.data)) {
      console.log(`WABA ${waba} numbers:`);
      for (const n of acct.body.phone_numbers.data) {
        console.log(`   ID ${n.id} | ${n.display_phone_number} | ${n.verified_name} | ${n.code_verification_status}`);
      }
      const inWaba = acct.body.phone_numbers.data.some((n: any) => String(n.id) === String(pid));
      console.log(inWaba ? "→ ✅ This number IS on the configured WABA" : "→ ⚠️ This number is NOT on the configured WABA!");
    } else {
      console.log(`❌ WABA query failed HTTP ${acct.status}:`, JSON.stringify(acct.body).slice(0, 300));
    }
  }
})();
