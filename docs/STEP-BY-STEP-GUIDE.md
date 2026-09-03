# 🚀 Converza — Step-by-Step Operational Guide

> **Follow this guide in order.** Each step has exact URLs, exact buttons to click, and exact things to type. Don't skip steps.

---

## STEP 1: Razorpay KYC (30 minutes + 3-7 day wait)

**Goal:** Get your Razorpay account verified so you can receive payments.

### 1.1 Log into Razorpay
1. Open browser → go to **https://dashboard.razorpay.com**
2. Enter your email + password → click **Login**
3. If asked for OTP → check your phone/email → enter the code

### 1.2 Check Current Status
1. Left sidebar → scroll down → click **Settings**
2. Click **KYC** (or "Business Verification")
3. Note the current status:
   - If it says **"Verified"** or **"Approved"** → you're done, skip to Step 2
   - If it says **"Pending"** or **"Not Started"** → continue below

### 1.3 Decide Your Legal Entity
You need to pick ONE of these. Everything (Meta, GST, bank account) must use this exact name.

**Option A — Sole Proprietorship (easiest, fastest):**
- Your personal name is the business
- Documents needed: PAN card + Aadhaar + bank statement
- GST: Only needed if revenue > ₹20L/yr

**Option B — Private Limited Company (more professional):**
- Company name is the business
- Documents needed: CoI + MoA + Company PAN + Director PAN
- GST: Recommended

**Write down your choice here:**
```
Legal entity name: _______________________
Entity type:       _______________________ (Sole Prop / Pvt Ltd)
PAN holder name:   _______________________
```

### 1.4 Submit KYC Documents
1. In Razorpay KYC page → click **Submit Documents** (or "Start Verification")
2. Fill in the form:

**Personal/Business Details:**
- **Legal Name:** [exact name from your GST/CoI certificate — type it EXACTLY]
- **Business Type:** Select "Sole Proprietorship" or "Private Limited"
- **PAN Number:** [your PAN number — 10 characters like ABCDE1234F]
- **PAN Holder Name:** [name as printed on PAN card]

**Address:**
- **Registered Address:** [full address as on GST/CoI — same format]
- **City:** ________
- **State:** ________
- **Pincode:** ________

**Bank Account:**
- **Account Number:** [your bank account number]
- **IFSC Code:** [your bank IFSC, e.g., SBIN0001234]
- **Account Holder Name:** [must match PAN holder name exactly]
- Upload a **cancelled cheque** or **bank statement** (PDF/image)

3. Click **Submit** (or "Verify")

### 1.5 Complete Micro-Deposit Verification
1. Razorpay sends ₹1 to your bank account (within 24-48 hours)
2. Check your bank statement (app/netbanking)
3. Find the ₹1 credit from Razorpay — note the **exact amount** (might be ₹0.01 or ₹1.00)
4. Go back to Razorpay → Settings → KYC → enter the exact amount
5. Click **Verify**

### 1.6 Wait for Approval
- Status shows "Under Review" → wait **3-7 business days**
- Check daily: Settings → KYC → Status
- If approved → move to Step 2
- If rejected → read the reason, fix, resubmit

### ✅ Step 1 Complete When:
- [ ] KYC status shows "Verified" or "Approved"
- [ ] You can see "Payouts" section in Settings (means payouts are enabled)

---

## STEP 2: Talk to Your CA About GST (15 minute call)

**Goal:** Decide whether to register for GST or stay under the threshold.

### 2.1 Prepare for the Call
Before calling your CA, have this info ready:

```
Product: SaaS platform (software as a service)
SAC Code: 9983 (IT services)
Monthly pricing: ₹18,000 / ₹35,000 / ₹60,000
Expected revenue first year: ₹_____ (your estimate)
```

### 2.2 What to Ask Your CA
Call your CA and say:

> "Hi, I'm launching a SaaS product for real estate brokers. 
> It's a monthly subscription — ₹18K, ₹35K, ₹60K plans.
> SAC code is 9983. Should I:
> 
> (a) Register for GST now and charge 18% GST?
> (b) Stay under the ₹20L/yr threshold and not charge GST?
> (c) Something else you recommend?
> 
> Also — sole proprietorship or private limited company — which is better for my situation?"

### 2.3 Record the Decision
Write down what your CA says:

