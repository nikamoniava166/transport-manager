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
    var chartDays = [];
    var maxV = 1;
    for (var ci = 6; ci >= 0; ci--) {
      var cd = new Date(now - ci * 86400000);
      var ck = Game.dayKey(cd);
      var cf = (s.finance || {})[ck] || { in: 0, out: 0 };
      chartDays.push({ day: cd.getDate(), in: cf.in || 0, out: cf.out || 0 });
      maxV = Math.max(maxV, cf.in || 0, cf.out || 0);
    }
    var places = '';
    s.drivers.forEach(function(){ places += '👨‍✈️'; });
    s.staff.forEach(function(p){ places += p.role === 'accountant' ? '🧾' : '🔧'; });
    for (var pi = total; pi < slots; pi++) places += '⬜';

    function driverStatus(d){
      if (E.driverBusy(d.uid)) return '<span class="tag accent">🛣️ в рейсе</span>';
      if (d.restUntil > now) return '<span class="tag warn" data-driver-rest="' + d.uid + '">😴 отдых ' + Game.fmt.dur(d.restUntil - now) + '</span>';
      return '<span class="tag ok">готов</span>';
    }

    function driverRow(d){
      return `
        <div class="list-item">
          <div class="li-ico">👨‍✈️</div>
          <div class="li-main">
            <div class="li-title">${Game.esc(d.name)}</div>
            <div class="li-sub">водитель · скорость ${d.skills.speed} · аккуратность ${d.skills.care} · удача ${d.skills.luck} · ${d.share}% с рейса</div>
            <div style="margin-top:4px">${driverStatus(d)}</div>
          </div>
          <button class="btn small danger" data-firedrv="${d.uid}" ${E.driverBusy(d.uid) ? 'disabled' : ''}>✕</button>
        </div>`;
    }

    function staffRow(p){
      var isAcc = p.role === 'accountant';
      var effect = isAcc
        ? '+' + (p.skill * 0.5).toLocaleString('ru-RU') + '% к оплате рейсов'
        : '−' + (p.skill * 1.5).toLocaleString('ru-RU') + '% износа за рейс';
      return `
        <div class="list-item">
          <div class="li-ico">${isAcc ? '🧾' : '🔧'}</div>
          <div class="li-main">
            <div class="li-title">${Game.esc(p.name)}</div>
            <div class="li-sub">${isAcc ? 'бухгалтер' : 'механик'} · мастерство ${p.skill}/10 · ${effect}</div>
          </div>
          <div style="text-align:right;min-width:74px">
            <div class="small"><b>${Game.fmt.money(p.salary)}</b></div>
            <div class="small muted">с рейса</div>
          </div>
          <button class="btn small danger" data-fire="${p.uid}">✕</button>
        </div>`;
    }

    function driverCandRow(c){
      return `
        <div class="list-item">
          <div class="li-ico">👨‍✈️</div>
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
          <div class="li-ico">${isAcc ? '🧾' : '🔧'}</div>
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

    root.innerHTML = `
      <div class="card">
        <div class="card-title">🏢 Офис — уровень ${oLvl}</div>
        <div class="li-title">${total} / ${slots} ${Game.plural(slots, 'рабочее место', 'рабочих места', 'рабочих мест')}</div>
        <div class="li-sub" style="font-size:15px;letter-spacing:2px;margin:4px 0 8px">${places}</div>
        ${oCost != null
          ? `<button class="btn" data-upgoffice="1" ${s.money >= oCost ? '' : 'disabled'}>🏗️ Расширить (+1 место) · ${Game.fmt.money(oCost)}</button>`
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
        <div class="card-title">Динамика за 7 дней</div>
        <div class="chart">
          ${chartDays.map(function(d){
            var hi = Math.max(Math.round(d.in / maxV * 100), d.in ? 6 : 2);
            var ho = Math.max(Math.round(d.out / maxV * 100), d.out ? 6 : 2);
            return `<div class="chart-col">
              <div class="chart-bars">
                <i class="b-in" style="height:${hi}%"></i>
                <i class="b-out" style="height:${ho}%"></i>
              </div>
              <div class="chart-day">${d.day}</div>
            </div>`;
          }).join('')}
        </div>
        <div class="small muted" style="margin-top:8px"><span class="tag ok">доход</span> <span class="tag danger">расход</span> · максимум за день: ${Game.fmt.money(maxV)}</div>
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
          : '<div class="empty"><div class="big">🧾</div>Наймите бухгалтера —<br>он будет вести расчёт доходов и расходов</div>'}
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
      el.textContent = '😴 отдых ' + Game.fmt.dur(d.restUntil - Date.now());
    });
  }
};
