'use strict';
Game.screens.more = {
  moneySensitive: true,

  render: function(root){
    var s = Game.state;

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
      Game.toast('Звук появится на шаге полировки — настройка уже сохраняется');
      Game.navigate('more', true);
    };

    var hapticBtn = document.getElementById('toggle-haptic');
    if (hapticBtn) hapticBtn.onclick = function(){
      s.settings.haptic = !s.settings.haptic;
      Game.save();
      Game.navigate('more', true);
    };

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
