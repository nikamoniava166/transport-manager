'use strict';
Game.screens.more = {
  moneySensitive: true,

  render: function(root){
    var s = Game.state;

    // Магазин Stars и рейтинг — только когда бэкенд подключён (js/net.js → BACKEND_URL)
    var shopHtml = '';
    var lbHtml = '';
    if (Game.net && Game.net.enabled()) {
      var lvlNow = Game.levelInfo(s.xp).level;
      var moneyLeft = (s.stars.lastMoneyAt && Date.now() - s.stars.lastMoneyAt < 24 * 3600000)
        ? 24 * 3600000 - (Date.now() - s.stars.lastMoneyAt) : 0;
      var rows = Game.net.products().map(function(P){
        var locked = P.id === 'money' && moneyLeft > 0;
        var sub = P.desc;
        if (P.id === 'money') sub += ' · сейчас: ' + Game.fmt.money(25000 * lvlNow);
        if (locked) sub += ' · ещё ' + Game.fmt.dur(moneyLeft);
        var ico = P.id === 'money' ? '💳' : P.id === 'boost' ? '⭐' : '🔧';
        return `
          <div class="list-item">
            <div class="li-ico">${ico}</div>
            <div class="li-main">
              <div class="li-title">${P.title}</div>
              <div class="li-sub">${sub}</div>
            </div>
            <button class="btn small" data-stars="${P.id}" ${locked ? 'disabled' : ''}>${P.stars} ⭐</button>
          </div>`;
      }).join('');
      shopHtml = `
        <div class="card">
          <div class="card-title">⭐ Магазин</div>
          <div class="small muted" style="margin-bottom:4px">Покупки за Telegram Stars — удобства, а не преимущество: контент и уровни не продаются.</div>
          ${rows}
        </div>`;
      lbHtml = `
        <div class="card">
          <div class="card-title">🏆 Рейтинг компаний</div>
          <div id="lb-body">
            <div class="small muted">Капитал = деньги + машины + прицепы. Обновляется после рейсов.</div>
            <button class="btn secondary" id="lb-load" style="margin-top:8px">Показать топ-20</button>
          </div>
        </div>`;
    }

    root.innerHTML = `
      <div class="card">
        <div class="card-title">Компания</div>
        <div class="grid2" style="margin:0">
          <div><div class="stat-num">${s.stats.tripsDone}</div><div class="stat-lbl">рейсов доставлено</div></div>
          <div><div class="stat-num">${s.stats.km.toLocaleString('ru-RU')}</div><div class="stat-lbl">км пройдено</div></div>
          <div><div class="stat-num" style="color:var(--ok)">${Game.fmt.money(s.stats.earned)}</div><div class="stat-lbl">заработано</div></div>
          <div><div class="stat-num" style="color:var(--danger)">${Game.fmt.money(s.stats.spent)}</div><div class="stat-lbl">потрачено</div></div>
        </div>
        ${s.stats.breakdowns ? '<div class="small muted" style="margin-top:6px">⚡ Поломок в пути: ' + s.stats.breakdowns + '</div>' : ''}
        <div class="divider" style="margin:10px 0 6px"></div>
        <div class="small muted">Персонал нанимается на вкладке «Офис» — водитель занимает одно рабочее место вместе с бухгалтерами и механиками</div>
      </div>

      ${shopHtml}
      ${lbHtml}

      <div class="card">
        <div class="card-title">Настройки</div>
        <button class="btn secondary" id="toggle-sound">${s.settings.sound ? '🔊 Звук: вкл' : '🔇 Звук: выкл'}</button>
        <button class="btn secondary" id="toggle-haptic">${s.settings.haptic ? '📳 Вибрация: вкл' : '📳 Вибрация: выкл'}</button>
        <button class="btn danger" id="reset-btn">Сбросить прогресс</button>
      </div>

      <div class="card center small muted">
        Менеджер перевозок · v0.2<br>
        План и дизайн: docs/game-design.md
      </div>
    `;

    var soundBtn = document.getElementById('toggle-sound');
    if (soundBtn) soundBtn.onclick = function(){
      s.settings.sound = !s.settings.sound;
      Game.save();
      Game.toast(s.settings.sound ? '🔊 Звук включён' : '🔇 Звук выключен');
      Game.navigate('more', true);
    };

    var hapticBtn = document.getElementById('toggle-haptic');
    if (hapticBtn) hapticBtn.onclick = function(){
      s.settings.haptic = !s.settings.haptic;
      Game.save();
      Game.navigate('more', true);
    };

    root.querySelectorAll('[data-stars]').forEach(function(b){
      b.onclick = function(){
        Game.haptic('tap');
        var id = b.getAttribute('data-stars');
        b.disabled = true;
        b.textContent = '⏳';
        Game.net.buy(id, function(r){
          if (r.ok) { Game.haptic('ok'); Game.toast(r.msg, 'ok'); }
          else { Game.haptic('err'); Game.toast(r.msg || 'Покупка не удалась', 'err'); }
          Game.navigate('more', true);
        });
      };
    });

    function loadLb(){
      var box = document.getElementById('lb-body');
      if (!box) return;
      box.innerHTML = '<div class="small muted center" style="padding:10px 0">Загружаем…</div>';
      Game.net.getLeaderboard(function(res){
        if (!res.ok || !res.top) {
          box.innerHTML = '<div class="small muted" style="padding:6px 0">Рейтинг недоступен — попробуйте позже.</div><button class="btn secondary small" id="lb-retry" style="margin-top:6px">Повторить</button>';
          var rb2 = document.getElementById('lb-retry');
          if (rb2) rb2.onclick = loadLb;
          return;
        }
        var rows = res.top.map(function(p, i){
          var medal = i < 3 ? ['🥇','🥈','🥉'][i] : '#' + (i + 1);
          return `
            <div class="list-item">
              <div class="li-ico">${medal}</div>
              <div class="li-main">
                <div class="li-title">${Game.esc(p.name)}${p.me ? ' <span class="tag accent">вы</span>' : ''}</div>
                <div class="li-sub">ур. ${p.level} · ${p.trips} рейсов</div>
              </div>
              <div class="li-title" style="font-size:13px;white-space:nowrap">${Game.fmt.money(p.capital)}</div>
            </div>`;
        }).join('');
        var mine = (res.me && res.me.rank > 20)
          ? '<div class="small" style="margin:6px 0 2px">Ваше место: <b>№' + res.me.rank + '</b> · капитал ' + Game.fmt.money(res.me.capital) + '</div>'
          : '';
        box.innerHTML = mine + (rows || '<div class="small muted" style="padding:6px 0">Пока пусто — станьте первым!</div>');
      });
    }
    var lbBtn = document.getElementById('lb-load');
    if (lbBtn) lbBtn.onclick = loadLb;

    var rb = document.getElementById('reset-btn');
    if (rb) {
      var armed = false, timer = null;
      rb.onclick = function(){
        if (!armed) {
          armed = true;
          rb.textContent = 'Точно сбросить? Нажмите ещё раз';
          Game.haptic('tap');
          timer = setTimeout(function(){
            armed = false;
            rb.textContent = 'Сбросить прогресс';
          }, 3000);
        } else {
          clearTimeout(timer);
          Game.resetSave();
          Game.haptic('ok');
          Game.toast('Прогресс сброшен', 'ok');
          Game.navigate('more', true);
          Game.updateHUD();
        }
      };
    }
  }
};
