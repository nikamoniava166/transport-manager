'use strict';

// Экран «Салон» — грузовики с пробегом (б/у): дешевле новых, но с износом и пробегом.
// Предложения генерирует и продаёт Game.economy (generateSalonOffer / salonBuy),
// картинки машин — поле img у модели в js/data.js (пусто → заглушка 🚛).
Game.screens.salon = {
  moneySensitive: true,

  render: function(root){
    var s = Game.state;
    var E = Game.economy;
    var D = Game.data;
    var sl = s.salon;
    var list = (sl && sl.list) || [];
    var cap = E.garageCap();
    var full = s.trucks.length >= cap;
    var left = Game.fmt.dur(Math.max(0, (sl && sl.refreshAt) || 0) - Date.now());
    Game.ui.salonSig = list.map(function(o){ return o.uid; }).join(',') + '|' + (sl ? sl.refreshAt : 0);

    function wearColor(w){ return w < 40 ? 'var(--ok)' : w < 70 ? 'var(--warn)' : 'var(--danger)'; }

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

    root.innerHTML = `
      <div class="card">
        <div class="card-title">🏷️ Салон с пробегом</div>
        <div class="li-title">Грузовики б/у — заметно дешевле новых</div>
        <div class="li-sub" style="margin-top:2px">Износ и пробег уже есть, изредка — установленные апгрейды.${list.length ? ' Новый завоз через <span id="salon-refresh">' + left + '</span>.' : ''}</div>
        <div class="small muted" style="margin-top:6px">Гараж: ${s.trucks.length} / ${cap} ${Game.plural(cap, 'место', 'места', 'мест')}${full ? ' — покупка заблокирована, нужно расширение' : ''}</div>
      </div>
      ${offersHtml}
    `;

    root.querySelectorAll('[data-buyused]').forEach(function(b){
      b.onclick = function(){
        var r = E.salonBuy(+b.getAttribute('data-buyused'));
        if (r.ok) { Game.haptic('ok'); Game.toast(r.msg, 'ok'); }
        else { Game.haptic('err'); Game.toast(r.msg, 'err'); }
        Game.navigate('salon', true);
      };
    });
  },

  onTick: function(){
    var sl = Game.state.salon;
    var list = (sl && sl.list) || [];
    var el = document.getElementById('salon-refresh');
    if (el) el.textContent = Game.fmt.dur(Math.max(0, (sl.refreshAt || 0) - Date.now()));
    // список изменился (завоз по таймеру из settle) — перерисовать
    var sig = list.map(function(o){ return o.uid; }).join(',') + '|' + (sl ? sl.refreshAt : 0);
    if (sig !== Game.ui.salonSig) Game.navigate('salon', true);
  }
};
