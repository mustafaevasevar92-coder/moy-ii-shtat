// Отдаёт базу шаблонов только по личной ссылке: /biblioteka/?e=<почта в base64url>&t=<подпись>.
// Подпись = HMAC-SHA256(LIB_SECRET, почта в нижнем регистре), первые 32 hex-символа.
// Пока переменная LIB_SECRET в Vercel не задана, страница открыта (режим прототипа).
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function sign(secret, email) {
  return crypto.createHmac('sha256', secret).update(String(email).trim().toLowerCase()).digest('hex').slice(0, 32);
}

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const secret = process.env.LIB_SECRET;
  if (secret) {
    const q = req.query || {};
    let email = '';
    try { email = Buffer.from(String(q.e || ''), 'base64url').toString('utf8'); } catch (e) {}
    const t = String(q.t || '');
    const ok = email && t.length === 32 &&
      crypto.timingSafeEqual(Buffer.from(sign(secret, email)), Buffer.from(t));
    if (!ok) {
      res.status(403).setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><body style="font-family:sans-serif;background:#151A3E;color:#fff;text-align:center;padding:15vh 24px"><h2>База шаблонов «Мой ИИ-штат»</h2><p>Доступ по личной ссылке после оплаты тарифа.</p><p><a style="color:#00f0ff" href="/">На главную</a></p>');
      return;
    }
  }
  const html = fs.readFileSync(path.join(__dirname, '..', 'private', 'biblioteka.html'), 'utf8');
  res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
};