```
CA Recommendation: _______________________
Entity type:       _______________________
GST required:      Yes / No
GSTIN:             _______________________ (if registered)
```

### 2.4 Tell Me the Decision
Come back to this chat and say:
- "My CA said [decision]"
- "My legal entity name is [name]"
- "My registered address is [address]"

**I will then:**
- Update the website footer with your entity name + address
- Update the pricing page (add/remove GST line as needed)
- Update any legal documents

### ✅ Step 2 Complete When:
- [ ] You've spoken to your CA
- [ ] You've decided entity type + GST registration
- [ ] You've told me the decision

---

## STEP 3: WhatsApp Business Verification (1 hour + 2-5 day wait)

**Goal:** Get Meta to verify your business so WhatsApp messages are trusted.

> **BLOCKED until you complete Step 2** — you need the legal entity name.

### 3.1 Open Meta Business Manager
1. Open browser → go to **https://business.facebook.com**
2. Log in with your Facebook account (use the one connected to your WhatsApp Business)
3. If asked to select a business → select yours (or create one)

### 3.2 Set Business Info
1. Left sidebar → **Settings** (gear icon at bottom)
2. Click **Business Info** (under "Business Settings")
3. Fill in EVERY field exactly as on your GST/CoI:

```
Legal Business Name: [EXACT name from GST/CoI — no shortcuts]
Business Address:    [EXACT registered address]
Business Phone:      [your business phone number]
Website:             [your Converza domain, e.g., https://leadbridge-seven.vercel.app]
```

4. Click **Save**

### 3.3 Add WhatsApp Business Account
1. Still in Business Settings → left sidebar → **WhatsApp Accounts**
2. Click **Add** → select your WhatsApp Business Account (+91 72088 55916)
3. If it's already there → confirm it's connected

### 3.4 Submit Business Verification
1. In Business Settings → click **Security Center**
2. Click **Start Verification** (or "Verify Business")
3. You'll see a form:

**Business Details:**
- **Legal Name:** [same as Step 3.2 — MUST match exactly]
- **Country:** India
- **Business Type:** Select "Technology" or "Software"
- **Registration Number:** [your GST number / CoI number / MSME number]

4. Click **Next**

### 3.5 Upload Business Documents
Upload ONE of these (whichever matches your entity type):

**For Sole Proprietorship:**
- GST Certificate (if registered), OR
- MSME/Udyam Certificate, OR
- Aadhaar card (if no GST/MSME)

**For Private Limited:**
- Certificate of Incorporation (CoI), OR
- GST Certificate (if registered)

**How to upload:**
1. Click **Upload Document** (or "Choose File")
2. Select the PDF/image from your computer
3. Make sure the document is **clear and readable** (no blurry photos)
4. The **name on the document MUST match** the Legal Name you entered above

5. Click **Next**

### 3.6 Verification Code
Meta will verify you own the business. They'll use ONE of these methods:

**Option A — Phone Call:**
1. Meta calls the phone number listed on your business document
2. Answer the call → listen for a 4-digit code
3. Enter the code on the verification page

**Option B — Email:**
1. Meta sends a code to the email on your business document
2. Check your email → find the code
3. Enter the code on the verification page

**Option C — Business Document:**
1. Meta asks you to re-upload a document with specific details
2. Follow the on-screen instructions

4. Enter the verification code → click **Submit**

### 3.7 Wait for Results
1. Go to **Security Center** → you'll see "Verification in Progress"
2. Wait **2-5 business days**
3. Check daily: Security Center → Status

**If approved:**
- Go to **WhatsApp Manager** → your phone number
- Display name should change from "PENDING_REVIEW" → "Approved"
- Daily message limits should increase

**If rejected:**
- Read the rejection reason (shown in Security Center)
- Common fixes:
  - "Name mismatch" → make the name on website exactly match GST/CoI
  - "Website missing business info" → I need to add your entity name to the footer
  - "Document unclear" → re-upload a clearer photo/scan
- Fix the issue → resubmit (you get ~2-3 attempts)

### ✅ Step 3 Complete When:
- [ ] Business verification is submitted (even if still "Pending")
- [ ] Display name shows "Approved" (or at least "Pending" — not "Rejected")
- [ ] You've checked for rejection and fixed any issues

---

## STEP 4: MessageBird Sender ID (5 minutes + 24-48 hour wait)

**Goal:** Register a sender ID so SMS messages show "CONVERZ" instead of a random number.

