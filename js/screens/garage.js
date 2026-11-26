'use strict';
Game.screens.garage = {
  moneySensitive: true,

  render: function(root){
    var s = Game.state;
    var E = Game.economy;
    var D = Game.data;
    var pickFor = Game.ui.garageTrailerFor || null;

    function wearColor(w){ return w < 40 ? 'var(--ok)' : w < 70 ? 'var(--warn)' : 'var(--danger)'; }
    function flagLabel(f){ return Game.flagLabel(f, true); }

    // краткая строка сервиса в карточке машины: ТО и двигатель
    function serviceBrief(tr){
      var left = Game.data.serviceIntervalKm - (tr.serviceKm || 0);
      var note = left > 0 ? 'ТО через ' + Game.fmt.km(left) : '⚠ ТО просрочено на ' + Game.fmt.km(-left);
      if (tr.engineBroken) note += ' · ⚠ двигатель сломан';
      return note + ' · двигатель ' + Math.round(tr.engine || 0) + '%';
    }

    // панель обслуживания: узлы, двигатель, ТО
    function servicePanel(tr){
      var T = Game.truck(tr.tid);
      var eff = E.effTruck(tr);
      var busy = E.isBusy(tr.uid);
      var wh = s.warehouse || { parts: 0, tires: 0, kits: 0 };
      var svcCost = E.serviceCost(tr);
      var canSvc = !busy && (wh.parts >= (Game.data.serviceParts || 2)) && s.money >= svcCost;
      var left = Game.data.serviceIntervalKm - (tr.serviceKm || 0);
      var svcNote = left > 0 ? 'до ТО ' + Game.fmt.km(left) : '⚠ ТО просрочено на ' + Game.fmt.km(-left);
      var mechFree = E.freeMechanic().length > 0;
      var mechNote = mechFree ? '' : '<div class="small muted" style="margin:6px 0 2px">Нет свободного механика — замены узлов и капремонт делают только они (найм в «Офисе»)</div>';
      var rows = Game.data.nodes.map(function(N){
        if (N.noElec && eff.elec) {
          return '<div class="nrow"><span class="nname">' + N.name + '</span><span class="nval muted">⚡ не требуется</span></div>';
        }
        var w = (tr.nodes && tr.nodes[N.id]) || 0;
        var cost = E.nodeCost(tr, N);
        var can = !busy && w >= 5 && mechFree && wh.parts >= 1 && s.money >= cost;
        return `<div class="nrow">
          <span class="nname">${N.name}</span>
          <span class="nbar"><i style="width:${Math.min(100, w)}%;background:${wearColor(w)}"></i></span>
          <span class="nval">${Math.round(w)}%</span>
          <button class="btn mini" data-swap="${tr.uid}|${N.id}" ${can ? '' : 'disabled'}>${w >= 5 ? Game.fmt.money(cost) : '—'}</button>
        </div>`;
      }).join('');
      var eng = Math.round(tr.engine || 0);
      var engCost = Math.max(100, Math.round(T.price * Game.data.engineRepairMoneyK / 100) * 100);
      var canEng = !busy && mechFree && (wh.kits || 0) >= 1 && s.money >= engCost && (tr.engineBroken || eng >= 5);
      var engRow = `<div class="nrow">
        <span class="nname">Двигатель</span>
        <span class="nbar"><i style="width:${Math.min(100, eng)}%;background:${wearColor(eng)}"></i></span>
        <span class="nval">${eng}%</span>
        <button class="btn mini" data-engrep="${tr.uid}" ${canEng ? '' : 'disabled'}>${tr.engineBroken ? 'Капремонт!' : Game.fmt.money(engCost)}</button>
      </div>` + ((wh.kits || 0) < 1 ? '<div class="small muted" style="margin:-2px 0 0 6px">для капремонта нужен набор со склада</div>' : '');
      return `<div class="panel">
        <div class="small"><b>${Game.ico('wrench')} Обслуживание</b> · ${svcNote}</div>
        ${mechNote}
        <div class="ngrid">${rows}${engRow}</div>
        <button class="btn secondary small" data-service="${tr.uid}" ${canSvc ? '' : 'disabled'}>${Game.ico('cog')} ТО · запчасти ×${Game.data.serviceParts} + ${Game.fmt.money(svcCost)}</button>
      </div>`;
    }

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
            <div class="small"><b>${Game.ico('boxes')} Прицеп:</b> ${TT.name} · +${Game.fmt.ton(TT.capAdd)} → итого ${Game.fmt.ton(eff.cap)}${TT.flags.length ? ' · ' + TT.flags.map(flagLabel).join(' ') : ''}</div>
            <div class="wear">
              <div class="progress"><i style="width:${Math.min(100, trailer.wear)}%;background:${wearColor(trailer.wear)}"></i></div>
              <div class="val">износ ${Math.round(trailer.wear)}%</div>
            </div>
            <div class="row">
              <button class="btn secondary small" data-trepair="${trailer.uid}" ${(trailer.wear > 0 && !busy) ? '' : 'disabled'}>${Game.ico('wrench')} Ремонт${trailer.wear > 0 && !busy ? ' · ' + Game.fmt.money(cost) : ''}</button>
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
        html += `<button class="btn secondary small" style="margin-top:6px" data-tpick="${tr.uid}" ${yard.length ? '' : 'disabled'}>${Game.ico('plus')} Прицепить прицеп</button>`;
      }
      return html + '</div>';
    }

    function truckCard(tr){
      var T = Game.truck(tr.tid);
      var eff = E.effTruck(tr);
      var tier = D.trucks.findIndex(function(x){ return x.id === tr.tid; }) + 1;
      var busy = E.isBusy(tr.uid);
      var drv = null;
      s.drivers.forEach(function(x){ if (x.truckUid === tr.uid) drv = x; });
      var repairCost = E.repairCost(tr);
      var needRepair = tr.wear > 0 && !busy; // деньги/запчасти проверит E.repair — тост объяснит, чего не хватает
      var tireW = tr.tires || 0;
      var whTires = (s.warehouse && s.warehouse.tires) || 0;
      var canTires = !busy && tireW >= 5 && whTires >= D.tireSetSize;
      var tireNote = tireW >= D.tireMaxWear ? ' — на рейс нельзя' : tireW >= D.tireRiskWear ? ' · риск поломки' : '';
      var sellPrice = E.sellPrice(T.price, tr.wear, { ageWeeks: E.truckAgeWeeks(tr), engine: tr.engine || 0, nodesAvg: E.nodesAvg(tr) });
      var canSell = !busy && s.trucks.length > 1;
      var panel = Game.ui.garageUpUid === tr.uid ? upPanel(tr) : '';
      var drvBlock = '';
      if (Game.ui.garageDrvFor === tr.uid) {
        var freeDrv = s.drivers.filter(function(x){ return !x.truckUid && !E.driverBusy(x.uid); });
        drvBlock = `<div class="panel" style="padding-top:8px"><div class="small muted">Кто поедет на этой машине:</div><div class="chips">${
          freeDrv.map(function(x){ return `<button class="chip" data-attdrv="${x.uid}|${tr.uid}">${Game.esc(x.name)}</button>`; }).join('') || '<span class="small muted">Свободных водителей нет</span>'
        }</div><button class="btn secondary small" data-drvpickoff="1" style="margin-top:4px">Отмена</button></div>`;
      } else if (drv) {
        drvBlock = `<button class="btn secondary small" data-detdrv="${drv.uid}" ${E.driverBusy(drv.uid) ? 'disabled' : ''}>${Game.ico('lock-open')} Открепить ${Game.esc(drv.name)}</button>`;
      } else {
        drvBlock = `<button class="btn secondary small" data-drvpick="${tr.uid}">${Game.ico('user-round')} Закрепить водителя</button>`;
      }
      return `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
            <div class="li-title">${Game.ico('truck')} ${T.name}${busy ? ' <span class="tag accent">' + Game.ico('route') + ' в рейсе</span>' : ''}</div>
            <span class="tag">Т${tier} · №${tr.uid}</span>
          </div>
          <div class="li-sub" style="margin-top:4px">${Game.fmt.ton(eff.cap)} груз${eff.trailer ? ' (с прицепом)' : ''} · ${eff.speed} км/ч · ${eff.cons} ${eff.elec ? 'кВт·ч/100 км ' + Game.ico('zap') : 'л/100 км'} · надёжность ${eff.rel}%${tr.km > 0 ? ' · пробег ' + Game.fmt.km(tr.km) : ''}</div>
          <div class="li-sub">${Game.ico('user-round')} ${drv ? Game.esc(drv.name) + (E.driverBusy(drv.uid) ? ' · в рейсе' : ' · усталость ' + Math.round(drv.fatigue || 0) + '%') : '<b>без водителя — рейсов не берёт</b>'}</div>
          <div class="wear">
            <div class="progress"><i style="width:${Math.min(100, tr.wear)}%;background:${wearColor(tr.wear)}"></i></div>
            <div class="val">износ ${Math.round(tr.wear)}%</div>
          </div>
          <div class="wear">
            <div class="progress"><i style="width:${Math.min(100, tireW)}%;background:${wearColor(tireW)}"></i></div>
            <div class="val">шины ${Math.round(tireW)}%${tireNote}</div>
          </div>
          <div class="li-sub">${Game.ico('wrench')} ${serviceBrief(tr)}</div>
          ${trailerRow(tr)}
          ${panel}
          ${Game.ui.garageSvcUid === tr.uid ? servicePanel(tr) : ''}
          <div class="row">
            <button class="btn secondary" data-repair="${tr.uid}" ${needRepair ? '' : 'disabled'}>${Game.ico('wrench')} Ремонт${tr.wear > 0 && !busy ? ' · ' + Game.fmt.money(repairCost) : ''}</button>
            <button class="btn secondary" data-upg="${tr.uid}">${Game.ico('arrow-up')} Апгрейды</button>
          </div>
          <div class="row" style="margin-top:6px">
            <button class="btn secondary small" data-tires="${tr.uid}" ${canTires ? '' : 'disabled'}>${Game.ico('circle-dot')} Шины · ${D.tireSetSize} шт</button>
            <button class="btn secondary small" data-svc="${tr.uid}">${Game.ico('wrench')} Сервис</button>
            <button class="btn secondary small" data-sell="${tr.uid}|${sellPrice}" ${canSell ? '' : 'disabled'}>${s.trucks.length > 1 ? Game.ico('tag') + ' ' + Game.fmt.money(sellPrice) : Game.ico('tag') + ' Продать'}</button>
          </div>
          <div class="row" style="margin-top:6px">${drvBlock}</div>
        </div>`;
    }

    // свои прицепы: где стоит, износ и цена скупщика
    function ownTrailerRow(t){
      var TT = Game.trailerType(t.tid);
      var host = null;
      if (t.attachedTo) s.trucks.forEach(function(x){ if (x.uid === t.attachedTo) host = x; });
      var place = host ? 'прицеплен: ' + Game.truck(host.tid).name + ' №' + host.uid : 'на складе';
      var onTrip = host ? E.isBusy(host.uid) : false;
      var price = E.sellPrice(TT.price, t.wear);
      return `
        <div class="list-item">
          <div class="li-ico">${Game.ico('boxes')}</div>
          <div class="li-main">
            <div class="li-title">${TT.name}${TT.flags.length ? ' ' + TT.flags.map(flagLabel).join(' ') : ''}</div>
            <div class="li-sub">${place} · износ ${Math.round(t.wear)}%${onTrip ? ' · ' + Game.ico('route') + ' в рейсе' : ''}</div>
          </div>
          <button class="btn secondary small" data-tsell="${t.uid}|${price}" ${onTrip ? 'disabled' : ''}>${Game.ico('tag')} ${Game.fmt.money(price)}</button>
        </div>`;
    }

    var cap = E.garageCap();
    var wh = s.warehouse || { parts: 0, tires: 0 };
    var gLvl = s.garageLvl || 0;
    var gCost = E.garageUpCost();
    var freePlaces = Math.max(0, cap - s.trucks.length);
    var places = '';
    for (var gi = 0; gi < s.trucks.length; gi++) places += Game.ico('truck');
    for (var gj = 0; gj < freePlaces; gj++) places += Game.ico('square');

    root.innerHTML = `
      <div class="card">
        <div class="card-title">${Game.ico('warehouse')} Гараж — уровень ${gLvl}</div>
        <div class="li-title">${s.trucks.length} / ${cap} ${Game.plural(cap, 'место', 'места', 'мест')} для машин</div>
        <div class="li-sub" style="font-size:15px;letter-spacing:2px;margin:4px 0 8px">${places}</div>
        ${gCost != null
          ? `<button class="btn" data-upggarage="1" ${s.money >= gCost ? '' : 'disabled'}>${Game.ico('warehouse')} Расширить (+2 места) · ${Game.fmt.money(gCost)}</button>`
          : '<div class="small muted center">Достигнут максимальный размер</div>'}
      </div>
      <div class="card">
        <div class="card-title">${Game.ico('package')} Склад</div>
        <div class="list-item">
          <div class="li-ico">${Game.ico('cog')}</div>
          <div class="li-main">
            <div class="li-title">Запчасти · ${wh.parts}</div>
            <div class="li-sub">${Game.fmt.money(D.partPrice)} за штуку</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn secondary small" data-buyw="parts|1" ${s.money >= D.partPrice ? '' : 'disabled'}>×1</button>
            <button class="btn secondary small" data-buyw="parts|5" ${s.money >= D.partPrice * 5 ? '' : 'disabled'}>×5</button>
          </div>
        </div>
        <div class="list-item">
          <div class="li-ico">${Game.ico('circle-dot')}</div>
          <div class="li-main">
            <div class="li-title">Шины · ${wh.tires}</div>
            <div class="li-sub">${Game.fmt.money(D.tirePrice)} за штуку</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn secondary small" data-buyw="tires|1" ${s.money >= D.tirePrice ? '' : 'disabled'}>×1</button>
            <button class="btn secondary small" data-buyw="tires|5" ${s.money >= D.tirePrice * 5 ? '' : 'disabled'}>×5</button>
          </div>
        </div>
        <div class="list-item">
          <div class="li-ico">${Game.ico('package')}</div>
          <div class="li-main">
            <div class="li-title">Наборы для капремонта · ${wh.kits || 0}</div>
            <div class="li-sub">${Game.fmt.money(D.engineKitPrice)} за штуку · ремонт двигателя</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn secondary small" data-buyw="kits|1" ${s.money >= D.engineKitPrice ? '' : 'disabled'}>×1</button>
          </div>
        </div>
        <div class="small muted">Расходуются на ремонт техники, замену шин и ТО; наборы — на капремонт двигателя</div>
      </div>
      ${s.trucks.map(truckCard).join('')}
      <div class="card">
        <div class="card-title">Прицепы${s.trailers.length ? ' · ваши ' + s.trailers.length : ''}</div>
        <div class="small muted" style="margin-bottom:4px">Один прицеп на грузовик · не занимают места в гараже · прикрепляются из карточки машины, продаются здесь</div>
        ${s.trailers.length
          ? s.trailers.map(ownTrailerRow).join('')
          : '<div class="small muted" style="margin-top:4px">Своих прицепов пока нет — покупка на вкладке «Салон»</div>'}
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
    root.querySelectorAll('[data-tires]').forEach(function(b){
      b.onclick = function(){
        var r = E.replaceTires(+b.getAttribute('data-tires'));
        if (r.ok) { Game.haptic('ok'); Game.toast(r.msg, 'ok'); }
        else { Game.haptic('err'); Game.toast(r.msg, 'err'); }
        Game.navigate('garage', true);
      };
    });
    root.querySelectorAll('[data-svc]').forEach(function(b){
      b.onclick = function(){
        Game.haptic('tap');
        var uid = +b.getAttribute('data-svc');
        Game.ui.garageSvcUid = Game.ui.garageSvcUid === uid ? null : uid;
        Game.navigate('garage', true);
      };
    });
    root.querySelectorAll('[data-service]').forEach(function(b){
      b.onclick = function(){
        var r = E.serviceTruck(+b.getAttribute('data-service'));
        if (r.ok) { Game.haptic('ok'); Game.toast(r.msg, 'ok'); }
        else { Game.haptic('err'); Game.toast(r.msg, 'err'); }
        Game.navigate('garage', true);
      };
    });
    root.querySelectorAll('[data-swap]').forEach(function(b){
      b.onclick = function(){
        var p = b.getAttribute('data-swap').split('|');
        var r = E.swapNode(+p[0], p[1]);
        if (r.ok) { Game.haptic('ok'); Game.toast(r.msg, 'ok'); }
        else { Game.haptic('err'); Game.toast(r.msg, 'err'); }
        Game.navigate('garage', true);
      };
    });
    root.querySelectorAll('[data-engrep]').forEach(function(b){
      b.onclick = function(){
        var r = E.repairEngine(+b.getAttribute('data-engrep'));
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
    root.querySelectorAll('[data-buyw]').forEach(function(b){
      b.onclick = function(){
        var p = b.getAttribute('data-buyw').split('|');
        var r = p[0] === 'parts' ? E.buyParts(+p[1]) : p[0] === 'kits' ? E.buyKit() : E.buyTires(+p[1]);
        if (r.ok) { Game.haptic('ok'); Game.toast(r.msg, 'ok'); }
        else { Game.haptic('err'); Game.toast(r.msg, 'err'); }
        Game.navigate('garage', true);
      };
    });
    root.querySelectorAll('[data-drvpick]').forEach(function(b){
      b.onclick = function(){
        Game.haptic('tap');
        var uid = +b.getAttribute('data-drvpick');
        Game.ui.garageDrvFor = Game.ui.garageDrvFor === uid ? null : uid;
        Game.navigate('garage', true);
      };
    });
    root.querySelectorAll('[data-drvpickoff]').forEach(function(b){
      b.onclick = function(){
        Game.ui.garageDrvFor = null;
        Game.navigate('garage', true);
      };
    });
    root.querySelectorAll('[data-attdrv]').forEach(function(b){
      b.onclick = function(){
        var p = b.getAttribute('data-attdrv').split('|');
        var r = E.attachDriver(+p[0], +p[1]);
        Game.ui.garageDrvFor = null;
        if (r.ok) { Game.haptic('ok'); Game.toast(r.msg, 'ok'); }
        else { Game.haptic('err'); Game.toast(r.msg, 'err'); }
        Game.navigate('garage', true);
      };
    });
    root.querySelectorAll('[data-detdrv]').forEach(function(b){
      b.onclick = function(){
        var r = E.detachDriver(+b.getAttribute('data-detdrv'));
        if (r.ok) { Game.haptic('tap'); Game.toast(r.msg); }
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

    // продажа машины: двухшаговое подтверждение (как у сброса прогресса), откат через 4 с
    root.querySelectorAll('[data-sell]').forEach(function(b){
      var parts = b.getAttribute('data-sell').split('|');
      var uid = +parts[0], price = +parts[1];
      var armed = false, timer = null;
      b.onclick = function(){
        if (!armed) {
          armed = true;
          b.className = 'btn small';
          b.textContent = 'Точно продать за ' + Game.fmt.money(price) + '?';
          Game.haptic('tap');
          timer = setTimeout(function(){
            armed = false;
            b.className = 'btn secondary small';
            b.innerHTML = Game.ico('tag') + ' Продать · ' + Game.fmt.money(price);
          }, 4000);
        } else {
          clearTimeout(timer);
          var r = E.sellTruck(uid);
          if (r.ok) { Game.haptic('ok'); Game.toast(r.msg, 'ok'); Game.updateHUD(); }
          else { Game.haptic('err'); Game.toast(r.msg, 'err'); }
          Game.navigate('garage', true);
        }
      };
    });

    // продажа прицепа — тот же двухшаговый паттерн
    root.querySelectorAll('[data-tsell]').forEach(function(b){
      var parts = b.getAttribute('data-tsell').split('|');
      var uid = +parts[0], price = +parts[1];
      var armed = false, timer = null;
      b.onclick = function(){
        if (!armed) {
          armed = true;
          b.className = 'btn small';
          b.textContent = 'Точно за ' + Game.fmt.money(price) + '?';
          Game.haptic('tap');
          timer = setTimeout(function(){
            armed = false;
            b.className = 'btn secondary small';
            b.innerHTML = Game.ico('tag') + ' ' + Game.fmt.money(price);
          }, 4000);
        } else {
          clearTimeout(timer);
          var r = E.sellTrailer(uid);
          if (r.ok) { Game.haptic('ok'); Game.toast(r.msg, 'ok'); Game.updateHUD(); }
          else { Game.haptic('err'); Game.toast(r.msg, 'err'); }
          Game.navigate('garage', true);
        }
      };
    });
  }
};
