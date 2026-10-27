// Probe the live server's checkout endpoint directly — this uses the server's
// own (production) credentials, so it's the truest test of what the dashboard will do.
const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'leadbridge-zy4o.onrender.com',
      port: 80,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, res => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch { resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const tiers = [
    { name: 'LAUNCH', planId: 'plan_LAUNCH' },   // placeholder; the server resolves from its env
    { name: 'STARTER', planId: 'plan_STARTER' },
    { name: 'GROWTH', planId: 'plan_GROWTH' },
    { name: 'PRO', planId: 'plan_PRO' },
  ];

  // We can't call the real checkout endpoint without auth, so instead probe the
  // public /health/integrations which tells us exactly which tiers are wired.
  // And probe /health/razorpay to confirm auth.
  try {
    const h1 = await post('/health/razorpay', {});
    console.log('/health/razorpay:', JSON.stringify(h1.body, null, 2));
  } catch (e) { console.log('/health/razorpay ERROR:', e.message); }

  try {
    const h2 = await post('/health/integrations', {});
    console.log('');
    console.log('/health/integrations.razorpay:', JSON.stringify(h2.body.integrations?.razorpay, null, 2));
  } catch (e) { console.log('/health/integrations ERROR:', e.message); }
}

main().catch(e => console.error('FATAL:', e));
