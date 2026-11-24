'use strict';
Game.screens.market = {
  moneySensitive: true,

  render: function(root){
    var s = Game.state;
    var E = Game.economy;
    E.refreshMarket();
    var now = Date.now();
    Game.ui.marketSig = s.market.orders.map(function(o){ return o.uid; }).join(',');

    function orderCard(o){
      var cargo = Game.data.cargo.find(function(c){ return c.id === o.cargoId; });
      var from = Game.city(o.from).name, to = Game.city(o.to).name;
      var min = Math.round(Math.max(Game.data.minTripMin, Math.min(Game.data.maxTripMin, o.km / Game.data.kmPerMin)) * (o.urgent ? 0.75 : 1));
      var flags = o.flags || [];
      var flagTags = flags.map(function(f){ return f === 'reefer' ? '<span class="tag accent">❄️ нужен реф-прицеп</span>' : '<span class="tag warn">☣️ нужна цистерна ADR</span>'; }).join('');
      function fits(tr){
        if (E.isBusy(tr.uid)) return false;
        var e = E.effTruck(tr);
        return e.cap >= o.weight && flags.every(function(f){ return e.flags.indexOf(f) >= 0; });
      }
      var can = s.trucks.some(fits);
      var anyFlagged = s.trucks.some(function(tr){
        var e = E.effTruck(tr);
        return flags.every(function(f){ return e.flags.indexOf(f) >= 0; });
      });
      var noFitLabel = (flags.length && !anyFlagged) ? 'Нужен прицеп: ' + (flags[0] === 'reefer' ? 'рефрижератор' : 'цистерна') : 'Нет свободной машины под груз';
      var panel = '';
      if (Game.ui.dispatchOrderUid === o.uid) panel = dispatchPanel(o);
      return `
        <div class="card">
          <div class="li-title">📦 ${cargo.name} · ${Game.fmt.ton(o.weight)} ${o.urgent ? '<span class="tag warn">срочный ×1,5</span>' : ''}</div>
          <div class="li-sub" style="margin-top:4px">📍 ${from} → ${to} · ${o.km} км · ≈${min} мин · ⏳ ${Math.max(1, Math.round((o.expiresAt - now) / 60000))} мин на бирже</div>
          <div style="margin-top:8px">
            <span class="tag accent">💰 ${Game.fmt.money(o.pay)}</span>
            <span class="tag">нужно ≥ ${Game.fmt.ton(o.weight)} грузоподъёмности</span>
            ${flagTags}
          </div>
          ${panel || `<button class="btn" data-open="${o.uid}" ${can ? '' : 'disabled'}>${can ? '🚚 Отправить машину' : noFitLabel}</button>`}
        </div>`;
    }

    function dispatchPanel(o){
      var flags = o.flags || [];
      function fits(tr){
        var e = E.effTruck(tr);
        return e.cap >= o.weight && flags.every(function(f){ return e.flags.indexOf(f) >= 0; });
      }
      var freeTrucks = s.trucks.filter(function(tr){ return !E.isBusy(tr.uid); });
      var fitTrucks = freeTrucks.filter(fits);
      var unfit = freeTrucks.filter(function(tr){ return !fits(tr); });

      // выбранная машина (по умолчанию — первая подходящая)
      var selTruck = null;
      if (Game.ui.mktSel && Game.ui.mktSel.truckUid) {
        fitTrucks.forEach(function(tr){ if (tr.uid === Game.ui.mktSel.truckUid) selTruck = tr; });
      }
      if (!selTruck && fitTrucks.length) selTruck = fitTrucks[0];

      // выбранный водитель: сохранённый или первый готовый
      var selDriver = null;
      if (Game.ui.mktSel && Game.ui.mktSel.driverUid) {
        s.drivers.forEach(function(d){ if (d.uid === Game.ui.mktSel.driverUid) selDriver = d; });
      }
      if (!selDriver) {
        s.drivers.forEach(function(d){
          if (!E.driverBusy(d.uid) && d.restUntil <= now) selDriver = d;
        });
      }
      if (selDriver && (E.driverBusy(selDriver.uid) || selDriver.restUntil > now)) selDriver = null;

      var fuel = selTruck ? E.fuelCost(o.km, E.effTruck(selTruck).cons) : 0;
      var advance = selDriver ? Math.round(o.pay * selDriver.share / 100) : 0;
      var enough = s.money >= fuel + advance;
      var ok = !!(selTruck && selDriver && enough);

      // запоминаем текущий выбор для кнопки «В рейс»
      Game.ui.mktSel = { truckUid: selTruck ? selTruck.uid : 0, driverUid: selDriver ? selDriver.uid : 0 };

      function truckChips(list, fit){
        return list.map(function(tr){
          var e = E.effTruck(tr);
          var sel = selTruck && selTruck.uid === tr.uid;
          var hint = (!fit && flags.some(function(f){ return e.flags.indexOf(f) < 0; })) ? ' · нужен прицеп' : '';
          return `<button class="chip ${sel ? 'sel' : ''}" ${fit ? '' : 'disabled'} data-tsel="${tr.uid}">${Game.truck(tr.tid).name} · ${Game.fmt.ton(e.cap)}${hint}</button>`;
        }).join('');
      }

      var driverChips = s.drivers.map(function(d){
        var busy = E.driverBusy(d.uid);
        var rest = !busy && d.restUntil > now;
        var sel = selDriver && selDriver.uid === d.uid;
        var label = Game.esc(d.name) + (busy ? ' · в рейсе' : rest ? ' · отдых ' + Math.ceil((d.restUntil - now) / 60000) + ' мин' : '');
        return `<button class="chip ${sel ? 'sel' : ''}" ${(busy || rest) ? 'disabled' : ''} data-dsel="${d.uid}">${label}</button>`;
      }).join('');

      return `
        <div class="panel">
          <div class="small muted" style="margin-bottom:6px">Машина</div>
          <div class="chips">
            ${fitTrucks.length ? truckChips(fitTrucks, true) : '<span class="small muted">Нет свободной машины под этот груз</span>'}
            ${truckChips(unfit, false)}
          </div>
          <div class="small muted" style="margin:6px 0">Водитель</div>
          <div class="chips">${driverChips || '<span class="small muted">Нет водителей — наймите в разделе «Ещё»</span>'}</div>
          <div class="small" style="margin-top:8px">
            ⛽ Топливо: <b style="color:var(--danger)">${Game.fmt.money(fuel)}</b> ·
            👨‍✈️ Аванс: <b style="color:var(--danger)">${Game.fmt.money(advance)}</b> ·
            💰 По доставке: <b style="color:var(--ok)">${Game.fmt.money(o.pay)}</b>
          </div>
          <div class="row" style="margin-top:10px">
            <button class="btn" data-go="${o.uid}" ${ok ? '' : 'disabled'}>${enough ? '🚚 В рейс!' : 'Не хватает денег'}</button>
            <button class="btn secondary" data-cancel="1">Отмена</button>
          </div>
        </div>`;
    }

    root.innerHTML = `
      <div class="card placeholder-card center">
        <b>Биржа заказов</b>
        <div class="small muted" style="margin-top:4px">Заказов: ${s.market.orders.length} / ${E.marketSlots()} · список обновляется сам</div>
      </div>
      ${s.market.orders.map(orderCard).join('') || '<div class="card"><div class="empty">Биржа пуста — новые заказы появятся в течение минуты</div></div>'}
    `;

    root.querySelectorAll('[data-open]').forEach(function(b){
      b.onclick = function(){
        Game.haptic('tap');
        Game.ui.dispatchOrderUid = +b.getAttribute('data-open');
        Game.ui.mktSel = null;
        Game.navigate('market', true);
      };
    });
    root.querySelectorAll('[data-tsel]').forEach(function(b){
      b.onclick = function(){
        Game.ui.mktSel = Game.ui.mktSel || {};
        Game.ui.mktSel.truckUid = +b.getAttribute('data-tsel');
        Game.navigate('market', true);
      };
    });
    root.querySelectorAll('[data-dsel]').forEach(function(b){
      b.onclick = function(){
        Game.ui.mktSel = Game.ui.mktSel || {};
        Game.ui.mktSel.driverUid = +b.getAttribute('data-dsel');
        Game.navigate('market', true);
      };
    });
    root.querySelectorAll('[data-cancel]').forEach(function(b){
      b.onclick = function(){
        Game.ui.dispatchOrderUid = null;
        Game.navigate('market', true);
      };
    });
    root.querySelectorAll('[data-go]').forEach(function(b){
      b.onclick = function(){
        var uid = +b.getAttribute('data-go');
        var sel = Game.ui.mktSel || {};
        var r = E.dispatch(uid, sel.truckUid || 0, sel.driverUid || 0);
        if (r.ok) {
          Game.haptic('ok');
          Game.ui.dispatchOrderUid = null;
          var t = r.trip, o = t.order;
          var cargo = Game.data.cargo.find(function(c){ return c.id === o.cargoId; });
          var tr = null;
          s.trucks.forEach(function(x){ if (x.uid === t.truckUid) tr = x; });
          Game.toast('🚚 ' + (tr ? Game.truck(tr.tid).name : 'Машина') + ' повезла ' + cargo.name.toLowerCase() + ': ' + Game.city(o.from).name + ' → ' + Game.city(o.to).name, 'ok');
        } else {
          Game.haptic('err');
          Game.toast(r.msg, 'err');
        }
        Game.navigate('market', true);
      };
    });
  },

  onTick: function(){
    // пока открыт выбор машины/водителя — список не перерисовываем
    if (Game.ui.dispatchOrderUid != null) return;
    var sig = Game.state.market.orders.map(function(o){ return o.uid; }).join(',');
    if (sig !== Game.ui.marketSig) Game.navigate('market', true);
  }
};
