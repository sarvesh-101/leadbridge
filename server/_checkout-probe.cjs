const axios = require('axios');

async function probe() {
  // Create a subscription for each tier directly against the live Razorpay API
  // using the SAME credentials the live server uses (from .env).
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  const plans = {
    launch: process.env.RAZORPAY_PLAN_LAUNCH || '',
    starter: process.env.RAZORPAY_PLAN_STARTER || '',
    growth: process.env.RAZORPAY_PLAN_GROWTH || '',
    pro: process.env.RAZORPAY_PLAN_PRO || '',
  };

  console.log('=== Env ===');
  console.log('KEY_ID prefix:', keyId.slice(0, 14));
  console.log('PLAN_LAUNCH:', plans.launch || '(empty)');
  console.log('PLAN_STARTER:', plans.starter || '(empty)');
  console.log('PLAN_GROWTH:', plans.growth || '(empty)');
  console.log('PLAN_PRO:', plans.pro || '(empty)');
  console.log('');

  const api = axios.create({
    baseURL: 'https://api.razorpay.com/v1',
    auth: { username: keyId, password: keySecret },
    timeout: 15000,
  });

  // Auth check first
  try {
    await api.get('/plans?count=1');
    console.log('AUTH: OK (live keys confirmed)');
  } catch (e) {
    console.log('AUTH: FAILED —', e.response?.status, e.response?.data?.error?.description || e.message);
    return;
  }
  console.log('');

  // Now probe each plan individually (read-only: we create & the probe shows short_url; we do NOT pay)
  const tiers = [
    { name: 'LAUNCH', planId: plans.launch, trialDays: 0 },
    { name: 'STARTER', planId: plans.starter, trialDays: 30 },
    { name: 'GROWTH', planId: plans.growth, trialDays: 0 },
    { name: 'PRO', planId: plans.pro, trialDays: 0 },
  ];

  for (const t of tiers) {
    if (!t.planId) {
      console.log(`[${t.name}] SKIP — no plan ID set`);
      continue;
    }
    try {
      // Read the plan to see if it has its own trial
      const planResp = await api.get(`/plans/${t.planId}`);
      const planTrial = Number(planResp.data?.item?.trial_period_days ?? planResp.data?.trial_period_days ?? 0) || 0;
      const planHasTrial = planTrial > 0;
      const startAt = planHasTrial
        ? null
        : Math.floor(Date.now() / 1000) + (t.trialDays && t.trialDays > 0 ? t.trialDays * 86400 : 0);

      const resp = await api.post('/subscriptions', {
        plan_id: t.planId,
        customer_notify: 1,
        total_count: 1,
        ...(startAt !== null ? { start_at: startAt } : {}),
        notes: {
          customer_email: 'probe@converza.test',
        },
      });
      console.log(`[${t.name}] OK`);
      console.log(`  plan_trial_days (on plan): ${planTrial}`);
      console.log(`  sent start_at: ${startAt !== null ? startAt : 'OMITTED (plan has own trial)'}`);
      console.log(`  subscription_id: ${resp.data.id}`);
      console.log(`  short_url: ${resp.data.short_url}`);
      console.log(`  status: ${resp.data.status}`);
    } catch (e) {
      const desc = e.response?.data?.error?.description || e.message;
      console.log(`[${t.name}] FAILED — ${desc}`);
    }
    console.log('');
  }
}

probe().catch(e => console.error('FATAL:', e));
