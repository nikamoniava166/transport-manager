'use strict';

// Сетевой слой: таблица рейтинга и покупки за Telegram Stars.
// Бэкенд — Cloudflare Worker (worker/worker.js), инструкция по развёртыванию: docs/backend.md.
//
// BACKEND_URL — адрес воркера. Пустая строка = функции выключены:
// магазин и рейтинг не показываются, игра работает полностью локально (сейчас так и есть).
(function(){
  var BACKEND_URL = 'https://transport-manager-backend.nikamoniava166.workers.dev'; // развёрнут: docs/backend.md

  // Витрина магазина (цены итоговые задаёт воркер при создании счёта; тут — для подписи)
  var DEFAULT_PRODUCTS = [
    { id: 'money',  title: 'Денежный перевод', desc: '+25 000 ₽ × уровень, раз в сутки', stars: 25 },
    { id: 'boost',  title: 'Удвоенный доход',  desc: '×2 к оплате рейсов на 24 часа',    stars: 50 },
    { id: 'repair', title: 'ТО всего парка',   desc: 'снимает износ со всех машин и прицепов', stars: 15 },
    { id: 'hurry',  title: 'Ускорение рейсов', desc: '−15 минут ко всем активным рейсам', stars: 10 }
  ];

  var tg = window.Telegram && window.Telegram.WebApp;
  var N = Game.net = {};
  var lastSyncAt = 0, syncTimer = null;

  N.enabled = function(){
    return !!BACKEND_URL && !!(tg && tg.initData);
  };

  N.products = function(){ return DEFAULT_PRODUCTS; };

  // Капитал компании: деньги + стоимость машин и прицепов по ценам новых
  N.capital = function(){
    var s = Game.state, sum = s.money;
    s.trucks.forEach(function(t){
      var T = Game.truck(t.tid);
      if (T) sum += T.price;
    });
    s.trailers.forEach(function(t){
      var TT = Game.trailerType(t.tid);
      if (TT) sum += TT.price;
    });
    return Math.round(sum);
  };

  function api(path, body, cb){
    if (!N.enabled()) { if (cb) cb({ ok: false, msg: 'offline' }); return; }
    fetch(BACKEND_URL + path, {
      method: 'POST',
      headers: { 'Authorization': tg.initData, 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(function(r){ return r.json(); })
      .then(function(data){ if (cb) cb(data); })
      .catch(function(){ if (cb) cb({ ok: false, msg: 'Нет связи с сервером' }); });
  }

  // --- рейтинг: отправляем прогресс после рейсов, не чаще раза в минуту ---

  function doSync(){
    lastSyncAt = Date.now();
    var body = {
      capital: N.capital(),
      level: Game.levelInfo(Game.state.xp).level,
      trips: Game.state.stats.tripsDone
    };
    // полная резервная копия сейва на сервере — отправляем, только если есть прогресс,
    // чтобы пустой дефолт не затирал копию
    if (Game.hasProgress && Game.hasProgress(Game.state)) body.state = JSON.stringify(Game.state);
    api('/save', body, null);
  }

  N.syncSoon = function(){
    if (!N.enabled()) return;
    if (Date.now() - lastSyncAt < 60000) return;
    if (syncTimer) return;
    syncTimer = setTimeout(function(){ syncTimer = null; doSync(); }, 3000);
  };

  // Вызывается из app.js после settle, когда рейсы завершились
  N.onTripsResolved = function(r){
    if (r && r.resolved > 0) N.syncSoon();
  };

  // Прямая отправка (без троттла) — например, при уходе приложения в фон
  N.syncNow = function(){
    if (N.enabled()) doSync();
  };

  N.getLeaderboard = function(cb){ api('/leaderboard', {}, cb); };

  // Резервная копия сейва на сервере: восстановление, когда локаль и облако пусты
  N.restore = function(cb){ api('/restore', {}, cb); };

  // Бонусы от владельца игры (таблица grants у воркера): забираем при старте
  // и при возврате в приложение; выдача одноразовая — помечается на сервере при отдаче
  N.claimGrants = function(){
    if (!N.enabled()) return;
    api('/grant', {}, function(res){
      if (!res || !res.ok || !Array.isArray(res.grants)) return;
      res.grants.forEach(function(g){
        var r = Game.economy.applyGrant(g);
        if (r && r.ok) { Game.haptic('ok'); Game.toast(r.msg, 'ok'); N.syncSoon(); }
      });
    });
  };

  // --- реферальная программа: ссылка с startapp=ref<id>, сервер хранит пары «кто кого пригласил» ---

  // Долг нового игрока: «я пришёл по ссылке ref<id>» — отправляем один раз
  N.refer = function(){
    if (!N.enabled()) return;
    var s = Game.state;
    if (!s.refBy || s.refSent) return;
    api('/refer', { referrer: s.refBy }, function(res){
      if (res && res.ok) { s.refSent = true; Game.save(); }
    });
  };

  // Забор награды за приглашённых друзей (одноразово на сервере, счётчик total — для карточки)
  N.refClaim = function(){
    if (!N.enabled()) return;
    api('/refclaim', {}, function(res){
      if (!res || !res.ok) return;
      Game.ui.refTotal = res.total || 0;
      if (res.count > 0) {
        var sum = res.count * Game.data.refBonusInvite;
        Game.state.money += sum;
        Game.state.stats.earned += sum;
        Game.economy.logOp('in', sum, 'Награда за друзей: пригласили ×' + res.count);
        Game.save(); Game.updateHUD();
        Game.haptic('ok');
        Game.toast('👥 Друг' + Game.plural(res.count, ' начал', 'а начали', 'ей начали') + ' играть по вашей ссылке: +' + Game.fmt.money(sum), 'ok');
        N.syncSoon();
      }
      if (Game.currentScreen === 'more') Game.navigate('more', true);
    });
  };

  // Кнопка «Поделиться ссылкой»: стандартное окно Telegram или копирование в буфер в браузере
  N.shareInvite = function(){
    var link = Game.data.refLink + '?startapp=ref' + Game.userId;
    var t = window.Telegram && window.Telegram.WebApp;
    if (t && t.openTelegramLink) {
      t.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(link) +
        '&text=' + encodeURIComponent(Game.data.refShareText));
      Game.haptic('tap');
      return true;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link);
        Game.toast('🔗 Ссылка скопирована — отправьте её другу');
        Game.haptic('ok');
        return true;
      }
    } catch (e) {}
    Game.toast(link);
    return true;
  };

  // --- покупки за Stars: счёт у воркера → окно Telegram → активация ---

  // Активация счёта с повторами: вебхук подтверждает оплату и может прийти чуть позже клиента
  function claimInvoice(invoiceId, cb, attempt){
    api('/purchase/claim', { invoiceId: invoiceId }, function(claim){
      if (claim && claim.ok) { if (cb) cb(claim); return; }
      if (claim && claim.pending && (attempt || 0) < 4) {
        setTimeout(function(){ claimInvoice(invoiceId, cb, (attempt || 0) + 1); }, 3000);
        return;
      }
      if (cb) cb(claim);
    });
  }

  N.buy = function(productId, cb){
    api('/purchase', { productId: productId }, function(res){
      if (!res.ok) { if (cb) cb(res); return; }
      if (!tg.openInvoice) { if (cb) cb({ ok: false, msg: 'Обновите Telegram' }); return; }
      tg.openInvoice(res.url, function(status){
        if (status !== 'paid') {
          if (cb) cb({ ok: false, msg: status === 'failed' ? 'Оплата не прошла' : 'Покупка отменена' });
          return;
        }
        claimInvoice(res.invoiceId, function(claim){
          if (!claim.ok) { if (cb) cb(claim); return; }
          var granted = Game.economy.grantStarsProduct(claim.productId);
          if (granted.ok) N.syncSoon();
          if (cb) cb(granted);
        });
      });
    });
  };

  // Добор оплаченных, но не активированных покупок (например, приложение закрыли сразу после оплаты)
  N.claimPending = function(){
    if (!N.enabled()) return;
    api('/purchase/pending', {}, function(res){
      if (!res || !res.ok || !Array.isArray(res.invoices)) return;
      res.invoices.forEach(function(inv){
        claimInvoice(inv.id, function(claim){
          if (!claim || !claim.ok) return;
          var granted = Game.economy.grantStarsProduct(claim.productId);
          if (granted.ok) { Game.haptic('ok'); Game.toast(granted.msg, 'ok'); N.syncSoon(); }
        });
      });
    });
  };
})();
