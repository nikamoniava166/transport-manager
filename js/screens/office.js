'use strict';
Game.screens.office = {
  moneySensitive: true,

  render: function(root){
    var s = Game.state;
    var E = Game.economy;
    E.refreshStaffMarket();
    var now = Date.now();
    var slots = E.staffSlots();
    var total = E.staffTotal();
    var oLvl = s.officeLvl || 0;
    var oCost = E.officeUpCost();
    var acc = E.staffOf('accountant');
    var mechs = E.staffOf('mechanic');
    var tab = Game.ui.staffTab || 'driver';
    var net = s.stats.earned - s.stats.spent;
    var dayIn = 0, dayOut = 0;
    (s.oplog || []).forEach(function(op){
      if (op.t > now - 86400000) {
        if (op.cat === 'in') dayIn += op.amount; else dayOut += op.amount;
      }
    });
    var refreshMin = Math.max(1, Math.ceil((s.staffMarket.refreshAt - now) / 60000));
    var cands = s.staffMarket.list.filter(function(c){ return c.role === tab; });
    var full = total >= slots;
    var healRate = 0;
    mechs.forEach(function(m){ healRate += m.skill * 0.4; });
    var places = '';
    s.drivers.forEach(function(){ places += Game.ico('user-round'); });
    s.staff.forEach(function(p){ places += p.role === 'accountant' ? Game.ico('calculator') : Game.ico('wrench'); });
    for (var pi = total; pi < slots; pi++) places += '⬜';

    function driverStatus(d){
      if (E.driverBusy(d.uid)) return '<span class="tag accent">' + Game.ico('route') + ' в рейсе</span>';
      if (d.restUntil > now) return '<span class="tag warn" data-driver-rest="' + d.uid + '">' + Game.ico('bed') + ' отдых ' + Game.fmt.dur(d.restUntil - now) + '</span>';
      if ((d.fatigue || 0) >= 100) return '<span class="tag danger">😵 устал — нужен отдых</span>';
      return '<span class="tag ok">готов · усталость ' + Math.round(d.fatigue || 0) + '%</span>';
    }

    function driverRow(d){
      var dTruck = null;
      if (d.truckUid) s.trucks.forEach(function(x){ if (x.uid === d.truckUid) dTruck = x; });
      var canRest = !E.driverBusy(d.uid) && d.restUntil <= now && (d.fatigue || 0) >= 10;
      var attachHtml;
      if (Game.ui.attachDrvFor === d.uid) {
        var freeTr = s.trucks.filter(function(x){ return !E.isBusy(x.uid) && !s.drivers.some(function(dd){ return dd.uid !== d.uid && dd.truckUid === x.uid; }); });
        attachHtml = `<div class="chips" style="margin-top:6px">${
          freeTr.map(function(x){ return `<button class="chip" data-att="${d.uid}|${x.uid}">${Game.truck(x.tid).name} №${x.uid}</button>`; }).join('') || '<span class="small muted">Свободных машин нет</span>'
        } <button class="chip" data-attoff="1">Отмена</button></div>`;
      } else {
        attachHtml = `<button class="btn small secondary" data-attsel="${d.uid}" ${E.driverBusy(d.uid) ? 'disabled' : ''}>${dTruck ? Game.ico('arrow-left-right') + ' Сменить машину' : Game.ico('truck') + ' Закрепить'}</button>${dTruck ? `<button class="btn small secondary" data-detdrv="${d.uid}" ${E.driverBusy(d.uid) ? 'disabled' : ''}>${Game.ico('lock-open')}</button>` : ''}`;
      }
      return `
        <div class="list-item">
          <div class="li-ico">${Game.ico('user-round')}</div>
          <div class="li-main">
            <div class="li-title">${Game.esc(d.name)}</div>
            <div class="li-sub">водитель · скорость ${d.skills.speed} · аккуратность ${d.skills.care} · удача ${d.skills.luck} · ${d.share}% с рейса</div>
            <div class="li-sub">${Game.ico('truck')} ${dTruck ? Game.truck(dTruck.tid).name + ' №' + dTruck.uid : 'без машины — рейсов не берёт'} · усталость ${Math.round(d.fatigue || 0)}%</div>
            <div style="margin-top:4px">${driverStatus(d)} <button class="btn small secondary" data-restdrv="${d.uid}" ${canRest ? '' : 'disabled'}>${Game.ico('bed')} Отдых</button></div>
            <div style="margin-top:6px">${attachHtml}</div>
          </div>
          <button class="btn small danger" data-firedrv="${d.uid}" ${E.driverBusy(d.uid) ? 'disabled' : ''}>${Game.ico('x')}</button>
        </div>`;
    }

    function staffRow(p){
      var isAcc = p.role === 'accountant';
      var effect = isAcc
        ? '+' + (p.skill * 0.5).toLocaleString('ru-RU') + '% к оплате рейсов'
        : '−' + (p.skill * 1.5).toLocaleString('ru-RU') + '% износа за рейс';
      return `
        <div class="list-item">
          <div class="li-ico">${isAcc ? Game.ico('calculator') : Game.ico('wrench')}</div>
          <div class="li-main">
            <div class="li-title">${Game.esc(p.name)}</div>
            <div class="li-sub">${isAcc ? 'бухгалтер' : 'механик'} · мастерство ${p.skill}/10 · ${effect}</div>
          </div>
          <div style="text-align:right;min-width:74px">
            <div class="small"><b>${Game.fmt.money(p.salary)}</b></div>
            <div class="small muted">с рейса</div>
          </div>
          <button class="btn small danger" data-fire="${p.uid}">${Game.ico('x')}</button>
        </div>`;
    }

    function driverCandRow(c){
      return `
        <div class="list-item">
          <div class="li-ico">${Game.ico('user-round')}</div>
          <div class="li-main">
            <div class="li-title">${Game.esc(c.name)}</div>
            <div class="li-sub">водитель · скорость ${c.skills.speed} · аккуратность ${c.skills.care} · удача ${c.skills.luck}</div>
          </div>
          <div style="text-align:right;min-width:84px">
            <div class="small"><b>${c.share}%<span class="small muted"> с рейса</span></b></div>
            <button class="btn small" data-hire="${c.uid}" ${full ? 'disabled' : ''} style="margin-top:4px">${full ? 'мест нет' : 'Нанять'}</button>
          </div>
        </div>`;
    }

    function staffCandRow(c){
      var isAcc = c.role === 'accountant';
      var effect = isAcc
        ? '+' + (c.skill * 0.5).toLocaleString('ru-RU') + '% к оплате'
        : '−' + (c.skill * 1.5).toLocaleString('ru-RU') + '% износа';
      return `
        <div class="list-item">
          <div class="li-ico">${isAcc ? Game.ico('calculator') : Game.ico('wrench')}</div>
          <div class="li-main">
            <div class="li-title">${Game.esc(c.name)}</div>
            <div class="li-sub">${isAcc ? 'бухгалтер' : 'механик'} · мастерство ${c.skill}/10 · ${effect}</div>
          </div>
          <div style="text-align:right;min-width:84px">
            <div class="small"><b>${Game.fmt.money(c.salary)}</b><span class="small muted"> с рейса</span></div>
            <button class="btn small" data-hire="${c.uid}" ${full ? 'disabled' : ''} style="margin-top:4px">${full ? 'мест нет' : 'Нанять'}</button>
          </div>
        </div>`;
    }

    function opRow(op){
      var isIn = op.cat === 'in';
      var time = new Date(op.t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="list-item">
          <div class="li-main">
            <div class="li-title" style="font-size:13px">${Game.esc(op.note)}</div>
            <div class="li-sub">${time}</div>
          </div>
          <span class="tag ${isIn ? 'ok' : 'danger'}">${isIn ? '+' : '−'}${Game.fmt.money(op.amount)}</span>
        </div>`;
    }

    // Полный отчёт по последним заказам (до 5) — модалка поверх экрана
    function orderReportRow(t){
      var o = t.order;
      var cargo = Game.data.cargo.find(function(c){ return c.id === o.cargoId; });
      var time = new Date(t.finishedAt || t.endAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      var net = t.net || 0;
      return `
        <div class="list-item" style="align-items:flex-start">
          <div class="li-main">
            <div class="li-title" style="font-size:13px">${cargo ? cargo.name : 'Груз'} · ${Game.city(o.from).name} → ${Game.city(o.to).name}</div>
            <div class="li-sub">${time} · ${Game.fmt.km(o.km)} · ${Game.fmt.ton(o.weight)}</div>
            <div class="li-sub">оплата +${Game.fmt.money(t.payFinal)} · топливо −${Game.fmt.money(t.fuel || 0)} · аванс −${Game.fmt.money(t.advance || 0)}</div>
          </div>
          <span class="tag ${net >= 0 ? 'ok' : 'danger'}">${net >= 0 ? '+' : ''}${Game.fmt.money(net)}</span>
        </div>`;
    }

    function showOrdersReport(){
      var old = document.getElementById('orders-report');
      if (old) old.remove();
      var done = s.trips.filter(function(t){ return t.status === 'done'; }).slice(-5).reverse();
      var el = document.createElement('div');
      el.className = 'overlay';
      el.id = 'orders-report';
      el.innerHTML = `
        <div class="modal">
          <div class="modal-x" data-x="1">${Game.ico('x')}</div>
          <div class="modal-title">${Game.ico('file-text')} Полный отчёт — ${done.length} ${Game.plural(done.length, 'заказ', 'заказа', 'заказов')}</div>
          ${done.length ? done.map(orderReportRow).join('') : '<div class="empty" style="padding:12px">Завершённых рейсов пока нет</div>'}
          <div class="small muted" style="margin-top:8px">Итог = оплата минус топливо, аванс водителю и оклады персонала</div>
        </div>`;
      document.body.appendChild(el);
      el.addEventListener('click', function(ev){
        if (ev.target === el || (ev.target && ev.target.hasAttribute && ev.target.hasAttribute('data-x'))) el.remove();
      });
    }

    root.innerHTML = `
      <div class="card">
        <div class="card-title">${Game.ico('building-2')} Офис — уровень ${oLvl}</div>
        <div class="li-title">${total} / ${slots} ${Game.plural(slots, 'рабочее место', 'рабочих места', 'рабочих мест')}</div>
        <div class="li-sub" style="font-size:15px;letter-spacing:2px;margin:4px 0 8px">${places}</div>
        ${oCost != null
          ? `<button class="btn" data-upgoffice="1" ${s.money >= oCost ? '' : 'disabled'}>${Game.ico('building-2')} Расширить (+1 место) · ${Game.fmt.money(oCost)}</button>`
          : '<div class="small muted center">Достигнут максимальный размер</div>'}
      </div>

      <div class="card">
        <div class="card-title">Финансы</div>
        <div class="grid2" style="margin:0">
          <div><div class="stat-num" style="color:var(--ok)">${Game.fmt.money(s.money)}</div><div class="stat-lbl">баланс</div></div>
          <div><div class="stat-num" style="color:${net >= 0 ? 'var(--ok)' : 'var(--danger)'}">${net >= 0 ? '+' : ''}${Game.fmt.money(net)}</div><div class="stat-lbl">прибыль</div></div>
          <div><div class="stat-num">+${Game.fmt.money(s.stats.earned)}</div><div class="stat-lbl">доходы</div></div>
          <div><div class="stat-num" style="color:var(--danger)">−${Game.fmt.money(s.stats.spent)}</div><div class="stat-lbl">расходы</div></div>
        </div>
        ${acc.length ? `
          <div class="divider" style="margin:10px 0 6px"></div>
          <div class="small muted">
            Сегодня: <b style="color:var(--ok)">+${Game.fmt.money(dayIn)}</b> · <b style="color:var(--danger)">−${Game.fmt.money(dayOut)}</b>
            · бонус бухгалтерии +${E.accountantBonus().toLocaleString('ru-RU')}%
          </div>
        ` : ''}
      </div>

      <div class="card">
        <div class="card-title">Персонал</div>
        ${total
          ? s.drivers.map(driverRow).join('') + s.staff.map(staffRow).join('')
          : '<div class="empty" style="padding:12px">Нанмите сотрудников ниже</div>'}
        <div class="small muted" style="margin-top:6px">
          Все сотрудники делят рабочие места офиса · оклады бухгалтеров и механиков списываются с каждого доставленного рейса${healRate > 0 ? ' · механики восстанавливают ' + healRate.toLocaleString('ru-RU') + '% износа в час' : ''}
        </div>
      </div>

      <div class="card">
        <div class="card-title">Найм — обновление через ${refreshMin} мин</div>
        <div class="seg">
          <button class="${tab === 'driver' ? 'sel' : ''}" data-stab="driver">Водители</button>
          <button class="${tab === 'accountant' ? 'sel' : ''}" data-stab="accountant">Бухгалтеры</button>
          <button class="${tab === 'mechanic' ? 'sel' : ''}" data-stab="mechanic">Механики</button>
        </div>
        ${cands.map(function(c){ return c.role === 'driver' ? driverCandRow(c) : staffCandRow(c); }).join('') || '<div class="empty" style="padding:12px">Кандидатов нет — ждите обновления</div>'}
      </div>

      <div class="card">
        <div class="card-title">Отчёт по операциям</div>
        ${acc.length
          ? ((s.oplog || []).slice(0, 15).map(opRow).join('') || '<div class="empty" style="padding:12px">Операций пока нет</div>')
            + '<button class="btn secondary small" id="orders-report-btn" style="margin-top:8px">' + Game.ico('file-text') + ' Полный отчёт — последние 5 заказов</button>'
          : '<div class="empty"><div class="big">' + Game.ico('file-text') + '</div>Наймите бухгалтера —<br>он будет вести расчёт доходов и расходов</div>'}
      </div>
    `;

    root.querySelectorAll('[data-upgoffice]').forEach(function(b){
      b.onclick = function(){
        var r = E.upgradeOffice();
        if (r.ok) { Game.haptic('ok'); Game.toast(r.msg, 'ok'); }
        else { Game.haptic('err'); Game.toast(r.msg, 'err'); }
        Game.navigate('office', true);
      };
    });
    var orb = document.getElementById('orders-report-btn');
    if (orb) orb.onclick = function(){ Game.haptic('tap'); showOrdersReport(); };
    root.querySelectorAll('[data-stab]').forEach(function(b){
      b.onclick = function(){
        Game.haptic('tap');
        Game.ui.staffTab = b.getAttribute('data-stab');
        Game.navigate('office', true);
      };
    });
    root.querySelectorAll('[data-hire]').forEach(function(b){
      b.onclick = function(){
        var uid = +b.getAttribute('data-hire');
        var cand = null;
        s.staffMarket.list.forEach(function(c){ if (c.uid === uid) cand = c; });
        var r = (cand && cand.role === 'driver') ? E.hire(uid) : E.hireStaff(uid);
        if (r.ok) { Game.haptic('ok'); Game.toast(r.msg, 'ok'); }
        else { Game.haptic('err'); Game.toast(r.msg, 'err'); }
        Game.navigate('office', true);
      };
    });
    root.querySelectorAll('[data-firedrv]').forEach(function(b){
      b.onclick = function(){
        var r = E.fire(+b.getAttribute('data-firedrv'));
        if (r.ok) { Game.haptic('tap'); Game.toast(r.msg); }
        else { Game.haptic('err'); Game.toast(r.msg, 'err'); }
        Game.navigate('office', true);
      };
    });
    root.querySelectorAll('[data-restdrv]').forEach(function(b){
      b.onclick = function(){
        var r = E.restDriver(+b.getAttribute('data-restdrv'));
        if (r.ok) { Game.haptic('ok'); Game.toast(r.msg, 'ok'); }
        else { Game.haptic('err'); Game.toast(r.msg, 'err'); }
        Game.navigate('office', true);
      };
    });
    root.querySelectorAll('[data-attsel]').forEach(function(b){
      b.onclick = function(){
        Game.haptic('tap');
        var uid = +b.getAttribute('data-attsel');
        Game.ui.attachDrvFor = Game.ui.attachDrvFor === uid ? null : uid;
        Game.navigate('office', true);
      };
    });
    root.querySelectorAll('[data-attoff]').forEach(function(b){
      b.onclick = function(){
        Game.ui.attachDrvFor = null;
        Game.navigate('office', true);
      };
    });
    root.querySelectorAll('[data-att]').forEach(function(b){
      b.onclick = function(){
        var p = b.getAttribute('data-att').split('|');
        var r = E.attachDriver(+p[0], +p[1]);
        Game.ui.attachDrvFor = null;
        if (r.ok) { Game.haptic('ok'); Game.toast(r.msg, 'ok'); }
        else { Game.haptic('err'); Game.toast(r.msg, 'err'); }
        Game.navigate('office', true);
      };
    });
    root.querySelectorAll('[data-detdrv]').forEach(function(b){
      b.onclick = function(){
        var r = E.detachDriver(+b.getAttribute('data-detdrv'));
        if (r.ok) { Game.haptic('tap'); Game.toast(r.msg); }
        else { Game.haptic('err'); Game.toast(r.msg, 'err'); }
        Game.navigate('office', true);
      };
    });
    root.querySelectorAll('[data-fire]').forEach(function(b){
      b.onclick = function(){
        var r = E.fireStaff(+b.getAttribute('data-fire'));
        if (r.ok) { Game.haptic('tap'); Game.toast(r.msg); }
        else { Game.haptic('err'); Game.toast(r.msg, 'err'); }
        Game.navigate('office', true);
      };
    });
  },

  onTick: function(){
    document.querySelectorAll('[data-driver-rest]').forEach(function(el){
      var uid = +el.getAttribute('data-driver-rest');
      var d = null;
      Game.state.drivers.forEach(function(x){ if (x.uid === uid) d = x; });
      if (!d) return;
      if (d.restUntil <= Date.now()) {
        if (el.className.indexOf('ok') < 0) { el.className = 'tag ok'; el.textContent = 'готов'; }
        return;
      }
      el.innerHTML = Game.ico('bed') + ' отдых ' + Game.fmt.dur(d.restUntil - Date.now());
    });
  }
};
