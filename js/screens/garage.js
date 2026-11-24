'use strict';
Game.screens.garage = {
  moneySensitive: true,

  render: function(root){
    var s = Game.state;
    var E = Game.economy;
    var D = Game.data;
    var lvl = Game.levelInfo(s.xp).level;
    var pickFor = Game.ui.garageTrailerFor || null;

    function wearColor(w){ return w < 40 ? 'var(--ok)' : w < 70 ? 'var(--warn)' : 'var(--danger)'; }
    function flagLabel(f){ return f === 'reefer' ? '❄️ реф' : '☣️ ADR'; }

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

    function trailerRow(tr){
      var eff = E.effTruck(tr);
      var trailer = eff.trailer;
      var busy = E.isBusy(tr.uid);
      if (trailer) {
        var TT = Game.trailerType(trailer.tid);
        var cost = E.trailerRepairCost(trailer);
        return `
          <div class="panel" style="padding-top:8px">
            <div class="small"><b>🛻 Прицеп:</b> ${TT.name} · +${Game.fmt.ton(TT.capAdd)} → итого ${Game.fmt.ton(eff.cap)}${TT.flags.length ? ' · ' + TT.flags.map(flagLabel).join(' ') : ''}</div>
            <div class="wear">
              <div class="progress"><i style="width:${Math.min(100, trailer.wear)}%;background:${wearColor(trailer.wear)}"></i></div>
              <div class="val">износ ${Math.round(trailer.wear)}%</div>
            </div>
            <div class="row">
              <button class="btn secondary small" data-trepair="${trailer.uid}" ${(trailer.wear > 0 && !busy && s.money >= cost) ? '' : 'disabled'}>🔧 Ремонт${trailer.wear > 0 && !busy ? ' · ' + Game.fmt.money(cost) : ''}</button>
              <button class="btn secondary small" data-tdetach="${trailer.uid}" ${busy ? 'disabled' : ''}>Отцепить</button>
            </div>
          </div>`;
      }
      var yard = s.trailers.filter(function(t){ return !t.attachedTo; });
      var fit = yard.filter(function(t){ return E.canTow(tr.uid, t.tid); });
      var html = `<div class="panel" style="padding-top:8px"><div class="small muted">Прицепа нет · грузоподъёмность ${Game.fmt.ton(eff.cap)}</div>`;
      if (pickFor === tr.uid) {
        html += fit.length
          ? `<div class="small" style="margin-top:6px">Прицепы на складе, подходящие этой машине:</div>
             <div class="chips">${fit.map(function(t){
               var TT = Game.trailerType(t.tid);
               return `<button class="chip" data-tattach="${t.uid}|${tr.uid}">${TT.name} · +${Game.fmt.ton(TT.capAdd)}${TT.flags.length ? ' ' + TT.flags.map(flagLabel).join(' ') : ''}</button>`;
             }).join('')}</div>
             <button class="btn secondary small" data-tpickoff="1" style="margin-top:4px">Отмена</button>`
          : '<div class="small muted" style="margin-top:6px">На складе нет подходящего прицепа — купите ниже</div>';
      } else {
        html += `<button class="btn secondary small" style="margin-top:6px" data-tpick="${tr.uid}" ${yard.length ? '' : 'disabled'}>➕ Прицепить прицеп</button>`;
      }
      return html + '</div>';
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
            <div class="li-title">🚚 ${T.name}${busy ? ' <span class="tag accent">🛣️ в рейсе</span>' : ''}</div>
            <span class="tag">Т${tier} · №${tr.uid}</span>
          </div>
          <div class="li-sub" style="margin-top:4px">${Game.fmt.ton(eff.cap)} груз${eff.trailer ? ' (с прицепом)' : ''} · ${eff.speed} км/ч · ${eff.cons} л/100 км · надёжность ${eff.rel}%</div>
          <div class="wear">
            <div class="progress"><i style="width:${Math.min(100, tr.wear)}%;background:${wearColor(tr.wear)}"></i></div>
            <div class="val">износ ${Math.round(tr.wear)}%</div>
          </div>
          ${trailerRow(tr)}
          ${panel}
          <div class="row">
            <button class="btn secondary" data-repair="${tr.uid}" ${needRepair ? '' : 'disabled'}>🔧 Ремонт${tr.wear > 0 && !busy ? ' · ' + Game.fmt.money(repairCost) : ''}</button>
            <button class="btn secondary" data-upg="${tr.uid}">⬆️ Апгрейды</button>
          </div>
        </div>`;
    }

    function dealerTrailerRow(TT){
      var afford = s.money >= TT.price;
      var compatible = s.trucks.some(function(tr){ return Game.truck(tr.tid).cap >= TT.minCap; });
      return `
        <div class="list-item">
          <div class="li-ico">🛻</div>
          <div class="li-main">
            <div class="li-title">${TT.name}${TT.flags.length ? ' ' + TT.flags.map(flagLabel).join(' ') : ''}</div>
            <div class="li-sub">+${Game.fmt.ton(TT.capAdd)} к грузоподъёмности · расход +${Math.round(TT.consAdd * 100)}% · тягач от ${Game.fmt.ton(TT.minCap)}${compatible ? '' : ' · 🔒 нет подходящего грузовика'}</div>
          </div>
          <button class="btn small" data-buytrailer="${TT.id}" ${afford ? '' : 'disabled'}>${Game.fmt.money(TT.price)}</button>
        </div>`;
    }

    var cap = E.garageCap();
    var gLvl = s.garageLvl || 0;
    var gCost = E.garageUpCost();
    var freePlaces = Math.max(0, cap - s.trucks.length);
    var places = '';
    for (var gi = 0; gi < s.trucks.length; gi++) places += '🚛';
    for (var gj = 0; gj < freePlaces; gj++) places += '⬜';
    var yardCount = s.trailers.filter(function(t){ return !t.attachedTo; }).length;

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
        <div class="card-title">Прицепы${yardCount ? ' · на складе ' + yardCount : ''}</div>
        <div class="small muted" style="margin-bottom:4px">Один прицеп на грузовик · не занимают места в гараже · прикрепляются из карточки машины</div>
        ${D.trailers.map(dealerTrailerRow).join('')}
      </div>
      <div class="card">
        <div class="card-title">У дилера — грузовики</div>
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
    root.querySelectorAll('[data-upggarage]').forEach(function(b){
      b.onclick = function(){
        var r = E.upgradeGarage();
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
    root.querySelectorAll('[data-buytrailer]').forEach(function(b){
      b.onclick = function(){
        var r = E.buyTrailer(b.getAttribute('data-buytrailer'));
        if (r.ok) { Game.haptic('ok'); Game.toast(r.msg, 'ok'); }
        else { Game.haptic('err'); Game.toast(r.msg, 'err'); }
        Game.navigate('garage', true);
      };
    });
    root.querySelectorAll('[data-tpick]').forEach(function(b){
      b.onclick = function(){
        Game.haptic('tap');
        var uid = +b.getAttribute('data-tpick');
        Game.ui.garageTrailerFor = Game.ui.garageTrailerFor === uid ? null : uid;
        Game.navigate('garage', true);
      };
    });
    root.querySelectorAll('[data-tpickoff]').forEach(function(b){
      b.onclick = function(){
        Game.ui.garageTrailerFor = null;
        Game.navigate('garage', true);
      };
    });
    root.querySelectorAll('[data-tattach]').forEach(function(b){
      b.onclick = function(){
        var p = b.getAttribute('data-tattach').split('|');
        var r = E.attachTrailer(+p[0], +p[1]);
        Game.ui.garageTrailerFor = null;
        if (r.ok) { Game.haptic('ok'); Game.toast(r.msg, 'ok'); }
        else { Game.haptic('err'); Game.toast(r.msg, 'err'); }
        Game.navigate('garage', true);
      };
    });
    root.querySelectorAll('[data-tdetach]').forEach(function(b){
      b.onclick = function(){
        var r = E.detachTrailer(+b.getAttribute('data-tdetach'));
        if (r.ok) { Game.haptic('tap'); Game.toast(r.msg); }
        else { Game.haptic('err'); Game.toast(r.msg, 'err'); }
        Game.navigate('garage', true);
      };
    });
    root.querySelectorAll('[data-trepair]').forEach(function(b){
      b.onclick = function(){
        var r = E.repairTrailer(+b.getAttribute('data-trepair'));
        if (r.ok) { Game.haptic('ok'); Game.toast(r.msg, 'ok'); }
        else { Game.haptic('err'); Game.toast(r.msg, 'err'); }
        Game.navigate('garage', true);
      };
    });
  }
};