### 4.1 Log into MessageBird
1. Go to **https://dashboard.messagebird.com**
2. Log in with your credentials

### 4.2 Navigate to Senders
1. Left sidebar → click **SMS**
2. Click **Senders** (or "Sender IDs")
3. Click **Add Sender** (or "Create Sender")

### 4.3 Fill in the Form
```
Sender ID:     CONVERZ
Description:   Converza AI calling platform
Country:       India
```

### 4.4 Submit for Approval
1. Click **Submit** (or "Create")
2. You'll see "Pending Approval" status
3. Indian sender IDs take **24-48 hours** to approve

### 4.5 Add to Render (After Approval)
1. Go to **https://render.com/dashboard**
2. Click your **leadbridge-api** service
3. Left sidebar → **Environment**
4. Click **Add Environment Variable**
5. Add these TWO variables (one at a time):

| Key | Value |
|:----|:------|
| `MESSAGEBIRD_API_KEY` | *(paste from MessageBird dashboard → Developers → API keys)* |
| `SMS_SENDER_ID` | `CONVERZ` |

6. Click **Save** → Render auto-redeploys (~2 min)

### ✅ Step 4 Complete When:
- [ ] Sender ID "CONVERZ" shows "Approved" in MessageBird
- [ ] Both env vars are added to Render
- [ ] Render has redeployed (green checkmark)

---

## STEP 5: Uptime Monitoring (5 minutes)

**Goal:** Get alerts when the site goes down.

### 5.1 Sign Up
1. Go to **https://uptimerobot.com**
2. Click **Register for FREE**
3. Enter email + password → click **Register**
4. Verify your email (check inbox → click the link)

### 5.2 Add Monitor
1. Dashboard → click **Add New Monitor**
2. Fill in:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** `Converza API Health`
   - **URL:** `https://your-render-domain.onrender.com/health`
   - **Monitoring Interval:** 5 minutes
3. Click **Create Monitor**

### 5.3 Configure Alert Contact
1. Go to **My Settings** (top right → your name → Settings)
2. Click **Alert Contacts**
3. Click **Add Alert Contact**
4. Select **Email** → enter your email → click **Save**
5. Go back to your monitor → **Edit** → set **Alert Contacts** to your email

### ✅ Step 5 Complete When:
- [ ] Monitor shows green/UP status
- [ ] You receive a test email when the site goes down

---

## STEP 6: Razorpay Webhook Setup (10 minutes)

**Goal:** Tell Razorpay to send payment events to your server.

> **Do this AFTER Step 1 (KYC) is approved**

### 6.1 Get Your Webhook Secret
1. Go to **https://dashboard.razorpay.com**
2. Left sidebar → **Settings** → **Webhooks**
3. Click **Add New Webhook** (or "Create Webhook")

### 6.2 Fill in Webhook Details
```
Webhook URL:    https://your-render-domain.onrender.com/api/v1/webhooks/razorpay
Secret:         [click "Generate" to create a random secret — copy it NOW]
Active:         Yes
```

### 6.3 Select Events
Check these boxes:
- [x] `subscription.charged`
- [x] `subscription.cancelled`
- [x] `payment.failed`
- [x] `invoice.paid`

