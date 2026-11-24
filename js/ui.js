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
  if (!tg || !tg.HapticFeedback || (Game.state && Game.state.settings && !Game.state.settings.haptic)) return;
  try {
    if (kind === 'ok')       tg.HapticFeedback.notificationOccurred('success');
    else if (kind === 'err') tg.HapticFeedback.notificationOccurred('error');
    else                     tg.HapticFeedback.impactOccurred('light');
  } catch (e) {}
};

Game.FALLBACK_THEMES = {
  dark:  { bg:'#17212b', panel:'#232e3c', panel2:'#2c3a4d', text:'#ffffff', muted:'#8fa3b8', accent:'#54a9ff', 'accent-text':'#ffffff', ok:'#4dd07a', warn:'#ffb84d', danger:'#ff6b6b' },
  light: { bg:'#eef2f6', panel:'#ffffff', panel2:'#e6ebf1', text:'#17212b', muted:'#7d8fa4', accent:'#3390ec', 'accent-text':'#ffffff', ok:'#31a24c', warn:'#e08600', danger:'#e03131' }
};

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
  var m = document.getElementById('hud-money');
  var l = document.getElementById('hud-level');
  if (m && Game.state) m.textContent = Game.fmt.money(Game.state.money || 0);
  if (l && Game.state) l.textContent = 'Ур. ' + Game.levelInfo(Game.state.xp).level;
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
