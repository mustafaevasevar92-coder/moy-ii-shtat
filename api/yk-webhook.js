// Приём уведомлений ЮKassa (payment.succeeded). Платёж перепроверяется запросом к ЮKassa,
// затем бот получает данные и сам выдаёт доступ. Секреты: YK_SECRET, YK_SHOP_ID, PAY_SECRET (задаются в Vercel).
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ error: 'method' }); return; }
  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const id = body && body.object && body.object.id;
  if (body.event !== 'payment.succeeded' || !id || !/^[\w-]{10,64}$/.test(id)) { res.status(200).json({ ok: true, ignored: true }); return; }

  const secret = process.env.YK_SECRET;
  const shopId = process.env.YK_SHOP_ID || '1515872';
  const paySecret = process.env.PAY_SECRET;
  if (!secret || !paySecret) { console.error('webhook: not configured'); res.status(503).json({ error: 'not_configured' }); return; }

  try {
    const r = await fetch('https://api.yookassa.ru/v3/payments/' + id, {
      headers: { Authorization: 'Basic ' + Buffer.from(`${shopId}:${secret}`).toString('base64') },
    });
    const pay = await r.json();
    if (!r.ok || pay.status !== 'succeeded' || !pay.paid) { res.status(200).json({ ok: true, ignored: 'not_succeeded' }); return; }
    const m = pay.metadata || {};
    const b = await fetch('https://bot-podarkov.vercel.app/paid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Pay-Secret': paySecret },
      body: JSON.stringify({
        payment_id: pay.id,
        plan: m.plan || '',
        email: m.email || '',
        tg: m.tg || '',
        name: m.name || '',
        amount: pay.amount && pay.amount.value,
      }),
    });
    if (!b.ok) { console.error('webhook: bot answered', b.status); res.status(502).json({ error: 'bot' }); return; }
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('webhook failed', e && e.message);
    res.status(502).json({ error: 'gateway' });
  }
};
