'use strict';

Game.currentScreen = null;

Game.navigate = function(id, keepScroll){
  // «Рейсы» — под-вкладка вкладки «Диспетчер» (js/screens/orders.js):
  // прямой заход на «Биржу» открывает заказы, перерисовки под-вкладку не сбрасывают
  if (id === 'trips') { Game.ui.ordersTab = 'trips'; id = 'market'; }
  else if (id === 'market' && !keepScroll) { Game.ui.ordersTab = 'market'; }
  // «Салон» — магазин (б/у / новые / прицепы): свежий заход открывает «Б/у»
  else if (id === 'salon' && !keepScroll) { Game.ui.salonTab = 'used'; }
  var scr = Game.screens[id];
  if (!scr) return;
  Game.currentScreen = id;
  var tabs = document.querySelectorAll('.tab');
  tabs.forEach(function(b){ b.classList.toggle('active', b.dataset.screen === id); });
  var root = document.getElementById('screen');
  var st = keepScroll ? root.scrollTop : 0;
  try {
    scr.render(root);
  } catch (e) {
    // экран не отрисовался — навигация всё равно работает
    root.innerHTML = `
      <div class="card center">
        <div class="empty">
          <div class="big">😵</div>
          Экран не отобразился
          <div class="small" style="margin-top:6px">${Game.esc(String((e && e.message) || e))}</div>
        </div>
        <button class="btn" data-gohome="1">🏠 На главную</button>
      </div>`;
    var hb = root.querySelector('[data-gohome]');
    if (hb) hb.onclick = function(){ Game.navigate('home'); };
    if (window.__errors) window.__errors.push('render ' + id + ': ' + ((e && e.message) || e));
  }
  root.scrollTop = st;
  if (!keepScroll) {
    root.classList.remove('anim');
    void root.offsetWidth;
    root.classList.add('anim');
  }

  // Кнопка «Назад» в шапке Telegram: показываем на всех экранах, кроме главной
  var tg = window.Telegram && window.Telegram.WebApp;
  try {
    if (tg && tg.BackButton) {
      if (id === 'home') tg.BackButton.hide();
      else tg.BackButton.show();
    }
  } catch (e) {}

  // История браузера: системная кнопка/жест «назад» листает экраны, а не закрывает игру.
  // Записываем только смену экрана (не каждую перерисовку), чтобы не засорять историю.
  if (Game.ui.histScreen !== id) {
    if (Game.ui.fromPopstate) {
      Game.ui.histScreen = id;
    } else {
      try { history.pushState({ screen: id }, ''); } catch (e) {}
      Game.ui.histScreen = id;
    }
  }
  Game.ui.fromPopstate = false;
};
Game.show = Game.navigate;

Game.tick = function(){
  if (!Game.state || !Game.economy) return;
  var r = Game.economy.settle(false);
  if (r && r.resolved > 0 && Game.net && Game.net.onTripsResolved) Game.net.onTripsResolved(r);
  var moneyChanged = Game.state.money !== Game.ui.moneyShown;
  Game.ui.moneyShown = Game.state.money;
  Game.updateHUD();
  var scr = Game.screens[Game.currentScreen];
  if (scr && scr.onTick) scr.onTick();
  if (Game.economy.checkAchievements) Game.economy.checkAchievements();
  // деньги изменились — обновляем кнопки «по карману/не по карману»
  if (moneyChanged && scr && scr.moneySensitive) Game.navigate(Game.currentScreen, true);
};

Game.init = function(){
  var tg = window.Telegram && window.Telegram.WebApp;

  // Сбор ошибок для отладки
  window.__errors = [];
  window.addEventListener('error', function(e){
    window.__errors.push(String(e.message || e));
  });

  try {
    if (tg) {
      tg.ready();
      tg.expand();
      // чтобы свайп при прокрутке списка не закрывал мини-приложение (iOS)
      if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
    }
  } catch (e) {}

  Game.applyTheme();
  try {
    if (tg && tg.onEvent) tg.onEvent('themeChanged', Game.applyTheme);
  } catch (e) {}

  Game.load();
  Game.updateHUD();

  // Офлайн-прогресс: доводим мир до «сейчас» молча и показываем сводку
  var r = Game.economy.settle(true);
  if (r.resolved > 0) {
    var word = Game.plural(r.resolved, 'рейс доставлен', 'рейса доставлено', 'рейсов доставлено');
    Game.toast('Пока вас не было: ' + word + ' · +' + Game.fmt.money(r.earned), 'ok');
    Game.haptic('ok');
    Game.updateHUD();
  }
  if (Game.net && Game.net.onTripsResolved) Game.net.onTripsResolved(r);

  // бонусы от владельца игры (если выданы, пока игрок не заходил)
  if (Game.net && Game.net.enabled && Game.net.claimGrants) Game.net.claimGrants();

  // добор оплаченных, но не активированных покупок (закрыли приложение сразу после оплаты)
  if (Game.net && Game.net.enabled && Game.net.claimPending) Game.net.claimPending();

  var tabs = document.querySelectorAll('.tab');
  tabs.forEach(function(b){
    b.addEventListener('click', function(){
      Game.haptic('tap');
      Game.navigate(b.dataset.screen);
    });
  });

  // Системная кнопка/жест «назад» (телефон, браузер): возврат на предыдущий экран
  try { history.replaceState({ screen: 'home' }, ''); } catch (e) {}
  Game.ui.histScreen = 'home';
  window.addEventListener('popstate', function(ev){
    var target = (ev.state && ev.state.screen && Game.screens[ev.state.screen]) ? ev.state.screen : 'home';
    Game.ui.fromPopstate = true;
    Game.navigate(target, true);
  });

  // Кнопка «Назад» в шапке Telegram
  try {
    if (tg && tg.BackButton && tg.BackButton.onClick) {
      tg.BackButton.onClick(function(){
        try { history.back(); } catch (e) { Game.navigate('home'); }
      });
    }
  } catch (e) {}

  Game.navigate('home');
  Game.ui.ready = true;

  // Компания: клик по табличке в шапке открывает карточку;
  // при первом запуске (название ещё не задано) сразу предлагаем назвать компанию
  var brand = document.getElementById('brand');
  if (brand) brand.onclick = function(){ Game.haptic('tap'); Game.showCompany('view'); };
  if (!Game.state.company || !Game.state.company.named) {
    setTimeout(function(){ Game.showCompany('name'); }, 600);
  }

  setInterval(Game.tick, 1000);
  setInterval(Game.save, 15000);
  document.addEventListener('visibilitychange', function(){
    if (document.hidden) {
      Game.save();
      if (Game.net && Game.net.syncNow) Game.net.syncNow(); // отправить прогресс в таблицу при уходе
    } else if (Game.net && Game.net.enabled && Game.net.claimGrants) {
      Game.net.claimGrants(); // могли выдать бонус, пока приложение было свёрнуто
    }
  });
  window.addEventListener('beforeunload', function(){ Game.save(); });
};

document.addEventListener('DOMContentLoaded', Game.init);
