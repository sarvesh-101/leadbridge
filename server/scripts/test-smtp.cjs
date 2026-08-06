/**
 * SMTP test script - reads credentials from .env (never contains secrets itself).
 * Usage: node scripts/test-smtp.cjs [recipient]
 * Default recipient: the SMTP_USER account.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const nodemailer = require("nodemailer");

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT || 587);
const secure = String(process.env.SMTP_SECURE) === "true";
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.FROM_EMAIL || user;
const to = process.argv[2] || user;

if (!host || !user || !pass) {
  console.error("ERROR: SMTP_HOST / SMTP_USER / SMTP_PASS must be set in .env");
  process.exit(1);
}

const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });

(async () => {
  try {
    const ok = await transporter.verify();
    console.log(`VERIFY: ${ok ? "PASS ✅" : "FAIL ❌"} (${user} -> ${host}:${port})`);
  } catch (e) {
    console.error(`VERIFY: FAIL ❌ -> ${e.message}`);
    process.exit(1);
  }

  try {
    const info = await transporter.sendMail({
      from: `"${process.env.FROM_NAME || "LeadBridge"}" <${from}>`,
      to,
      subject: "LeadBridge - live SMTP test",
      text: "This is a live test email from LeadBridge. If you received this, real emails are sending.",
      html: "<p>This is a live test email from <b>LeadBridge</b>. If you received this, real emails are sending. 🎉</p>",
    });
    console.log(`SENT ✅ messageId: ${info.messageId}`);
    console.log(`accepted: ${info.accepted.join(", ") || "none"}`);
    console.log(`rejected: ${info.rejected.join(", ") || "none"}`);
  } catch (e) {
    console.error(`SEND: FAIL ❌ -> ${e.message}`);
    process.exit(1);
  }
})();
