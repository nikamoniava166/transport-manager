'use strict';
Game.screens.home = {
  moneySensitive: true,

  render: function(root){
    var s = Game.state;
    var li = Game.levelInfo(s.xp);
    var xpPct = Math.min(100, Math.round(li.cur / li.need * 100));
    var active = s.trips.filter(function(t){ return t.status === 'active'; });
    var rested = s.drivers.filter(function(d){ return d.restUntil <= Date.now() && !Game.economy.driverBusy(d.uid); }).length;
    var boostLeft = (s.stars && s.stars.boostUntil > Date.now()) ? s.stars.boostUntil - Date.now() : 0;
    Game.ui.homeSig = active.map(function(t){ return t.uid; }).join(',');

    var tripsHtml;
    if (active.length) {
      tripsHtml = active.map(function(t){
        var o = t.order;
        var cargo = Game.data.cargo.find(function(c){ return c.id === o.cargoId; });
        var from = Game.city(o.from).name, to = Game.city(o.to).name;
        var p = Math.min(100, Math.max(0, (Date.now() - t.startedAt) / (t.endAt - t.startedAt) * 100));
        return `
          <div class="trip">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
              <div class="li-title">🚚 ${cargo.name} · ${from} → ${to}</div>
              <span class="small muted" data-trip="${t.uid}" data-remain>осталось ${Game.fmt.dur(t.endAt - Date.now())}</span>
            </div>
            <div class="progress" style="margin-top:6px"><i data-trip="${t.uid}" data-bar style="width:${p.toFixed(1)}%"></i></div>
          </div>`;
      }).join('');
    } else {
      tripsHtml = `
        <div class="empty" style="padding:18px 8px">
          <div class="big">🛣️</div>
          На дорогах пусто — машины не зарабатывают.<br>
          <span class="small muted">Возьмите заказ на бирже</span>
        </div>`;
    }

    root.innerHTML = `
      <div class="card">
        <div class="hero-title">🚚 «${Game.esc(Game.playerName)} Транс»</div>
        <div class="hero-sub">Уровень ${li.level} · опыт ${li.cur} / ${li.need} до следующего${boostLeft ? ' · ⭐ доход ×2 ещё ' + Game.fmt.dur(boostLeft) : ''}</div>
        <div class="progress" style="margin-top:10px"><i style="width:${xpPct}%"></i></div>
      </div>

      <div class="grid2">
        <div class="card">
          <div class="card-title">Свободные машины</div>
          <div class="stat-num">${s.trucks.length - active.length} / ${s.trucks.length}</div>
        </div>
        <div class="card">
          <div class="card-title">Водители готовы</div>
          <div class="stat-num">${rested} / ${s.drivers.length}</div>
        </div>
        <div class="card">
          <div class="stat-num" style="color:var(--ok)">${Game.fmt.money(s.money)}</div>
          <div class="stat-lbl">на счету</div>
        </div>
        <div class="card">
          <div class="stat-num">${s.stats.tripsDone}</div>
          <div class="stat-lbl">рейсов доставлено</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Сейчас в пути — ${active.length}</div>
        ${tripsHtml}
        ${active.length ? '' : '<button class="btn" id="go-market">🧭 Диспетчер</button>'}
      </div>

      <div class="row">
        <button class="btn secondary" id="go-garage">🚛 Автопарк</button>
        <button class="btn secondary" id="go-acc">🏢 Офис</button>
      </div>
    `;
    var gm = document.getElementById('go-market');
    var gg = document.getElementById('go-garage');
    var ga = document.getElementById('go-acc');
    if (gm) gm.onclick = function(){ Game.haptic('tap'); Game.navigate('market'); };
    if (gg) gg.onclick = function(){ Game.haptic('tap'); Game.navigate('garage'); };
    if (ga) ga.onclick = function(){ Game.haptic('tap'); Game.navigate('office'); };
  },

  onTick: function(){
    Game.updateTripWidgets();
    var sig = Game.state.trips.filter(function(t){ return t.status === 'active'; }).map(function(t){ return t.uid; }).join(',');
    if (sig !== Game.ui.homeSig) Game.navigate('home', true);
  }
};
