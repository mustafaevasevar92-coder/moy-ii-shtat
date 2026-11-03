// Создаёт платёж в ЮKassa и возвращает ссылку на страницу оплаты (ключ — переменная YK_SECRET в Vercel).
// Секретный ключ берётся из переменной окружения YK_SECRET (задаётся в Vercel, в коде его нет).
const crypto = require('crypto');

const PLANS = {
  start: { name: 'Старт', price: '3990.00' },
  self:  { name: 'Самостоятельный', price: '12900.00' },
  group: { name: 'Групповой', price: '19900.00' },
  personal: { name: 'Личный', price: '49900.00' },
};

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ error: 'method' }); return; }
  const secret = process.env.YK_SECRET;
  const shopId = process.env.YK_SHOP_ID || '1515872';
  if (!secret) { res.status(503).json({ error: 'not_configured' }); return; }

  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const plan = PLANS[body.plan];
  const email = String(body.email || '').trim().slice(0, 120);
  const tg = String(body.tg || '').trim().slice(0, 64);
  if (!plan) { res.status(400).json({ error: 'plan' }); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(400).json({ error: 'email' }); return; }

  const host = req.headers['x-forwarded-host'] || req.headers.host || 'moy-ii-shtat.vercel.app';
  const payload = {
    amount: { value: plan.price, currency: 'RUB' },
    capture: true,
    confirmation: { type: 'redirect', return_url: `https://${host}/spasibo.html` },
    description: `Курс «Мой ИИ-штат», тариф «${plan.name}»`,
    metadata: { plan: plan.name, email, tg },
  };
  if (process.env.YK_RECEIPT === '1') {
    payload.receipt = {
      customer: { email },
      items: [{
        description: `Онлайн-курс «Мой ИИ-штат», тариф «${plan.name}»`,
        quantity: '1.00',
        amount: { value: plan.price, currency: 'RUB' },
        vat_code: Number(process.env.YK_VAT_CODE || 1),
        payment_mode: 'full_payment',
        payment_subject: 'service',
      }],
    };
  }

  try {
    const r = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotence-Key': crypto.randomUUID(),
        Authorization: 'Basic ' + Buffer.from(`${shopId}:${secret}`).toString('base64'),
      },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!r.ok || !data.confirmation) {
      console.error('yookassa error', r.status, data && data.code, data && data.description);
      res.status(502).json({ error: 'gateway', status: r.status, code: data && data.code, parameter: data && data.parameter });
      return;
    }
    res.status(200).json({ url: data.confirmation.confirmation_url });
  } catch (e) {
    console.error('yookassa fetch failed', e && e.message);
    res.status(502).json({ error: 'gateway' });
  }
};
