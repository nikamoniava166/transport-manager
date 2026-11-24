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
    { id: 'repair', title: 'ТО всего парка',   desc: 'снимает износ со всех машин и прицепов', stars: 15 }
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
    api('/save', {
      capital: N.capital(),
      level: Game.levelInfo(Game.state.xp).level,
      trips: Game.state.stats.tripsDone
    }, null);
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

  // --- покупки за Stars: счёт у воркера → окно Telegram → активация ---
  N.buy = function(productId, cb){
    api('/purchase', { productId: productId }, function(res){
      if (!res.ok) { if (cb) cb(res); return; }
      if (!tg.openInvoice) { if (cb) cb({ ok: false, msg: 'Обновите Telegram' }); return; }
      tg.openInvoice(res.url, function(status){
        if (status !== 'paid') {
          if (cb) cb({ ok: false, msg: status === 'failed' ? 'Оплата не прошла' : 'Покупка отменена' });
          return;
        }
        api('/purchase/claim', { invoiceId: res.invoiceId }, function(claim){
          if (!claim.ok) { if (cb) cb(claim); return; }
          var granted = Game.economy.grantStarsProduct(claim.productId);
          if (granted.ok) N.syncSoon();
          if (cb) cb(granted);
        });
      });
    });
  };
})();
