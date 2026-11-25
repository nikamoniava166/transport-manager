'use strict';
(function(){
  function eventChips(t){
    var now = Date.now(), elapsed = now - t.startedAt;
    var fired = t.events.filter(function(ev){ return ev.at <= elapsed; });
    if (!fired.length) return '<span class="small muted">В пути без происшествий…</span>';
    return fired.map(function(ev){
      switch (ev.type) {
        case 'traffic':    return '<span class="tag warn">🚧 пробка</span>';
        case 'goodclient': return '<span class="tag ok">🤝 клиент +10%</span>';
        case 'police':     return '<span class="tag danger">👮 штраф ' + Game.fmt.money(ev.fine) + '</span>';
        case 'bonusload':  return '<span class="tag ok">📦 попутный +30%</span>';
        case 'breakdown':  return '<span class="tag danger">⚡ поломка</span>';
      }
      return '';
    }).join(' ');
  }

  function findTruck(uid){
    var r = null;
    Game.state.trucks.forEach(function(x){ if (x.uid === uid) r = x; });
    return r;
  }
  function findDriver(uid){
    var r = null;
    Game.state.drivers.forEach(function(x){ if (x.uid === uid) r = x; });
    return r;
  }
  function findTrailer(uid){
    var r = null;
    (Game.state.trailers || []).forEach(function(x){ if (x.uid === uid) r = x; });
    return r;
  }

  function activeCard(t){
    var o = t.order;
    var cargo = Game.data.cargo.find(function(c){ return c.id === o.cargoId; });
    var truck = findTruck(t.truckUid), driver = findDriver(t.driverUid);
    var trailer = t.trailerUid ? findTrailer(t.trailerUid) : null;
    var flags = o.flags || [];
    var p = Math.min(100, Math.max(0, (Date.now() - t.startedAt) / (t.endAt - t.startedAt) * 100));
    return `
      <div class="trip">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <div class="li-title">🚛 ${truck ? Game.economy.effTruck(truck).name : 'Машина'} · ${cargo.name} ${Game.fmt.ton(o.weight)}</div>
          <span class="small muted" data-trip="${t.uid}" data-remain>осталось ${Game.fmt.dur(t.endAt - Date.now())}</span>
        </div>
        <div class="li-sub" style="margin-top:2px">📍 ${Game.city(o.from).name} → ${Game.city(o.to).name} · ${o.km} км · 👨‍✈️ ${driver ? Game.esc(driver.name) : '—'}${o.urgent ? ' · срочный' : ''}</div>
        ${flags.length ? '<div class="small muted" style="margin-top:2px">Требования: ' + flags.map(function(f){ return Game.flagLabel(f); }).join(', ') + (trailer ? ' · прицеп ' + Game.trailerType(trailer.tid).name : '') + '</div>' : ''}
        <div class="progress" style="margin:8px 0"><i data-trip="${t.uid}" data-bar style="width:${p.toFixed(1)}%"></i></div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <div class="chips" data-trip="${t.uid}" data-events>${eventChips(t)}</div>
          <span class="small muted">💰 ${Game.fmt.money(t.payFinal)}</span>
        </div>
      </div>`;
  }

  function histCard(t){
    var o = t.order;
    var cargo = Game.data.cargo.find(function(c){ return c.id === o.cargoId; });
    var net = t.net || 0;
    return `
      <div class="trip">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <div class="li-title">✅ ${Game.city(o.from).name} → ${Game.city(o.to).name} · ${cargo.name}</div>
          <span class="tag ${net >= 0 ? 'ok' : 'danger'}">${net >= 0 ? '+' : ''}${Game.fmt.money(net)}</span>
        </div>
        <div class="li-sub">🏁 ${new Date(t.finishedAt).toLocaleDateString('ru-RU')} · ${o.km} км${t.brk ? ' · ⚡ была поломка' : ''}</div>
      </div>`;
  }

  Game.screens.trips = {
    render: function(root){
      var s = Game.state;
      var active = s.trips.filter(function(t){ return t.status === 'active'; });
      var hist = s.trips.filter(function(t){ return t.status === 'done'; }).slice(-10).reverse();
      Game.ui.tripsSig = active.map(function(t){ return t.uid; }).join(',');
      root.innerHTML = `
        <div class="card">
          <div class="card-title">Активные рейсы — ${active.length}</div>
          ${active.length ? active.map(activeCard).join('') : '<div class="empty"><div class="big">🛣️</div>Сейчас все машины стоят.<br><span class="small">Возьмите заказ на бирже</span></div>'}
        </div>
        <div class="card">
          <div class="card-title">История — последние 10</div>
          ${hist.length ? hist.map(histCard).join('') : '<div class="empty">📋 Пока пусто</div>'}
        </div>
      `;
    },

    onTick: function(){
      Game.updateTripWidgets();
      document.querySelectorAll('[data-events]').forEach(function(el){
        var uid = +el.getAttribute('data-trip');
        var t = null;
        Game.state.trips.forEach(function(x){ if (x.uid === uid && x.status === 'active') t = x; });
        if (t) el.innerHTML = eventChips(t);
      });
      var sig = Game.state.trips.filter(function(t){ return t.status === 'active'; }).map(function(t){ return t.uid; }).join(',');
      if (sig !== Game.ui.tripsSig) Game.navigate('trips', true);
    }
  };
})();
