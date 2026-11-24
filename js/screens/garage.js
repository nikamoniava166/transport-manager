'use strict';
Game.screens.garage = {
  moneySensitive: true,

  render: function(root){
    var s = Game.state;
    var E = Game.economy;
    var D = Game.data;
    var lvl = Game.levelInfo(s.xp).level;

    function wearColor(w){ return w < 40 ? 'var(--ok)' : w < 70 ? 'var(--warn)' : 'var(--danger)'; }

    function upPanel(tr){
      var rows = D.upgrades.map(function(U){
        var lvl = (tr.up[U.id] || 0);
        var maxed = lvl >= U.levels;
        var cost = E.upgradeCost(tr, U.id);
        var busy = E.isBusy(tr.uid);
        var can = !maxed && !busy && s.money >= cost;
        var dots = '';
        for (var i = 0; i < U.levels; i++) dots += (i < lvl ? '●' : '○');
        return `
          <div class="list-item">
            <div class="li-main">
              <div class="li-title">${U.name} <span class="muted">${dots}</span></div>
              <div class="li-sub">${U.desc}</div>
            </div>
            <button class="btn small" data-buyup="${tr.uid}|${U.id}" ${can ? '' : 'disabled'}>${maxed ? 'МАКС' : Game.fmt.money(cost)}</button>
          </div>`;
      }).join('');
      return `<div class="panel">${rows}</div>`;
    }

    function truckCard(tr){
      var T = Game.truck(tr.tid);
      var eff = E.effTruck(tr);
      var tier = D.trucks.findIndex(function(x){ return x.id === tr.tid; }) + 1;
      var busy = E.isBusy(tr.uid);
      var repairCost = E.repairCost(tr);
      var needRepair = tr.wear > 0 && !busy && s.money >= repairCost;
      var panel = Game.ui.garageUpUid === tr.uid ? upPanel(tr) : '';
      return `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
            <div class="li-title">🚛 ${T.name}${busy ? ' <span class="tag accent">🛣️ в рейсе</span>' : ''}</div>
            <span class="tag">Т${tier} · №${tr.uid}</span>
          </div>
          <div class="li-sub" style="margin-top:4px">${Game.fmt.ton(eff.cap)} груз · ${eff.speed} км/ч · ${eff.cons} л/100 км · надёжность ${eff.rel}%</div>
          <div class="wear">
            <div class="progress"><i style="width:${Math.min(100, tr.wear)}%;background:${wearColor(tr.wear)}"></i></div>
            <div class="val">износ ${Math.round(tr.wear)}%</div>
          </div>
          ${panel}
          <div class="row">
            <button class="btn secondary" data-repair="${tr.uid}" ${needRepair ? '' : 'disabled'}>🔧 Ремонт${tr.wear > 0 && !busy ? ' · ' + Game.fmt.money(repairCost) : ''}</button>
            <button class="btn secondary" data-upg="${tr.uid}">⬆️ Апгрейды</button>
          </div>
        </div>`;
    }

    var cap = E.garageCap();
    var gLvl = s.garageLvl || 0;
    var gCost = E.garageUpCost();
    var freePlaces = Math.max(0, cap - s.trucks.length);
    var places = '';
    for (var gi = 0; gi < s.trucks.length; gi++) places += '🚛';
    for (var gj = 0; gj < freePlaces; gj++) places += '⬜';

    root.innerHTML = `
      <div class="card">
        <div class="card-title">🏗️ Гараж — уровень ${gLvl}</div>
        <div class="li-title">${s.trucks.length} / ${cap} ${Game.plural(cap, 'место', 'места', 'мест')} для машин</div>
        <div class="li-sub" style="font-size:15px;letter-spacing:2px;margin:4px 0 8px">${places}</div>
        ${gCost != null
          ? `<button class="btn" data-upggarage="1" ${s.money >= gCost ? '' : 'disabled'}>🏗️ Расширить (+2 места) · ${Game.fmt.money(gCost)}</button>`
          : '<div class="small muted center">Достигнут максимальный размер</div>'}
      </div>
      ${s.trucks.map(truckCard).join('')}
      <div class="card">
        <div class="card-title">У дилера</div>
        ${D.trucks.map(function(T){
          var locked = T.lvl > lvl;
          var afford = s.money >= T.price;
          var fullGarage = s.trucks.length >= cap;
          return `
            <div class="list-item">
              <div class="li-ico">🚛</div>
              <div class="li-main">
                <div class="li-title">${T.name}${locked ? ' 🔒' : ''}</div>
                <div class="li-sub">${Game.fmt.ton(T.cap)} · ${T.speed} км/ч · ${T.cons} л/100 км${locked ? ' · нужен ур. ' + T.lvl : ''}</div>
              </div>
              <button class="btn small" data-buy="${T.id}" ${(!locked && afford && !fullGarage) ? '' : 'disabled'}>${fullGarage && !locked ? 'Гараж полон' : locked ? '🔒 ур. ' + T.lvl : Game.fmt.money(T.price)}</button>
            </div>`;
        }).join('')}
      </div>
    `;

    root.querySelectorAll('[data-repair]').forEach(function(b){
      b.onclick = function(){
        var r = E.repair(+b.getAttribute('data-repair'));
        if (r.ok) { Game.haptic('ok'); Game.toast(r.msg, 'ok'); }
        else { Game.haptic('err'); Game.toast(r.msg, 'err'); }
        Game.navigate('garage', true);
      };
    });
    root.querySelectorAll('[data-upg]').forEach(function(b){
      b.onclick = function(){
        Game.haptic('tap');
        var uid = +b.getAttribute('data-upg');
        Game.ui.garageUpUid = Game.ui.garageUpUid === uid ? null : uid;
        Game.navigate('garage', true);
      };
    });
    root.querySelectorAll('[data-buyup]').forEach(function(b){
      b.onclick = function(){
        var parts = b.getAttribute('data-buyup').split('|');
        var r = E.upgrade(+parts[0], parts[1]);
        if (r.ok) { Game.haptic('ok'); Game.toast(r.msg, 'ok'); }
        else { Game.haptic('err'); Game.toast(r.msg, 'err'); }
        Game.navigate('garage', true);
      };
    });
    root.querySelectorAll('[data-buy]').forEach(function(b){
      b.onclick = function(){
        var r = E.buyTruck(b.getAttribute('data-buy'));
        if (r.ok) { Game.haptic('ok'); Game.toast(r.msg, 'ok'); }
        else { Game.haptic('err'); Game.toast(r.msg, 'err'); }
        Game.navigate('garage', true);
      };
    });
    root.querySelectorAll('[data-upggarage]').forEach(function(b){
      b.onclick = function(){
        var r = E.upgradeGarage();
        if (r.ok) { Game.haptic('ok'); Game.toast(r.msg, 'ok'); }
        else { Game.haptic('err'); Game.toast(r.msg, 'err'); }
        Game.navigate('garage', true);
      };
    });
  }
};
