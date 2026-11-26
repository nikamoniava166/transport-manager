'use strict';

// Экран «Салон» — все покупки в одном окне: грузовики б/у (как раньше) +
// новые грузовики у дилера и прицепы (переехали из «Автопарка»).
// Переключатель «🏷 Б/у / 🚛 Новые / 🛻 Прицепы», под-вкладка — Game.ui.salonTab
// (свежий заход открывает «Б/у», перерисовки вкладку не сбрасывают — js/app.js).
// Б/у предложения генерирует и продаёт Game.economy (generateSalonOffer / salonBuy),
// картинки машин — поле img у модели в js/data.js (пусто → заглушка 🚛).
(function(){
  function wearColor(w){ return w < 40 ? 'var(--ok)' : w < 70 ? 'var(--warn)' : 'var(--danger)'; }
  function flagLabel(f){ return Game.flagLabel(f, true); }

  // ---------- б/у грузовики ----------

  function renderUsed(body){
    var s = Game.state;
    var E = Game.economy;
    var D = Game.data;
    var sl = s.salon;
    var list = (sl && sl.list) || [];
    var cap = E.garageCap();
    var full = s.trucks.length >= cap;
    var left = Game.fmt.dur(Math.max(0, (sl && sl.refreshAt) || 0) - Date.now());

    function offerCard(o){
      var T = Game.truck(o.tid);
      var eff = E.effTruck({ tid: o.tid, up: o.up, uid: 0 }); // uid 0 — прицеп не подхватится
      var tier = D.trucks.findIndex(function(x){ return x.id === o.tid; }) + 1;
      var ups = [];
      D.upgrades.forEach(function(U){
        var lvl = (o.up && o.up[U.id]) || 0;
        if (lvl > 0) ups.push(U.name + ' ' + ['I','II','III'][lvl - 1]);
      });
      var afford = s.money >= o.price;
      var canBuy = !full && afford;
      var cheaper = o.price < T.price;
      var save = cheaper ? Math.round((1 - o.price / T.price) * 100) : 0;
      return `
        <div class="card salon-card">
          <div class="salon-media">
            ${Game.truckImgHtml(T)}
            ${o.deal ? '<span class="salon-deal">🔥 выгодно</span>' : ''}
            <span class="salon-wear" style="color:${wearColor(o.wear)}">износ ${o.wear}%</span>
          </div>
          <div class="salon-body">
            <div class="li-title">${T.name} <span class="tag">Т${tier}</span></div>
            <div class="li-sub">${Game.fmt.ton(eff.cap)} груз · ${eff.speed} км/ч · ${eff.cons} ${eff.elec ? 'кВт·ч/100 км ⚡' : 'л/100 км'} · надёжность ${eff.rel}%</div>
            <div class="li-sub">🛣️ пробег ${Game.fmt.km(o.km)}${ups.length ? ' · ⬆️ ' + ups.join(', ') : ''}</div>
            <div class="wear">
              <div class="progress"><i style="width:${Math.min(100, o.wear)}%;background:${wearColor(o.wear)}"></i></div>
              <div class="val">состояние</div>
            </div>
            <div class="salon-buyrow">
              <div>
                <div class="salon-price">${Game.fmt.money(o.price)}</div>
                <div class="salon-old">новый — ${Game.fmt.money(T.price)}${cheaper ? (save > 0 ? ' · −' + save + '%' : '') : ' · апгрейды включены'}</div>
              </div>
              <button class="btn small" data-buyused="${o.uid}" ${canBuy ? '' : 'disabled'}>${full ? 'Гараж полон' : afford ? 'Купить' : 'Не хватает'}</button>
            </div>
          </div>
        </div>`;
    }

    var offersHtml = list.length
      ? list.map(offerCard).join('')
      : `<div class="card"><div class="empty">
           <div class="big">🏷️</div>
           Машины разобрали — ждём новый завоз
           <div class="small muted" style="margin-top:4px">через <span id="salon-refresh">${left}</span></div>
         </div></div>`;

    body.innerHTML = `
      <div class="card">
        <div class="card-title">🏷️ Салон с пробегом</div>
        <div class="li-title">Грузовики б/у — заметно дешевле новых</div>
        <div class="li-sub" style="margin-top:2px">Износ и пробег уже есть, изредка — установленные апгрейды.${list.length ? ' Новый завоз через <span id="salon-refresh">' + left + '</span>.' : ''}</div>
        <div class="small muted" style="margin-top:6px">Гараж: ${s.trucks.length} / ${cap} ${Game.plural(cap, 'место', 'места', 'мест')}${full ? ' — покупка заблокирована, нужно расширение' : ''}</div>
      </div>
      ${offersHtml}`;

    body.querySelectorAll('[data-buyused]').forEach(function(b){
      b.onclick = function(){
        var r = E.salonBuy(+b.getAttribute('data-buyused'));
        if (r.ok) { Game.haptic('ok'); Game.toast(r.msg, 'ok'); }
        else { Game.haptic('err'); Game.toast(r.msg, 'err'); }
        Game.navigate('salon', true);
      };
    });
  }

  // ---------- новые грузовики у дилера (переехали из «Автопарка») ----------

  function renderNew(body){
    var s = Game.state;
    var E = Game.economy;
    var D = Game.data;
    var lvl = Game.levelInfo(s.xp).level;
    var cap = E.garageCap();
    var fullGarage = s.trucks.length >= cap;

    body.innerHTML = `
      <div class="card">
        <div class="card-title">🚛 Новые грузовики — у дилера</div>
        <div class="small muted" style="margin-bottom:4px">Гараж: ${s.trucks.length} / ${cap} ${Game.plural(cap, 'место', 'места', 'мест')}${fullGarage ? ' — покупка заблокирована, нужно расширение' : ''}</div>
        ${D.trucks.map(function(T){
          var locked = T.lvl > lvl;
          var afford = s.money >= T.price;
          var ico = T.img
            ? '<img class="li-thumb" src="' + Game.esc(T.img) + '" alt="' + Game.esc(T.name) + '">'
            : '<div class="li-ico">' + (T.elec ? '⚡' : '🚛') + '</div>';
          return `
            <div class="list-item">
              ${ico}
              <div class="li-main">
                <div class="li-title">${T.name}${locked ? ' 🔒' : ''}</div>
                <div class="li-sub">${Game.fmt.ton(T.cap)} · ${T.speed} км/ч · ${T.cons} ${T.elec ? 'кВт·ч/100 км · заправка дешевле' : 'л/100 км'}${locked ? ' · нужен ур. ' + T.lvl : ''}</div>
              </div>
              <button class="btn small" data-buy="${T.id}" ${(!locked && afford && !fullGarage) ? '' : 'disabled'}>${fullGarage && !locked ? 'Гараж полон' : locked ? '🔒 ур. ' + T.lvl : Game.fmt.money(T.price)}</button>
            </div>`;
        }).join('')}
      </div>`;

    body.querySelectorAll('[data-buy]').forEach(function(b){
      b.onclick = function(){
        var r = E.buyTruck(b.getAttribute('data-buy'));
        if (r.ok) { Game.haptic('ok'); Game.toast(r.msg, 'ok'); }
        else { Game.haptic('err'); Game.toast(r.msg, 'err'); }
        Game.navigate('salon', true);
      };
    });
  }

  // ---------- прицепы у дилера (переехали из «Автопарка») ----------

  function renderTrailers(body){
    var s = Game.state;
    var E = Game.economy;
    var D = Game.data;

    body.innerHTML = `
      <div class="card">
        <div class="card-title">🛻 Прицепы у дилера</div>
        <div class="small muted" style="margin-bottom:4px">Один прицеп на грузовик · не занимают места в гараже · свои прицепы видно в «Автопарке», там же крепятся и продаются</div>
        ${D.trailers.map(function(TT){
          var afford = s.money >= TT.price;
          var compatible = s.trucks.some(function(tr){ return Game.truck(tr.tid).cap >= TT.minCap; });
          return `
            <div class="list-item">
              <div class="li-ico">🛻</div>
              <div class="li-main">
                <div class="li-title">${TT.name}${TT.flags.length ? ' ' + TT.flags.map(flagLabel).join(' ') : ''}</div>
                <div class="li-sub">+${Game.fmt.ton(TT.capAdd)} к грузоподъёмности · расход +${Math.round(TT.consAdd * 100)}%${TT.wearK > 1 ? ' · износ +' + Math.round((TT.wearK - 1) * 100) + '%' : ''} · тягач от ${Game.fmt.ton(TT.minCap)}${compatible ? '' : ' · 🔒 нет подходящего грузовика'}</div>
              </div>
              <button class="btn small" data-buytrailer="${TT.id}" ${afford ? '' : 'disabled'}>${Game.fmt.money(TT.price)}</button>
            </div>`;
        }).join('')}
      </div>`;

    body.querySelectorAll('[data-buytrailer]').forEach(function(b){
      b.onclick = function(){
        var r = E.buyTrailer(b.getAttribute('data-buytrailer'));
        if (r.ok) { Game.haptic('ok'); Game.toast(r.msg, 'ok'); }
        else { Game.haptic('err'); Game.toast(r.msg, 'err'); }
        Game.navigate('salon', true);
      };
    });
  }

  Game.screens.salon = {
    moneySensitive: true,

    render: function(root){
      var sl = Game.state.salon;
      var list = (sl && sl.list) || [];
      // сигнатура списка б/у — обновляется при любой перерисовке (не только на «Б/у»),
      // иначе onTick после завоза перерисовывал бы экран каждый тик
      Game.ui.salonSig = list.map(function(o){ return o.uid; }).join(',') + '|' + (sl ? sl.refreshAt : 0);

      var tab = Game.ui.salonTab === 'new' ? 'new' : Game.ui.salonTab === 'trailers' ? 'trailers' : 'used';
      root.innerHTML = `
        <div class="seg">
          <button class="${tab === 'used' ? 'sel' : ''}" data-stab="used">🏷 Б/у</button>
          <button class="${tab === 'new' ? 'sel' : ''}" data-stab="new">🚛 Новые</button>
          <button class="${tab === 'trailers' ? 'sel' : ''}" data-stab="trailers">🛻 Прицепы</button>
        </div>
        <div id="salon-body"></div>`;
      root.querySelectorAll('[data-stab]').forEach(function(b){
        b.onclick = function(){
          Game.haptic('tap');
          Game.ui.salonTab = b.getAttribute('data-stab');
          Game.navigate('salon', true);
        };
      });
      var body = root.querySelector('#salon-body');
      if (tab === 'new') renderNew(body);
      else if (tab === 'trailers') renderTrailers(body);
      else renderUsed(body);
    },

    onTick: function(){
      var sl = Game.state.salon;
      var list = (sl && sl.list) || [];
      var el = document.getElementById('salon-refresh');
      if (el) el.textContent = Game.fmt.dur(Math.max(0, (sl.refreshAt || 0) - Date.now()));
      // список изменился (завоз по таймеру из settle) — перерисовать; под-вкладка сохранится
      var sig = list.map(function(o){ return o.uid; }).join(',') + '|' + (sl ? sl.refreshAt : 0);
      if (sig !== Game.ui.salonSig) Game.navigate('salon', true);
    }
  };
})();
