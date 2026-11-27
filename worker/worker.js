// Бэкенд «Менеджера перевозок»: Telegram Stars (покупки) + таблица рейтинга.
// Один Cloudflare Worker + D1. Как развернуть — docs/backend.md.
// Привязки wrangler: D1 → DB. Секреты: BOT_TOKEN (обязательно), WEBHOOK_SECRET (необязательно).
// Переменная STRICT_PAYMENTS="1" — активация покупки только после подтверждения вебхуком.

const PRODUCTS = [
  { id: 'money',  title: 'Денежный перевод', desc: 'Пополнение счёта компании (раз в сутки)', stars: 25 },
  { id: 'boost',  title: 'Удвоенный доход',  desc: '×2 к оплате рейсов на 24 часа',          stars: 50 },
  { id: 'repair', title: 'ТО всего парка',   desc: 'Снимает износ со всех машин и прицепов',  stars: 15 },
  { id: 'hurry',  title: 'Ускорение рейсов', desc: 'Активные рейсы приезжают на 15 минут раньше', stars: 10 },
];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization,Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: CORS });
}

// Проверка подписи initData из Telegram WebApp: HMAC-SHA256 с токеном бота.
// Возвращает пользователя Telegram или null.
async function tgUser(initData, botToken) {
  try {
    const params = new URLSearchParams(initData || '');
    const hash = params.get('hash');
    if (!hash || !botToken) return null;
    params.delete('hash');
    const pairs = Array.from(params.entries());
    pairs.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
    const dataCheckString = pairs.map(function (p) { return p[0] + '=' + p[1]; }).join('\n');
    const enc = new TextEncoder();
    const keyRaw = await crypto.subtle.importKey('raw', enc.encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const secret = await crypto.subtle.sign('HMAC', keyRaw, enc.encode(botToken));
    const secretKey = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', secretKey, enc.encode(dataCheckString));
    const hex = Array.from(new Uint8Array(sig)).map(function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    if (hex !== hash) return null;
    const authDate = Number(params.get('auth_date')) * 1000;
    if (!authDate || Date.now() - authDate > 24 * 3600 * 1000) return null; // подпись старше суток — не принимаем
    return JSON.parse(params.get('user') || 'null');
  } catch (e) {
    return null;
  }
}

function clampInt(v, min, max, fallback) {
  v = Math.round(Number(v));
  if (!isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, v));
}

function product(id) {
  return PRODUCTS.find(function (p) { return p.id === id; }) || null;
}

async function botApi(env, method, body) {
  const res = await fetch('https://api.telegram.org/bot' + env.BOT_TOKEN + '/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === '/health') return json({ ok: true, name: 'transport-manager-backend' });
    if (request.method === 'GET' && url.pathname === '/products') return json({ ok: true, products: PRODUCTS });
    if (request.method !== 'POST') return json({ ok: false, msg: 'Метод не поддерживается' }, 405);

    let body = {};
    try { body = await request.json(); } catch (e) { body = {}; }

    // Вебхук бота: подтверждает оплату по Stars (update.message.successful_payment).
    if (url.pathname === '/tg-webhook') {
      const secret = request.headers.get('x-telegram-bot-api-secret-token');
      if (env.WEBHOOK_SECRET && secret !== env.WEBHOOK_SECRET) return json({ ok: false }, 401);

      // Предоплата: Telegram до списания звёзд спрашивает у бота подтверждение заказа.
      // Молчание дольше 10 секунд отменяет транзакцию — именно из-за этого «не проходит оплата».
      const pcq = body && body.pre_checkout_query;
      if (pcq) {
        const m = String(pcq.invoice_payload || '').split(':'); // purchase:<invoiceId>:<userId>
        let ready = false;
        if (m[0] === 'purchase' && m[1] && m[2]) {
          const inv = await env.DB.prepare(
            "SELECT id FROM invoices WHERE id = ?1 AND user_id = ?2 AND status = 'new'"
          ).bind(Number(m[1]), Number(m[2])).first();
          ready = !!inv;
        }
        await botApi(env, 'answerPreCheckoutQuery', {
          pre_checkout_query_id: pcq.id,
          ok: ready,
          error_message: ready ? undefined : 'Счёт не найден или уже оплачен'
        });
        return json({ ok: true });
      }

      const pay = body && body.message && body.message.successful_payment;
      if (pay) {
        const m = String(pay.invoice_payload || '').split(':'); // purchase:<invoiceId>:<userId>
        if (m[0] === 'purchase' && m[1] && m[2]) {
          await env.DB.prepare(
            "UPDATE invoices SET status = 'paid', paid_at = ?1 WHERE id = ?2 AND user_id = ?3 AND status = 'new'"
          ).bind(Date.now(), Number(m[1]), Number(m[2])).run();
        }
      }
      return json({ ok: true });
    }

    // Всё остальное — только для авторизованных пользователей Telegram
    const user = await tgUser(request.headers.get('Authorization'), env.BOT_TOKEN);
    if (!user || !user.id) return json({ ok: false, msg: 'Требуется Telegram' }, 401);

    const now = Date.now();
    const db = env.DB;

    // Прогресс игрока → таблица рейтинга (значения сообщает клиент, игра казуальная);
    // вместе с ним — полная резервная копия сейва (таблица saves) для восстановления,
    // если пропали и localStorage, и CloudStorage
    if (url.pathname === '/save') {
      const capital = clampInt(body.capital, 0, 1e12, 0);
      const level = clampInt(body.level, 1, 99, 1);
      const trips = clampInt(body.trips, 0, 1e6, 0);
      const name = ((user.first_name || '') + ' ' + (user.last_name || '')).trim().slice(0, 64) || 'Шеф';
      await db.prepare(
        `INSERT INTO players (id, name, capital, level, trips, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET name = ?2, capital = ?3, level = ?4, trips = ?5, updated_at = ?6`
      ).bind(user.id, name, capital, level, trips, now).run();
      const state = typeof body.state === 'string' ? body.state : '';
      if (state.length > 2 && state.length < 200000) {
        await db.prepare(
          'INSERT INTO saves (user_id, state, updated_at) VALUES (?1, ?2, ?3) ' +
          'ON CONFLICT(user_id) DO UPDATE SET state = ?2, updated_at = ?3'
        ).bind(user.id, state, now).run();
      }
      return json({ ok: true });
    }

    // Резервная копия сейва: последняя сохранённая версия (или null)
    if (url.pathname === '/restore') {
      const row = await db.prepare('SELECT state, updated_at FROM saves WHERE user_id = ?1').bind(user.id).first();
      return json({ ok: true, state: row ? row.state : null, savedAt: row ? row.updated_at : 0 });
    }

    // Бонусы игрокам (выдаёт владелец игры через INSERT в grants): отдаём и сразу помечаем выданными
    if (url.pathname === '/grant') {
      const rows = await db.prepare(
        'SELECT id, kind, amount, note FROM grants WHERE user_id = ?1 AND claimed_at IS NULL ORDER BY id'
      ).bind(user.id).all();
      const list = rows.results || [];
      if (list.length) {
        await db.prepare(
          'UPDATE grants SET claimed_at = ?1 WHERE user_id = ?2 AND claimed_at IS NULL'
        ).bind(now, user.id).run();
      }
      return json({ ok: true, grants: list });
    }

    // Топ-20 по капиталу + место текущего игрока
    if (url.pathname === '/leaderboard') {
      const top = await db.prepare(
        'SELECT id, name, capital, level, trips FROM players ORDER BY capital DESC, trips DESC LIMIT 20'
      ).all();
      const rows = (top.results || []).map(function (p) { p.me = p.id === user.id; return p; });
      const me = await db.prepare('SELECT capital FROM players WHERE id = ?1').bind(user.id).first();
      let rank = null;
      if (me) {
        const r = await db.prepare('SELECT COUNT(*) AS n FROM players WHERE capital > ?1').bind(me.capital).first();
        rank = (r ? r.n : 0) + 1;
      }
      return json({ ok: true, top: rows, me: rank ? { rank: rank, capital: me.capital } : null });
    }

    // Создать счёт на оплату Stars (createInvoiceLink у Bot API)
    if (url.pathname === '/purchase') {
      const p = product(body.productId);
      if (!p) return json({ ok: false, msg: 'Товар не найден' }, 400);
      const ins = await db.prepare(
        'INSERT INTO invoices (user_id, product, stars, status, created_at) VALUES (?1, ?2, ?3, ?4, ?5)'
      ).bind(user.id, p.id, p.stars, 'new', now).run();
      const invoiceId = ins && ins.meta ? ins.meta.last_row_id : 0;
      const link = await botApi(env, 'createInvoiceLink', {
        title: p.title,
        description: p.desc,
        payload: 'purchase:' + invoiceId + ':' + user.id,
        provider_token: '',
        currency: 'XTR',
        prices: [{ label: p.title, amount: p.stars }]
      });
      if (!link || !link.ok) {
        await db.prepare('DELETE FROM invoices WHERE id = ?1').bind(invoiceId).run();
        return json({ ok: false, msg: 'Не удалось создать счёт' }, 502);
      }
      return json({ ok: true, invoiceId: invoiceId, url: link.result });
    }

    // Активировать оплаченный счёт (один раз)
    if (url.pathname === '/purchase/claim') {
      const invoiceId = clampInt(body.invoiceId, 1, 1e9, 0);
      let row = await db.prepare('SELECT * FROM invoices WHERE id = ?1 AND user_id = ?2').bind(invoiceId, user.id).first();
      if (!row) return json({ ok: false, msg: 'Счёт не найден' }, 404);
      if (row.status === 'claimed') return json({ ok: false, msg: 'Уже активировано' });
      // строгий режим: подтверждение оплаты приходит вебхуком и может опоздать на секунду-другую — ждём его
      if (env.STRICT_PAYMENTS === '1' && row.status === 'new') {
        for (let i = 0; i < 5; i++) {
          await new Promise(function(r){ setTimeout(r, 1300); });
          row = await db.prepare('SELECT * FROM invoices WHERE id = ?1 AND user_id = ?2').bind(invoiceId, user.id).first();
          if (!row || row.status !== 'new') break;
        }
      }
      if (!row || row.status !== 'paid') return json({ ok: false, msg: 'Оплата ещё не подтверждена', pending: true }, 409);
      const upd = await db.prepare(
        "UPDATE invoices SET status = 'claimed', claimed_at = ?1 WHERE id = ?2 AND status = 'paid'"
      ).bind(now, invoiceId).run();
      if (!upd || !upd.meta || upd.meta.changes < 1) return json({ ok: false, msg: 'Уже активировано' });
      return json({ ok: true, productId: row.product });
    }

    // Оплаченные, но не забранные покупки (приложение закрыли сразу после оплаты) — добираем на старте
    if (url.pathname === '/purchase/pending') {
      const rows = await db.prepare(
        "SELECT id, product FROM invoices WHERE user_id = ?1 AND status = 'paid' ORDER BY id"
      ).bind(user.id).all();
      return json({ ok: true, invoices: rows.results || [] });
    }

    // Реферальная программа: новый игрок докладывает «меня пригласили» — одна запись на игрока,
    // самоприглашение исключено; сумму награды считает клиент (refBonusInvite в js/data.js)
    if (url.pathname === '/refer') {
      const ref = clampInt(body.referrer, 1, 1e12, 0);
      if (!ref || ref === user.id) return json({ ok: false, msg: 'Некорректный пригласивший' });
      const ins = await db.prepare(
        'INSERT INTO referrals (referee, referrer, created_at) VALUES (?1, ?2, ?3) ' +
        'ON CONFLICT(referee) DO NOTHING'
      ).bind(user.id, ref, now).run();
      const first = !!(ins && ins.meta && ins.meta.changes > 0);
      return json({ ok: true, first: first });
    }

    // Награда пригласившему: сколько друзей уже начали играть и ещё не оплачены;
    // сразу помечаем выданными (одноразово), счётчик total — для карточки «Ещё»
    if (url.pathname === '/refclaim') {
      const pend = await db.prepare(
        'SELECT COUNT(*) AS n FROM referrals WHERE referrer = ?1 AND credited_at IS NULL'
      ).bind(user.id).first();
      const count = pend ? pend.n : 0;
      if (count > 0) {
        await db.prepare(
          'UPDATE referrals SET credited_at = ?1 WHERE referrer = ?2 AND credited_at IS NULL'
        ).bind(now, user.id).run();
      }
      const tot = await db.prepare(
        'SELECT COUNT(*) AS n FROM referrals WHERE referrer = ?1'
      ).bind(user.id).first();
      return json({ ok: true, count: count, total: tot ? tot.n : 0 });
    }

    return json({ ok: false, msg: 'Не найдено' }, 404);
  }
};
