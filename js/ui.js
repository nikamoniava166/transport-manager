'use strict';

Game.ui = {}; // живое (несохраняемое) состояние интерфейса

Game.fmt = {
  money: function(n){ return Math.round(n).toLocaleString('ru-RU') + ' ₽'; },
  km:    function(n){ return Math.round(n).toLocaleString('ru-RU') + ' км'; },
  ton:   function(n){ return (Math.round(n * 10) / 10).toLocaleString('ru-RU') + ' т'; },
  dur:   function(ms){ // «4 мин 30 с» / «45 с»
    var s = Math.max(0, Math.round(ms / 1000));
    var m = Math.floor(s / 60);
    if (m <= 0) return s + ' с';
    if (m < 60) return m + ' мин' + (s % 60 ? ' ' + (s % 60) + ' с' : '');
    return Math.floor(m / 60) + ' ч ' + (m % 60) + ' мин';
  }
};

// Русские склонения: plural(3, 'машина', 'машины', 'машин')
Game.plural = function(n, one, few, many){
  var m10 = Math.abs(n) % 10, m100 = Math.abs(n) % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

Game.esc = function(s){
  return String(s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
};

// Картинка машины: если у модели задан путь img (js/data.js) — тег <img>,
// иначе заглушка-эмодзи. Используется в салоне б/у, пригодится и другим экранам.
Game.truckImgHtml = function(T, cls){
  cls = cls || 'truck-img';
  if (T && T.img) return '<img class="' + cls + '" src="' + Game.esc(T.img) + '" alt="' + Game.esc(T.name) + '">';
  return '<div class="' + cls + ' ph"><span>🚛</span></div>';
};

Game.toast = function(msg, type){
  var box = document.getElementById('toasts');
  if (!box) {
    box = document.createElement('div');
    box.className = 'toasts'; box.id = 'toasts';
    document.body.appendChild(box);
  }
  var t = document.createElement('div');
  t.className = 'toast' + (type ? ' ' + type : '');
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(function(){ t.classList.add('hide'); }, 2100);
  setTimeout(function(){ t.remove(); }, 2500);
};

Game.haptic = function(kind){
  var tg = window.Telegram && window.Telegram.WebApp;
  if (tg && tg.HapticFeedback && !(Game.state && Game.state.settings && !Game.state.settings.haptic)) {
    try {
      if (kind === 'ok' || kind === 'level') tg.HapticFeedback.notificationOccurred('success');
      else if (kind === 'err') tg.HapticFeedback.notificationOccurred('error');
      else tg.HapticFeedback.impactOccurred('light');
    } catch (e) {}
  }
  // звук синхронно с откликом
  if (Game.sound) {
    if (kind === 'ok') Game.sound.play('ok');
    else if (kind === 'err') Game.sound.play('err');
    else if (kind === 'level') Game.sound.play('level');
    else Game.sound.play('tap');
  }
};

Game.FALLBACK_THEMES = {
  dark:  { bg:'#17212b', panel:'#232e3c', panel2:'#2c3a4d', text:'#ffffff', muted:'#8fa3b8', accent:'#54a9ff', 'accent-text':'#ffffff', ok:'#4dd07a', warn:'#ffb84d', danger:'#ff6b6b' },
  light: { bg:'#eef2f6', panel:'#ffffff', panel2:'#e6ebf1', text:'#17212b', muted:'#7d8fa4', accent:'#3390ec', 'accent-text':'#ffffff', ok:'#31a24c', warn:'#e08600', danger:'#e03131' }
};

// hex → rgb / rgba / смешение — для производных цветов фона и вкладок
function hexRgb(h){
  h = String(h || '').replace('#', '');
  if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
  var n = parseInt(h, 16);
  return isNaN(n) ? null : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function withAlpha(h, a){
  var c = hexRgb(h);
  return c ? 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')' : h;
}
function blendHex(h1, h2, t){
  var a = hexRgb(h1), b = hexRgb(h2);
  if (!a || !b) return h1;
  return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' +
         Math.round(a[1] + (b[1] - a[1]) * t) + ',' +
         Math.round(a[2] + (b[2] - a[2]) * t) + ')';
}

Game.applyTheme = function(){
  var tg = window.Telegram && window.Telegram.WebApp;
  var p = (tg && tg.themeParams && tg.themeParams.bg_color) ? tg.themeParams : null;
  var dark;
  if (p) dark = tg.colorScheme !== 'light';
  else if (window.matchMedia) dark = !window.matchMedia('(prefers-color-scheme: light)').matches;
  else dark = true;
  var fb = dark ? Game.FALLBACK_THEMES.dark : Game.FALLBACK_THEMES.light;
  var v = fb;
  if (p) {
    if (dark) {
      v = {
        bg: p.bg_color || fb.bg,
        panel: p.secondary_bg_color || p.bg_color || fb.panel,
        panel2: p.secondary_bg_color || fb.panel2,
        text: p.text_color || fb.text,
        muted: p.hint_color || fb.muted,
        accent: p.button_color || p.link_color || fb.accent,
        'accent-text': p.button_text_color || fb['accent-text'],
        ok: fb.ok, warn: fb.warn, danger: fb.danger
      };
    } else {
      // Светлая тема Telegram: серый фон, белые карточки
      v = {
        bg: p.secondary_bg_color || fb.bg,
        panel: p.bg_color || '#ffffff',
        panel2: p.secondary_bg_color || fb.panel2,
        text: p.text_color || fb.text,
        muted: p.hint_color || fb.muted,
        accent: p.button_color || p.link_color || fb.accent,
        'accent-text': p.button_text_color || fb['accent-text'],
        ok: fb.ok, warn: fb.warn, danger: fb.danger
      };
    }
  }
  // производные: градиент фона, разметка, «стекло» панелей — из фактических цветов темы
  var deep = dark ? '#0c141c' : '#dbe2ea';
  v['bg2'] = blendHex(v.bg, deep, dark ? 0.45 : 0.55);
  v['glow'] = withAlpha(v.accent, dark ? 0.10 : 0.08);
  v['road'] = withAlpha(v.text, dark ? 0.05 : 0.055);
  v['glass'] = withAlpha(v.panel, dark ? 0.94 : 0.90);
  v['tab-active'] = withAlpha(v.accent, dark ? 0.16 : 0.14);
  v['tab-shadow'] = dark ? '0 14px 34px rgba(0,0,0,.5)' : '0 12px 28px rgba(23,33,43,.18)';

  var root = document.documentElement;
  Object.keys(v).forEach(function(k){ root.style.setProperty('--' + k, v[k]); });
  document.body.classList.toggle('is-light', !dark);
  try {
    if (tg) {
      if (tg.setHeaderColor && p && p.bg_color) tg.setHeaderColor(p.bg_color);
      if (tg.setBackgroundColor && p && p.bg_color) tg.setBackgroundColor(p.bg_color);
    }
  } catch (e) {}
};

Game.updateHUD = function(){
  Game.updateBrand();
  var m = document.getElementById('hud-money');
  var l = document.getElementById('hud-level');
  if (!Game.state) return;
  if (m) {
    var money = Game.state.money || 0;
    var txt = Game.fmt.money(money);
    if (m.textContent !== txt) {
      if (Game.ui.hudMoney != null && money !== Game.ui.hudMoney) {
        m.classList.remove('pop');
        void m.offsetWidth;
        m.classList.add('pop');
      }
      m.textContent = txt;
      Game.ui.hudMoney = money;
    }
  }
  if (l) l.textContent = 'Ур. ' + Game.levelInfo(Game.state.xp).level;
};

// Праздничные частицы при повышении уровня
Game.confetti = function(){
  var box = document.getElementById('confetti');
  if (!box) {
    box = document.createElement('div');
    box.id = 'confetti';
    box.className = 'confetti';
    document.body.appendChild(box);
  }
  var emojis = ['🎉','⭐','💰','🚚','✨'];
  for (var i = 0; i < 26; i++) {
    var s = document.createElement('span');
    s.className = 'cf';
    s.textContent = emojis[i % emojis.length];
    s.style.left = (4 + Math.random() * 92) + '%';
    s.style.fontSize = (16 + Math.random() * 10) + 'px';
    s.style.animationDelay = (Math.random() * 0.5) + 's';
    s.style.animationDuration = (1.6 + Math.random() * 1.3) + 's';
    box.appendChild(s);
    (function(el){ setTimeout(function(){ el.remove(); }, 3400); })(s);
  }
};

// Живые таймеры и прогресс-бары активных рейсов на любом экране
Game.updateTripWidgets = function(){
  if (!Game.state) return;
  var els = document.querySelectorAll('[data-trip]');
  if (!els.length) return;
  var now = Date.now();
  els.forEach(function(el){
    var uid = +el.getAttribute('data-trip');
    var t = null;
    for (var i = 0; i < Game.state.trips.length; i++) {
      var tr = Game.state.trips[i];
      if (tr.uid === uid && tr.status === 'active') { t = tr; break; }
    }
    if (!t) return;
    if (el.hasAttribute('data-remain')) el.textContent = 'осталось ' + Game.fmt.dur(Math.max(0, t.endAt - now));
    if (el.hasAttribute('data-bar')) {
      var p = Math.min(100, Math.max(0, (now - t.startedAt) / (t.endAt - t.startedAt) * 100));
      el.style.width = p.toFixed(1) + '%';
    }
  });
};

// ---------- Компания: название в шапке и карточка компании ----------

// Имя компании: заданное игроком или синтез «Имя Транс» (как было на «Главной»)
Game.companyDisplayName = function(){
  var c = (Game.state && Game.state.company) || {};
  return (c.name && c.name.trim()) || (Game.playerName + ' Транс');
};

Game.updateBrand = function(){
  var b = document.getElementById('brand');
  if (!b) return;
  var c = (Game.state && Game.state.company) || {};
  var name = (c.name && c.name.trim()) || '';
  b.textContent = name ? '🚚 ' + name : '🚚 Менеджер перевозок';
  b.classList.toggle('has-name', !!name);
};

// Модалка поверх экрана: карточка компании (mode 'view') или ввод названия (mode 'name')
Game.showCompany = function(mode){
  var old = document.getElementById('company-modal');
  if (old) old.remove();
  var s = Game.state;
  if (!s.company) s.company = { name: '', named: false };
  if (!mode) mode = s.company.named ? 'view' : 'name';
  var li = Game.levelInfo(s.xp);
  var xpPct = Math.min(100, Math.round(li.cur / li.need * 100));
  var st = s.stats || {};
  var boostLeft = (s.stars && s.stars.boostUntil > Date.now()) ? s.stars.boostUntil - Date.now() : 0;
  var myLvl = Game.levelInfo(s.xp).level;
  var licHtml = (Game.data.licenses || []).map(function(L){
    var owned = s.licenses && s.licenses[L.flag];
    var locked = L.lvl > myLvl;
    var right = owned
      ? '<span class="tag ok">✓ есть</span>'
      : `<button class="btn small" data-buylic="${L.flag}" ${(locked || s.money < L.price) ? 'disabled' : ''}>${locked ? 'с ур. ' + L.lvl : '📜 ' + Game.fmt.money(L.price)}</button>`;
    return `<div class="list-item">
      <div class="li-main">
        <div class="li-title" style="font-size:13px">📜 ${Game.esc(L.name)}</div>
        <div class="li-sub">для заказов «${Game.flagLabel(L.flag)}»${owned ? '' : ' · не заменяет спецприцеп'}</div>
      </div>
      ${right}
    </div>`;
  }).join('');
  // динамика доход/расход за 7 дней (переехала с «Офиса»)
  var chartDays = [], maxV = 1;
  for (var ci = 6; ci >= 0; ci--) {
    var cd = new Date(Date.now() - ci * 86400000);
    var ck = Game.dayKey(cd);
    var cf = (s.finance || {})[ck] || { in: 0, out: 0 };
    chartDays.push({ day: cd.getDate(), in: cf.in || 0, out: cf.out || 0 });
    maxV = Math.max(maxV, cf.in || 0, cf.out || 0);
  }
  var naming = mode === 'name';
  var el = document.createElement('div');
  el.className = 'overlay';
  el.id = 'company-modal';
  el.innerHTML = `
    <div class="modal">
      <div class="modal-x" data-x="1">✕</div>
      ${naming
        ? `<div class="modal-title">🏢 Назовите компанию</div>
           <div class="li-sub">Название появится слева вверху. Изменить можно в любой момент — клик по названию.</div>
           <input id="company-input" maxlength="24" placeholder="Например: «Шеф Транс»" value="${Game.esc(s.company.name || '')}" style="margin-top:10px">
           <div class="row" style="margin-top:10px">
             <button class="btn" data-save="1">Сохранить</button>
             ${s.company.named ? '' : '<button class="btn secondary" data-skip="1">Пока без названия</button>'}
           </div>`
        : `<div class="modal-title">🏢 ${Game.esc(Game.companyDisplayName())}</div>
           <div class="wear" style="margin-top:4px">
             <div class="progress"><i style="width:${xpPct}%;background:var(--accent)"></i></div>
             <div class="val">Уровень ${li.level} · опыт ${li.cur} / ${li.need} XP</div>
           </div>
           ${boostLeft ? '<div class="small" style="margin-top:4px">⭐ доход ×2 ещё ' + Game.fmt.dur(boostLeft) + '</div>' : ''}
           <div class="list-item">
             <div class="li-ico">📦</div>
             <div class="li-main">
               <div class="li-title">${st.tripsDone || 0}</div>
               <div class="li-sub">${Game.plural(st.tripsDone || 0, 'доставленный рейс', 'доставленных рейса', 'доставленных рейсов')}</div>
             </div>
           </div>
           <div class="list-item">
             <div class="li-ico">🛣️</div>
             <div class="li-main">
               <div class="li-title">${Game.fmt.km(st.km || 0)}</div>
               <div class="li-sub">пройдено по дорогам</div>
             </div>
           </div>
           <div class="divider" style="margin:10px 0 8px"></div>
           <div class="small muted" style="margin-bottom:4px">Лицензии на категории грузов</div>
           ${licHtml}
           <div class="divider" style="margin:10px 0 8px"></div>
           <div class="small muted" style="margin-bottom:6px">Динамика за 7 дней</div>
           <div class="chart">
             ${chartDays.map(function(d){
               var hi = Math.max(Math.round(d.in / maxV * 100), d.in ? 6 : 2);
               var ho = Math.max(Math.round(d.out / maxV * 100), d.out ? 6 : 2);
               return `<div class="chart-col">
                 <div class="chart-bars">
                   <i class="b-in" style="height:${hi}%"></i>
                   <i class="b-out" style="height:${ho}%"></i>
                 </div>
                 <div class="chart-day">${d.day}</div>
               </div>`;
             }).join('')}
           </div>
           <div class="small muted" style="margin-top:6px"><span class="tag ok">доход</span> <span class="tag danger">расход</span> · максимум за день: ${Game.fmt.money(maxV)}</div>
           <button class="btn secondary" data-rename="1" style="margin-top:8px">✏️ Переименовать</button>`}
    </div>`;
  document.body.appendChild(el);

  function close(){ el.remove(); }
  function save(){
    var input = el.querySelector('#company-input');
    var name = input ? input.value.replace(/\s+/g, ' ').trim().slice(0, 24) : '';
    s.company.name = name;
    s.company.named = true;
    Game.save();
    Game.updateBrand();
    Game.haptic('ok');
    Game.toast(name ? 'Компания: «' + name + '»' : 'Название сброшено', 'ok');
    close();
    // экран мог уже показать имя — перерисовываем текущий
    if (Game.currentScreen && Game.screens[Game.currentScreen]) Game.navigate(Game.currentScreen, true);
  }
  el.addEventListener('click', function(ev){
    if (ev.target === el || (ev.target && ev.target.hasAttribute && ev.target.hasAttribute('data-x'))) { Game.haptic('tap'); close(); }
    if (ev.target && ev.target.hasAttribute && ev.target.hasAttribute('data-skip')) { s.company.named = true; Game.save(); close(); }
    if (ev.target && ev.target.hasAttribute && ev.target.hasAttribute('data-rename')) { Game.haptic('tap'); Game.showCompany('name'); }
    if (ev.target && ev.target.hasAttribute && ev.target.hasAttribute('data-save')) save();
    if (ev.target && ev.target.hasAttribute && ev.target.hasAttribute('data-buylic')) {
      var r = Game.economy.buyLicense(ev.target.getAttribute('data-buylic'));
      if (r.ok) { Game.haptic('ok'); Game.toast(r.msg, 'ok'); }
      else { Game.haptic('err'); Game.toast(r.msg, 'err'); }
      Game.showCompany('view'); // перерисовать модалку с новым состоянием лицензий
    }
  });
  el.addEventListener('keydown', function(ev){
    if (ev.key === 'Enter' && ev.target && ev.target.id === 'company-input') save();
  });
  if (naming) {
    var input = el.querySelector('#company-input');
    if (input) setTimeout(function(){ input.focus(); }, 60);
  }
};
