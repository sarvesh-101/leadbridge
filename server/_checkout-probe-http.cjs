const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.get({
      hostname: 'leadbridge-zy4o.onrender.com',
      port: 80,
      path: path,
      headers: { 'User-Agent': 'checkout-probe' },
    }, res => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch { resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString().slice(0, 2000) }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function main() {
  console.log('=== GET /health/razorpay ===');
  try {
    const r = await get('/health/razorpay');
    console.log('status:', r.status);
    console.log('body:', JSON.stringify(r.body, null, 2));
  } catch (e) { console.log('ERROR:', e.message); }

  console.log('');
  console.log('=== GET /health/integrations (razorpay part) ===');
  try {
    const r = await get('/health/integrations');
    console.log('status:', r.status);
    const body = typeof r.body === 'object' ? r.body : {};
    console.log('razorpay:', JSON.stringify(body.integrations?.razorpay ?? body, null, 2));
  } catch (e) { console.log('ERROR:', e.message); }
}

main().catch(e => console.error('FATAL:', e));
