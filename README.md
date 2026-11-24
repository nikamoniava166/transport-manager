# Менеджер перевозок — Telegram Mini App

Экономический менеджер с таймерами: биржа заказов, автопарк, водители, офис с бухгалтерами и механиками, улучшение гаража и офиса. Работает как Telegram Mini App и как обычная веб-страница (для разработки).

## Опубликовано

- Игра (GitHub Pages): https://nikamoniava166.github.io/transport-manager/
- Бот: [@RussianTruckManager_bot](https://t.me/RussianTruckManager_bot)
- Мини-приложение (прямая ссылка): https://t.me/RussianTruckManager_bot/RussianTruckManager
- Обложка 640×360: `cover-640x360.png` (загружена в BotFather при создании мини-приложения)

## Структура

```
index.html            — точка входа
css/styles.css        — тема и компоненты
js/data.js            — таблицы и константы
js/state.js           — состояние, сейвы, миграции (localStorage + Telegram CloudStorage)
js/ui.js              — формат, тосты, haptic, тема
js/economy.js         — экономика: заказы, рейсы, события, персонал, улучшения, салон б/у
js/net.js             — сеть: рейтинг и покупки Telegram Stars (выключено без BACKEND_URL)
js/screens/*.js       — экраны (home, market, trips, garage, salon, office, more)
js/app.js             — инициализация, роутер, история «назад»
docs/game-design.md   — дизайн-документ
```

Сборка не нужна — это статический сайт. Бэкенд для Stars и рейтинга — отдельный Cloudflare Worker в `worker/` (не обязателен для игры): [worker/worker.js](worker/worker.js), инструкция — [docs/backend.md](docs/backend.md).

## Локальный запуск

Открой `index.html` в браузере или запусти локальный сервер:

    python -m http.server 8080

и открой http://localhost:8080

## Публикация в Telegram

### Шаг 1. HTTPS-хостинг

Мини-приложению нужен публичный адрес по HTTPS. Варианты:

**GitHub Pages** (нужен аккаунт GitHub)
1. Создай публичный репозиторий, например `transport-manager`.
2. Загрузи файлы сайта: `index.html`, `css/`, `js/`, `.nojekyll` (веб-интерфейс: Add file → Upload files, либо git push).
3. Settings → Pages → Source: *Deploy from a branch* → ветка `main`, папка `/ (root)` → Save.
4. Через 1–2 минуты сайт откроется по адресу `https://<ник>.github.io/<репозиторий>/`.

**Netlify Drop** (без git)
1. Открой https://app.netlify.com/drop и войди (Google / GitHub / почта).
2. Перетащи папку проекта в окно — сайт сразу появится на `https://<имя>.netlify.app`.
3. Site configuration → Change site name — задай короткое имя.

**Cloudflare Pages** (без git)
1. Открой https://pages.cloudflare.com → Create a project → Upload assets.
2. Загрузи zip с файлами сайта — адрес `https://<имя>.pages.dev`.

Проверь, что сайт открывается по адресу с `https://` — это обязательное условие Telegram.

### Шаг 2. Бот в @BotFather

1. Открой @BotFather → `/newbot`.
2. Имя бота (как отображается): например `Менеджер перевозок`.
3. Username: должен заканчиваться на `bot`, например `my_transport_manager_bot`.
4. BotFather пришлёт **токен** — сохрани его (для мини-приложения он не нужен, пригодится, если появится бэкенд).

### Шаг 3. Мини-приложение

1. В @BotFather: `/newapp` → выбери своего бота.
2. Web App URL: адрес с хостинга, например `https://<ник>.github.io/transport-manager/`.
3. Название: `Менеджер перевозок`.
4. Короткое описание (до 120 символов): `Экономический менеджер: биржа заказов, автопарк, водители, бухгалтерия и логистика`.
5. Фото 640×360 и GIF — можно пропустить (отправь `/empty`).
6. Short name: `transport_manager` — по нему мини-приложение доступно как `t.me/<бот>/app/transport_manager`.

### Шаг 4. Кнопка Menu

- В @BotFather: `/mybots` → твой бот → **Bot Settings** → **Menu Button** → вставь URL мини-приложения и сохрани.
- Теперь в чате с ботом слева от поля ввода появится кнопка **Menu** — она открывает игру.

### Шаг 5. Проверка

1. Открой своего бота → нажми **Menu**.
2. Проверь: тема подстраивается под Telegram, кнопка «Назад» в шапке возвращает на главную, прогресс сохраняется после перезапуска.
3. На Android после обновлений иногда помогает очистка кэша Telegram (Настройки → Данные и память → Использование памяти → Очистить кэш Telegram).

## Обновления

Перезалей файлы на хостинг (или сделай `git push`) — мини-приложение откроется с новой версией. Пользователи Telegram могут увидеть старую версию до перезапуска приложения — это кэш WebView.

## Дизайн и баланс

Все механики, таблицы и формулы — в [docs/game-design.md](docs/game-design.md).

Картинки машин — в `img/trucks/`; путь прописывается в поле `img` модели в `js/data.js`. ГАЗель Next и «Бычок» — фото с Wikimedia Commons (общественное достояние: CC0 и PD).