### 6.4 Save
1. Click **Save Webhook**
2. Copy the **Webhook Secret** you generated (you won't see it again)

### 6.5 Add Secret to Render
1. Go to **https://render.com/dashboard**
2. Click your **leadbridge-api** service → **Environment**
3. Add:
   - `RAZORPAY_WEBHOOK_SECRET` = [the secret you just copied]
4. Save → Render redeploys

### ✅ Step 6 Complete When:
- [ ] Webhook shows "Active" in Razorpay dashboard
- [ ] `RAZORPAY_WEBHOOK_SECRET` is set in Render

---

## STEP 7: Payment Loop Test (20 minutes)

**Goal:** Prove the entire money path works end-to-end.

> **Do this AFTER Steps 1 + 6 are complete**

### 7.1 Register Test Account
1. Go to your live Converza site
2. Click **Register** (or go to `/auth/register`)
3. Fill in:
   - Name: `Test Broker`
   - Email: [use a disposable email you control]
   - Phone: [your real phone number]
   - Business Name: `Test Real Estate`
   - Password: [something you'll remember]
4. Click **Register**
5. Check your email → click the verification link
6. Login

### 7.2 Start Trial
1. Go to **Dashboard** → **Billing**
2. Click **Start 14-day Trial** (or "Activate Trial")
3. Confirm: plan shows "Trial", 100 calls included, no charge yet

### 7.3 Upgrade to Growth Plan
1. On the Billing page → click **Growth** plan → **Upgrade** (or "Subscribe")
2. A Razorpay checkout page opens in a new tab
3. Fill in test payment:
   - **Amount:** ₹35,000 (auto-filled)
   - **Payment method:** UPI or Card
   - **UPI:** Use any UPI ID you control
   - **Card:** Use a real card (will be refunded later)
4. Complete the payment

### 7.4 Verify Activation
1. Go back to the Converza billing page
2. Refresh the page
3. Confirm:
   - [ ] Plan shows **"Growth"** (not Trial)
   - [ ] Status shows **"Active"**
   - [ ] 500 calls/month available
   - [ ] You received an invoice email

### 7.5 Check Server Logs
1. Go to Render dashboard → your service → **Logs**
2. Search for these lines (they confirm the webhook worked):
   - `webhook received` (or `razorpay.webhook`)
   - `subscription activated` (or `plan upgraded`)
   - `invoice created` and `invoice paid`

### 7.6 Cancel + Refund
1. On the Billing page → click **Cancel Subscription**
2. Confirm cancellation
3. Go to **Razorpay Dashboard** → **Subscriptions** → find your subscription
4. Click **Actions** → **Cancel and Refund** (or go to Payments → find the payment → Refund)
5. Confirm refund

### 7.7 Delete Test Account
1. On Converza → **Settings** → **Privacy & Data**
2. Click **Request data erasure**
3. Confirm
4. This deletes your test account and all data

### ✅ Step 7 Complete When:
- [ ] Trial → Upgrade → Payment → Invoice → Cancel → Refund all worked
- [ ] No errors in server logs
- [ ] Test account deleted

---

## STEP 8: Record Demo Call (5 minutes)

**Goal:** Get 1 real AI call recording to show prospects.

### 8.1 Make the Test Call
1. Login to Converza → **Dashboard** → **Voice AI**
2. Click **Test Call** (or go to `/dashboard/voice`)
3. The AI will call your phone within 30 seconds
4. Answer the call
5. Have a natural conversation:
   - AI: "Namaste! Main Converza se bol raha hoon..."
   - You: "Haan ji, maine online dekha tha property"
   - AI: Will ask about budget, location, timeline
   - You: Answer naturally
   - AI: Will offer to book a site visit
   - You: Accept or decline

### 8.2 Find the Recording
1. After the call ends → go to **Dashboard** → **Calls**
2. Find the call you just made
3. Click to open → you'll see:
   - **Recording** (playable audio)
   - **Transcript** (full text of conversation)
   - **AI Summary** (qualifications extracted)

### 8.3 Save for Demo
1. Download the recording (click download icon)
2. Screenshot the transcript + summary
3. Save these — you'll use them when talking to prospects

### ✅ Step 8 Complete When:
- [ ] 1 real AI call recorded
- [ ] You have the recording file
- [ ] You have the transcript screenshot

---

## 📅 Complete Timeline

```
DAY 1 (Today):
  ☐ Step 1: Start Razorpay KYC (30 min)
  ☐ Step 2: Call your CA about GST (15 min)

DAY 2:
  ☐ Step 3: Submit WhatsApp verification to Meta (1 hour)
  ☐ Step 4: Register MessageBird sender ID (5 min)

DAY 3:
  ☐ Step 5: Set up UptimeRobot (5 min)
  ☐ Step 6: Set up Razorpay webhook (10 min)

DAYS 4-10 (Waiting):
  ☐ Wait for Razorpay KYC approval (3-7 days)
  ☐ Wait for WhatsApp verification (2-5 days)
  ☐ Wait for MessageBird sender ID (24-48 hours)

DAY 10+ (After approvals):
  ☐ Step 7: Run payment loop test (20 min)
  ☐ Step 8: Record demo call (5 min)
  ☐ 🎉 Ready to onboard first broker!
```

---

## ❓ Stuck? Come Back To Me

If you get stuck at any step, come back here and tell me:
1. **Which step** you're on
2. **What happened** (screenshot or error message)
3. **What you see** on the screen

I'll help you debug it.
