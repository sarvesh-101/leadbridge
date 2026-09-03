# 📋 YOUR Action Checklist — Everything You Need To Do

> **Created:** 2026-08-29 · **Owner:** Sarvesh
> **Code is ready.** This doc covers every action YOU need to take to make Converza customer-usable.
> Complete items in order — each section has clear steps with exact URLs and buttons to click.

---

## 🔴 PRIORITY 1 — Razorpay KYC (Do First — Blocks Everything)

**Why:** Without KYC, Razorpay holds your payouts. You can't receive money from brokers.

### Step 1: Log into Razorpay
1. Go to **[dashboard.razorpay.com](https://dashboard.razorpay.com)**
2. Log in with your credentials

### Step 2: Check KYC Status
1. Left sidebar → **Settings** → **KYC**
2. Check current status — you may see "Pending" or "Not Started"

### Step 3: Decide Legal Entity
You need to pick ONE entity type. Everything (Meta, GST, bank account, website) must match this name exactly.

| If you're a... | You need | Document |
|:----------------|:---------|:---------|
| **Sole proprietor** | PAN card + Aadhaar + bank statement | Simplest, fastest |
| **Private Ltd company** | CoI + MoA/AoA + PAN of directors | More credible but slower |

### Step 4: Submit Documents
Upload these in the Razorpay KYC form:

**For Sole Proprietorship:**
- [ ] PAN card (your personal PAN)
- [ ] Aadhaar card (front + back)
- [ ] Bank account proof (cancel cheque or bank statement — must match the PAN holder)
- [ ] Address proof (Aadhaar works for this too)

**For Private Limited:**
- [ ] Certificate of Incorporation (CoI)
- [ ] Memorandum of Association (MoA)
- [ ] PAN card of the company
- [ ] PAN card of at least one director
- [ ] Board resolution authorizing the account
- [ ] Bank statement of the company account

### Step 5: Verify Bank Account
1. Razorpay will send ₹1 to your bank account (micro-deposit verification)
2. Check your bank statement in 1-2 business days
3. Enter the exact amount deposited in Razorpay dashboard

### Step 6: Wait for Approval
- Usually takes **3-7 business days**
- Check **Settings → KYC** for status updates
- If rejected: read the reason, fix the mismatch, resubmit

### ✅ Completion Criteria
- [ ] KYC status shows **"Verified"** or **"Approved"** in Razorpay dashboard
- [ ] Payouts are enabled (Settings → Payouts)

---

## 🔴 PRIORITY 2 — GST Decision (Do This Week)

**Why:** Your pricing page says "18% GST applies" — you need to either confirm or remove that line.

### Step 1: Understand Your Options

| Option | When to Choose | Impact |
|:-------|:---------------|:-------|
| **Register for GST now** | You plan to charge >₹20L/yr OR want to look professional | Charge 18% GST on invoices. More credible. |
| **Stay under threshold** | You're just starting and won't hit ₹20L/yr this year | Remove the "18% GST" line from pricing page. Simpler. |
| **Register but don't charge GST yet** | For an LLP/Company that wants GSTIN on invoices | Some brokers expect GSTIN — check with your CA |

### Step 2: Talk to a CA
Call your Chartered Accountant and ask:

> "I'm launching a SaaS product (SAC code 9983). Monthly pricing is ₹18K / ₹35K / ₹60K.
> Should I register for GST now or stay under the ₹20L/yr threshold?
> What entity type do you recommend — sole proprietor or private limited?"

### Step 3: Update the Code (After Decision)
Tell me the decision and I'll:
- If **registered**: Keep "18% GST applies" + add GSTIN to invoices
- If **not registering**: Remove the GST line from the pricing page

### ✅ Completion Criteria
- [ ] You've spoken to a CA
- [ ] You've decided on entity type + GST registration
- [ ] You've told me the decision so I can update the code

---

## 🔴 PRIORITY 3 — WhatsApp Business Verification (Do This Week)

**Why:** Without it, your WhatsApp display name stays "PENDING_REVIEW" and message limits stay low.

> **Full guide:** `sales/whatsapp-business-verification.md`

### Step 1: Decide Legal Entity Name
Must match what you chose in Razorpay KYC (Priority 1, Step 3).
Everything below uses this exact name.

### Step 2: Update Website Footer
The landing page must show your legal entity name + registered address.

1. Go to the landing page (your Vercel domain)
2. Scroll to footer — it currently says "© 2026 Converza"
3. **I need to add:** Legal entity name + registered address to the footer
   → Tell me the exact entity name and address

### Step 3: Meta Business Manager Setup
1. Go to **[business.facebook.com](https://business.facebook.com)**
2. Settings → **Business Info**
3. Enter:
   - **Legal Business Name:** [your entity name — must match GST/CoI exactly]
   - **Address:** [registered address — must match GST/CoI]
   - **Phone:** your business phone
   - **Website:** your Converza domain
4. Add the WhatsApp Business Account (+91 72088 55916) to this Business Manager

### Step 4: Submit for Verification
1. Business Manager → **Security Center** → click **Start Verification**
2. Upload business document (GST cert / CoI / MSME — whichever matches your entity name)
3. Complete the verification code step:
   - Meta sends a code to your registered address, OR
   - Meta calls the registered phone number
   - Have the legal contact person available to receive it

### Step 5: Wait for Approval
- Usually **2-5 business days**
- Check **Security Center** for status
- If rejected: read the reason, fix the mismatch, resubmit

### Step 6: Confirm Display Name
After verification:
1. Go to **WhatsApp Manager** → your phone number
2. Confirm display name changed from "PENDING_REVIEW" → approved
3. Check daily message limits increased

### ✅ Completion Criteria
- [ ] Meta Business Manager has your correct legal entity name
- [ ] Business verification is submitted (can be pending)
- [ ] WhatsApp display name is approved
- [ ] Daily message limits are adequate

---

## 🟡 PRIORITY 4 — MessageBird Sender ID (Do When You Can)

**Why:** SMS fallback won't work until the sender ID is approved by Indian telecom operators.

### Step 1: Register Sender ID
1. Go to **[dashboard.messagebird.com](https://dashboard.messagebird.com)**
2. Left sidebar → **SMS** → **Senders**
3. Click **Add Sender**
4. Enter:
   - **Sender ID:** `CONVERZ`
   - **Description:** `Converza AI calling platform`
5. Submit for approval

### Step 2: Wait for Approval
- Indian sender IDs take **24-48 hours** to approve
- Check the Senders page for status
- If rejected: try `CONVRZA` or `CVRZA` (shorter alternatives)

### Step 3: Add to Render
1. Go to **[render.com/dashboard](https://render.com/dashboard)**
2. Click your **leadbridge-api** service
3. **Environment** tab → Add:
   - `MESSAGEBIRD_API_KEY` = *(paste from MessageBird dashboard → Developers → API keys)*
   - `SMS_SENDER_ID` = `CONVERZ`
4. Save → Render auto-redeploys

### ✅ Completion Criteria
- [ ] Sender ID `CONVERZ` is approved in MessageBird
- [ ] Both env vars are set in Render
- [ ] Render has redeployed successfully

---

## 🟡 PRIORITY 5 — Uptime Monitoring (5 Minutes)

**Why:** If the site goes down, nobody gets paged. You won't know until a broker complains.

### Step 1: Sign up for UptimeRobot
1. Go to **[uptimerobot.com](https://uptimerobot.com)**
2. Sign up (free — 50 monitors included)

### Step 2: Add Monitor
1. Click **Add New Monitor**
2. Fill in:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** `Converza API Health`
   - **URL:** `https://your-render-domain.onrender.com/health`
   - **Monitoring Interval:** 5 minutes
3. Click **Create Monitor**

### Step 3: Configure Alerts
1. Go to **My Settings** → **Alert Contacts**
2. Add your email address
3. Set **Alert When:** "Down" (default)
4. Set **Alert After:** 2 consecutive failures (avoids false alarms)

### ✅ Completion Criteria
- [ ] UptimeRobot monitor is green/active
- [ ] You receive a test alert when the site goes down

---

## 🟢 PRIORITY 6 — Payment Loop Test (After KYC Clears)

**Why:** Proves the entire checkout → activation → invoice → cancellation flow works end-to-end.

> **Full spec:** `sales/payment-loop-test.md`

### Preconditions
- [ ] Razorpay KYC is verified (Priority 1 complete)
- [ ] Razorpay webhook is configured:
  1. Razorpay Dashboard → **Settings** → **Webhooks**
  2. Add webhook URL: `https://your-render-domain.onrender.com/api/v1/webhooks/razorpay`
  3. Select events: `subscription.charged`, `subscription.cancelled`, `payment.failed`, `invoice.paid`
  4. Save — copy the webhook secret → add to Render env as `RAZORPAY_WEBHOOK_SECRET`

### Test Steps (Follow the spec)
1. **Register** a test broker account on the live site
2. **Start trial** (14-day, STARTER plan, no charge)
3. **Upgrade to GROWTH** → Razorpay checkout opens
4. **Pay with real UPI/card** (₹35,000 — gets refunded later)
5. **Verify webhook fired** → check server logs for "webhook received"
6. **Check dashboard** → plan shows ACTIVE, invoice shows PAID
7. **Cancel subscription** → verify CANCELLED status
8. **Refund** the payment in Razorpay dashboard
9. **Delete test account** using Settings → Privacy → Erasure

### ✅ Completion Criteria
- [ ] Trial → Upgrade → Payment → Invoice → Cancel → Refund all work
- [ ] No errors in server logs
- [ ] Test account deleted

---

## 🟢 PRIORITY 7 — Record Demo Call (After Everything Works)

**Why:** You need 1 recorded AI call to show prospects what the product actually does.

### Steps
1. Make sure the live system is fully working
2. Go to dashboard → **Voice AI** → **Test Call**
3. The AI will call your phone
4. Have a natural conversation (ask about properties, budget, location)
5. The AI will qualify you and offer to book a visit
6. After the call, go to **Calls** → find the recording
7. Download the recording + transcript

### ✅ Completion Criteria
- [ ] 1 real AI call recorded and playable
- [ ] Transcript looks good
- [ ] You have demo material to show prospects

---

## 📅 Suggested Timeline

```
WEEK 1:
  Mon-Tue:  Razorpay KYC (Priority 1) + GST decision (Priority 2)
  Wed-Thu:  WhatsApp verification submission (Priority 3)
  Fri:      MessageBird sender ID (Priority 4) + UptimeRobot (Priority 5)

WEEK 2:
  Mon:      Check KYC status — if approved, run payment loop test (Priority 6)
  Tue-Wed:  Record demo call (Priority 7) + Fix any issues found
  Thu-Fri:  Ready to onboard first broker
```

---

## 📞 Questions? Come Back To Me

When you complete each priority, come back and tell me:
- **Priority 1 done** → I'll verify Razorpay is working
- **Priority 2 done** → I'll update the pricing page
- **Priority 3 done** → I'll update the website footer with your entity name
- **Priority 4 done** → I'll verify SMS is configured
- **Priority 5 done** → I'll verify the health endpoint
- **Priority 6 done** → I'll help debug any test failures
- **Priority 7 done** → I'll help polish the demo material
