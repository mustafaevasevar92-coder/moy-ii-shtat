// Статус платежа для окна оплаты с QR (id платежа — случайный, ключ магазина остаётся на сервере).
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const id = String((req.query && req.query.id) || '');
  const secret = process.env.YK_SECRET;
  const shopId = process.env.YK_SHOP_ID || '1515872';
  if (!secret || !/^[\w-]{10,64}$/.test(id)) { res.status(400).json({ error: 'bad_request' }); return; }
  try {
    const r = await fetch('https://api.yookassa.ru/v3/payments/' + id, {
      headers: { Authorization: 'Basic ' + Buffer.from(`${shopId}:${secret}`).toString('base64') },
    });
    const d = await r.json();
    if (!r.ok) { res.status(502).json({ error: 'gateway' }); return; }
    res.status(200).json({ status: d.status, paid: !!d.paid });
  } catch (e) { res.status(502).json({ error: 'gateway' }); }
};
