# Бэкенд: Telegram Stars + таблица рейтинга

Один **Cloudflare Worker + D1** (worker/). Клиент общается с ним из [js/net.js](../js/net.js); пока адрес воркера не вписан в `BACKEND_URL`, магазин и рейтинг в игре не показываются — игра работает полностью локально, как раньше.

## Что делает воркер

| Endpoint | Метод | Назначение |
|---|---|---|
| `/health` | GET | Проверка, что воркер жив |
| `/products` | GET | Список товаров и цены (⭐) |
| `/save` | POST | Прогресс игрока (капитал/уровень/рейсы) → таблица рейтинга |
| `/leaderboard` | POST | Топ-20 по капиталу + место игрока |
| `/purchase` | POST | Создать счёт Telegram Stars (`createInvoiceLink`) |
| `/purchase/claim` | POST | Активировать оплаченный счёт (один раз) |
| `/tg-webhook` | POST | Вебхук бота: помечает счёт оплаченным |

Авторизация клиентских запросов — по подписи `Telegram.WebApp.initData` (HMAC-SHA256 с токеном бота, подпись старше 24 часов отвергается). Имя в рейтинге берётся из Telegram-профиля.

## Развёртывание (однократно, ~15 минут)

1. **Аккаунт Cloudflare** (бесплатного тарифа достаточно): [dash.cloudflare.com](https://dash.cloudflare.com), регистрация по почте.

2. **wrangler** (CLI Cloudflare) — нужен Node.js:
   ```
   npm install -g wrangler
   wrangler login
   ```

3. **База D1** — в папке `worker/`:
   ```
   wrangler d1 create transport-manager
   ```
   Выведенный `database_id` впиши в [worker/wrangler.toml](../worker/wrangler.toml).

4. **Схема**:
   ```
   wrangler d1 execute transport-manager --remote --file=worker/schema.sql
   ```

5. **Токен бота** (из @BotFather) как секрет:
   ```
   wrangler secret put BOT_TOKEN
   ```

6. **Деплой** из папки `worker/`:
   ```
   wrangler deploy
   ```
   Получишь адрес вида `https://transport-manager-backend.<твой-сабдомен>.workers.dev`.

7. **Подключить игру**: впиши адрес в `BACKEND_URL` в [js/net.js](../js/net.js) (первая строка внутри функции) и опубликуй сайт (`git push`).

8. Проверка: открой `https://<адрес>/health` — должен ответить `{"ok":true}`.

### Вебхук оплат (необязательно, но рекомендуется)

Ставит покупкам статус «paid» из обновлений бота и позволяет включить строгий режим:

1. Придумай случайный `WEBHOOK_SECRET` (любая строка) и задай его:
   ```
   wrangler secret put WEBHOOK_SECRET
   ```
2. Пропиши вебхук боту (вместо `<TOKEN>` и `<адрес>`):
   ```
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<адрес>/tg-webhook&secret_token=<WEBHOOK_SECRET>"
   ```
3. Для строгой проверки оплат раскомментируй в [worker/wrangler.toml](../worker/wrangler.toml):
   ```toml
   [vars]
   STRICT_PAYMENTS = "1"
   ```
   — тогда `/purchase/claim` активирует покупку только после подтверждения вебхуком. Без вебхука и строгого режима активация происходит по колбэку `paid` от клиента (двойная активация одного счёта исключена — статус хранится в D1).

### Возвраты

Stars-платежи можно вернуть через Bot API `refundStarPayment` (user_id + charge_id из обновления `successful_payment`) — при желании добавь вызов в `/tg-webhook`.

## Товары и цены

Задаются в начале [worker/worker.js](../worker/worker.js) (`PRODUCTS`) и дублируются подписями в [js/net.js](../js/net.js) (`DEFAULT_PRODUCTS`) — итоговую цену всегда создаёт воркер.

| Товар | Цена | Эффект (модель «без сильного облегчения») |
|---|---|---|
| 💳 Денежный перевод | 25 ⭐ | +25 000 ₽ × уровень, **раз в сутки** — сопоставимо с несколькими рейсами, не открывает технику |
| ⭐ Удвоенный доход | 50 ⭐ | ×2 к оплате рейсов на 24 ч (продлевается, не стакается мгновенно) |
| 🔧 ТО всего парка | 15 ⭐ | Износ всех машин и прицепов → 0 (удобство: ремонт и так дешёвый) |

## Замечания по честности

- Прогресс в рейтинг отправляет клиент — как и весь сейв, игра клиентская. Подпись `initData` гарантирует, что запись делает реальный пользователь Telegram, но не перепроверяет экономику. Для казуальной таблицы этого достаточно; при желании ужесточить — валидируй капитал по истории `invoices`/`trips` в D1.
- Двойная активация покупки невозможна (статус счёта в D1). Поддельный «paid» без реальной оплаты возможен только в мягком режиме до включения `STRICT_PAYMENTS`.

## Локальная проверка воркера

```
cd worker
wrangler d1 execute transport-manager --local --file=schema.sql
wrangler dev
```
Потом: `curl http://localhost:8787/health`.
