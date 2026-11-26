'use strict';

// ---------- утилиты случайности ----------
Game.rnd = function(a, b){ return a + Math.random() * (b - a); };
Game.rndInt = function(a, b){ return Math.floor(Game.rnd(a, b + 0.999)); };
Game.pick = function(arr){ return arr[Math.floor(Math.random() * arr.length)]; };

(function(){
  var E = Game.economy = {};

  var EVDEF = {
    traffic:    { time: 0.15 },
    goodclient: { pay: 0.10 },
    police:     { fine: [500, 2000] },
    bonusload:  { pay: 0.30 },
    breakdown:  {}
  };

  // ---------- грузовики ----------

  // Эффективные параметры с учётом апгрейдов
  E.effTruck = function(tr){
    var T = Game.truck(tr.tid);
    var up = tr.up || {};
    var trailer = E.trailerOf(tr.uid);
    var TT = trailer ? Game.trailerType(trailer.tid) : null;
    return {
      uid: tr.uid, tid: tr.tid, name: T.name, price: T.price,
      baseCap: T.cap,
      cap: T.cap + (TT ? TT.capAdd : 0),
      flags: TT ? TT.flags.slice() : [],
      trailer: trailer,
      speed: T.speed + 5 * (up.engine || 0),
      cons: Math.round(Math.max(4, T.cons - 2 * (up.fuel || 0)) * (1 + (TT ? TT.consAdd : 0)) * 10) / 10,
      rel: Math.min(99, T.rel + 5 * (up.service || 0)),
      elec: !!T.elec
    };
  };

  E.trailerOf = function(truckUid){
    var found = null;
    (Game.state.trailers || []).forEach(function(t){ if (t.attachedTo === truckUid) found = t; });
    return found;
  };

  E.isBusy = function(truckUid){
    return Game.state.trips.some(function(t){ return t.status === 'active' && t.truckUid === truckUid; });
  };
  E.driverBusy = function(driverUid){
    return Game.state.trips.some(function(t){ return t.status === 'active' && t.driverUid === driverUid; });
  };

  E.repairCost = function(tr){
    var T = Game.truck(tr.tid);
    if (tr.wear <= 0) return 0;
    return Math.max(100, Math.round(T.price * Game.data.repairRate * tr.wear / 100) * 100);
  };

  E.repair = function(truckUid){
    var s = Game.state;
    var tr = null;
    s.trucks.forEach(function(x){ if (x.uid === truckUid) tr = x; });
    if (!tr || tr.wear <= 0) return { ok: false, msg: 'Ремонт не нужен' };
    if (E.isBusy(truckUid)) return { ok: false, msg: 'Машина в рейсе — дождитесь возвращения' };
    var needParts = Game.data.repairParts || 1;
    if (!s.warehouse) s.warehouse = { parts: 0, tires: 0 };
    if (s.warehouse.parts < needParts) return { ok: false, msg: 'Нужны запчасти: ' + needParts + ' шт — купите на «Автопарке» → «Склад»' };
    var cost = E.repairCost(tr);
    if (s.money < cost) return { ok: false, msg: 'Не хватает: нужно ' + Game.fmt.money(cost) };
    s.money -= cost; s.stats.spent += cost;
    s.warehouse.parts -= needParts;
    tr.wear = 0;
    E.logOp('out', cost, 'Ремонт: ' + Game.truck(tr.tid).name + ' · запчасти ×' + needParts);
    Game.save();
    return { ok: true, msg: '🔧 ' + Game.truck(tr.tid).name + ' как новая · −' + Game.fmt.money(cost) + ' · запчасти ×' + needParts };
  };

  // Замена комплекта шин: тратит шины со склада, сбрасывает износ шин машины
  E.replaceTires = function(truckUid){
    var s = Game.state;
    var tr = null;
    s.trucks.forEach(function(x){ if (x.uid === truckUid) tr = x; });
    if (!tr) return { ok: false, msg: 'Машина не найдена' };
    if (E.isBusy(truckUid)) return { ok: false, msg: 'Машина в рейсе — дождитесь возвращения' };
    if ((tr.tires || 0) < 5) return { ok: false, msg: 'Шины почти новые — замена не нужна' };
    var need = Game.data.tireSetSize || 4;
    if (!s.warehouse) s.warehouse = { parts: 0, tires: 0 };
    if (s.warehouse.tires < need) return { ok: false, msg: 'Нужно шин: ' + need + ' шт — купите на «Автопарке» → «Склад»' };
    s.warehouse.tires -= need;
    tr.tires = 0;
    E.logOp('out', 0, 'Замена шин: ' + Game.truck(tr.tid).name + ' · шины ×' + need);
    Game.save();
    return { ok: true, msg: '🛞 Комплект шин заменён · −' + need + ' со склада' };
  };

  // ---------- склад запчастей и шин ----------

  E.buyParts = function(n){
    var s = Game.state;
    if (!s.warehouse) s.warehouse = { parts: 0, tires: 0 };
    var cost = Game.data.partPrice * n;
    if (s.money < cost) return { ok: false, msg: 'Не хватает: нужно ' + Game.fmt.money(cost) };
    s.money -= cost; s.stats.spent += cost;
    s.warehouse.parts += n;
    E.logOp('out', cost, 'Склад: запчасти ×' + n);
    Game.save();
    return { ok: true, msg: '📦 Запчасти ×' + n + ' на складе · −' + Game.fmt.money(cost) };
  };

  E.buyTires = function(n){
    var s = Game.state;
    if (!s.warehouse) s.warehouse = { parts: 0, tires: 0 };
    var cost = Game.data.tirePrice * n;
    if (s.money < cost) return { ok: false, msg: 'Не хватает: нужно ' + Game.fmt.money(cost) };
    s.money -= cost; s.stats.spent += cost;
    s.warehouse.tires += n;
    E.logOp('out', cost, 'Склад: шины ×' + n);
    Game.save();
    return { ok: true, msg: '🛞 Шины ×' + n + ' на складе · −' + Game.fmt.money(cost) };
  };

  E.upgradeCost = function(tr, upId){
    var T = Game.truck(tr.tid);
    var U = Game.data.upgrades.find(function(u){ return u.id === upId; });
    var lvl = (tr.up[upId] || 0);
    return Math.max(500, Math.round(T.price * U.step * (lvl + 1) / 100) * 100);
  };

  E.upgrade = function(truckUid, upId){
    var s = Game.state;
    var tr = null;
    s.trucks.forEach(function(x){ if (x.uid === truckUid) tr = x; });
    if (!tr) return { ok: false, msg: 'Машина не найдена' };
    var U = Game.data.upgrades.find(function(u){ return u.id === upId; });
    var lvl = tr.up[upId] || 0;
    if (lvl >= U.levels) return { ok: false, msg: 'Уже максимум' };
    if (E.isBusy(truckUid)) return { ok: false, msg: 'Машина в рейсе' };
    var cost = E.upgradeCost(tr, upId);
    if (s.money < cost) return { ok: false, msg: 'Не хватает: нужно ' + Game.fmt.money(cost) };
    s.money -= cost; s.stats.spent += cost;
    tr.up[upId] = lvl + 1;
    E.logOp('out', cost, 'Апгрейд: ' + U.name + ' ур.' + (lvl + 1));
    Game.save();
    return { ok: true, msg: '⬆️ ' + U.name + ' ур.' + (lvl + 1) + ' · −' + Game.fmt.money(cost) };
  };

  E.buyTruck = function(tid){
    var s = Game.state;
    var T = Game.truck(tid);
    var lvl = Game.levelInfo(s.xp).level;
    if (T.lvl > lvl) return { ok: false, msg: 'Нужен уровень ' + T.lvl };
    if (s.trucks.length >= E.garageCap()) return { ok: false, msg: 'Гараж полон — нужно расширение' };
    if (s.money < T.price) return { ok: false, msg: 'Не хватает: нужно ' + Game.fmt.money(T.price) };
    s.money -= T.price; s.stats.spent += T.price;
    s.trucks.push({ uid: Game.uid(), tid: tid, wear: 0, up: {} });
    E.logOp('out', T.price, 'Покупка: ' + T.name);
    Game.save();
    return { ok: true, msg: '🎉 ' + T.name + ' присоединяется к автопарку!' };
  };

  // ---------- база: улучшение гаража и офиса ----------

  E.garageCap = function(){
    return 3 + (Game.state.garageLvl || 0) * 2;
  };

  E.garageUpCost = function(){
    var costs = Game.data.garageUpgrades;
    var lvl = Game.state.garageLvl || 0;
    return lvl < costs.length ? costs[lvl] : null;
  };

  E.upgradeGarage = function(){
    var s = Game.state;
    var cost = E.garageUpCost();
    if (cost == null) return { ok: false, msg: 'Гараж уже максимального размера' };
    if (s.money < cost) return { ok: false, msg: 'Не хватает: нужно ' + Game.fmt.money(cost) };
    s.money -= cost; s.stats.spent += cost;
    s.garageLvl = (s.garageLvl || 0) + 1;
    E.logOp('out', cost, 'Расширение гаража: ур.' + s.garageLvl);
    Game.save();
    return { ok: true, msg: '🏗️ Гараж расширен — теперь ' + E.garageCap() + ' мест' };
  };

  E.officeUpCost = function(){
    var costs = Game.data.officeUpgrades;
    var lvl = Game.state.officeLvl || 0;
    return lvl < costs.length ? costs[lvl] : null;
  };

  E.upgradeOffice = function(){
    var s = Game.state;
    var cost = E.officeUpCost();
    if (cost == null) return { ok: false, msg: 'Офис уже максимального размера' };
    if (s.money < cost) return { ok: false, msg: 'Не хватает: нужно ' + Game.fmt.money(cost) };
    s.money -= cost; s.stats.spent += cost;
    s.officeLvl = (s.officeLvl || 0) + 1;
    E.logOp('out', cost, 'Расширение офиса: ур.' + s.officeLvl);
    Game.save();
    return { ok: true, msg: '🏢 Офис расширен — теперь ' + E.staffSlots() + ' рабочих мест' };
  };

  // ---------- прицепы ----------

  E.trailerRepairCost = function(trailer){
    var TT = Game.trailerType(trailer.tid);
    if (trailer.wear <= 0) return 0;
    return Math.max(100, Math.round(TT.price * Game.data.repairRate * trailer.wear / 100) * 100);
  };

  E.buyTrailer = function(tid){
    var s = Game.state;
    var TT = Game.trailerType(tid);
    if (!TT) return { ok: false, msg: 'Прицеп не найден' };
    if (s.money < TT.price) return { ok: false, msg: 'Не хватает: нужно ' + Game.fmt.money(TT.price) };
    s.money -= TT.price; s.stats.spent += TT.price;
    var trailer = { uid: Game.uid(), tid: tid, wear: 0, attachedTo: null };
    s.trailers.push(trailer);
    E.logOp('out', TT.price, 'Покупка прицепа: ' + TT.name);
    Game.save();
    return { ok: true, msg: '🛻 ' + TT.name + ' на складе — прикрепите к грузовику', trailer: trailer };
  };

  // Тягач тянет прицеп, если его базовая грузоподъёмность не ниже minCap
  E.canTow = function(truckUid, tid){
    var tr = null;
    Game.state.trucks.forEach(function(x){ if (x.uid === truckUid) tr = x; });
    if (!tr) return false;
    var TT = Game.trailerType(tid);
    return !!TT && Game.truck(tr.tid).cap >= TT.minCap;
  };

  E.attachTrailer = function(trailerUid, truckUid){
    var s = Game.state;
    var trailer = null;
    s.trailers.forEach(function(t){ if (t.uid === trailerUid) trailer = t; });
    if (!trailer) return { ok: false, msg: 'Прицеп не найден' };
    if (E.isBusy(truckUid)) return { ok: false, msg: 'Машина в рейсе' };
    if (E.trailerOf(truckUid)) return { ok: false, msg: 'У машины уже есть прицеп' };
    if (!E.canTow(truckUid, trailer.tid)) return { ok: false, msg: 'Тягачу не хватает грузоподъёмности' };
    trailer.attachedTo = truckUid;
    Game.save();
    return { ok: true, msg: '🔗 ' + Game.trailerType(trailer.tid).name + ' прицеплен' };
  };

  E.detachTrailer = function(trailerUid){
    var s = Game.state;
    var trailer = null;
    s.trailers.forEach(function(t){ if (t.uid === trailerUid) trailer = t; });
    if (!trailer || !trailer.attachedTo) return { ok: false, msg: 'Прицеп не прикреплён' };
    if (E.isBusy(trailer.attachedTo)) return { ok: false, msg: 'Машина в рейсе — дождитесь возвращения' };
    trailer.attachedTo = null;
    Game.save();
    return { ok: true, msg: 'Прицеп отцеплен' };
  };

  E.repairTrailer = function(trailerUid){
    var s = Game.state;
    var trailer = null;
    s.trailers.forEach(function(t){ if (t.uid === trailerUid) trailer = t; });
    if (!trailer || trailer.wear <= 0) return { ok: false, msg: 'Ремонт не нужен' };
    if (trailer.attachedTo && E.isBusy(trailer.attachedTo)) return { ok: false, msg: 'Прицеп в рейсе' };
    var needParts = Game.data.repairParts || 1;
    if (!s.warehouse) s.warehouse = { parts: 0, tires: 0 };
    if (s.warehouse.parts < needParts) return { ok: false, msg: 'Нужны запчасти: ' + needParts + ' шт — купите на «Автопарке» → «Склад»' };
    var cost = E.trailerRepairCost(trailer);
    if (s.money < cost) return { ok: false, msg: 'Не хватает: нужно ' + Game.fmt.money(cost) };
    s.money -= cost; s.stats.spent += cost;
    s.warehouse.parts -= needParts;
    trailer.wear = 0;
    E.logOp('out', cost, 'Ремонт прицепа: ' + Game.trailerType(trailer.tid).name + ' · запчасти ×' + needParts);
    Game.save();
    return { ok: true, msg: '🔧 Прицеп отремонтирован · −' + Game.fmt.money(cost) };
  };

  // ---------- продажа с рук (машины и прицепы) ----------

  // Цена скупщика: цена нового × (0,5 − износ × 0,003), но не ниже 10 %; округление до сотен
  E.sellPrice = function(basePrice, wear){
    var k = 0.5 - (wear || 0) * 0.003;
    if (k < 0.1) k = 0.1;
    return Math.max(100, Math.round(basePrice * k / 100) * 100);
  };

  E.sellTruck = function(truckUid){
    var s = Game.state;
    var tr = null;
    s.trucks.forEach(function(x){ if (x.uid === truckUid) tr = x; });
    if (!tr) return { ok: false, msg: 'Машина не найдена' };
    if (E.isBusy(truckUid)) return { ok: false, msg: 'Машина в рейсе — дождитесь возвращения' };
    if (s.trucks.length <= 1) return { ok: false, msg: 'Нельзя продать последнюю машину' };
    var T = Game.truck(tr.tid);
    var price = E.sellPrice(T.price, tr.wear);
    var trailer = E.trailerOf(truckUid);
    if (trailer) trailer.attachedTo = null; // прицеп не продаётся вместе с машиной — остаётся на складе
    s.trucks = s.trucks.filter(function(x){ return x.uid !== truckUid; });
    s.money += price;
    E.logOp('in', price, 'Продажа: ' + T.name);
    Game.save();
    return { ok: true, msg: '💰 ' + T.name + ' продана за ' + Game.fmt.money(price) + (trailer ? ' — прицеп остался на складе' : '') };
  };

  E.sellTrailer = function(trailerUid){
    var s = Game.state;
    var t = null;
    s.trailers.forEach(function(x){ if (x.uid === trailerUid) t = x; });
    if (!t) return { ok: false, msg: 'Прицеп не найден' };
    if (t.attachedTo && E.isBusy(t.attachedTo)) return { ok: false, msg: 'Прицеп в рейсе — дождитесь возвращения' };
    var TT = Game.trailerType(t.tid);
    var price = E.sellPrice(TT.price, t.wear);
    s.trailers = s.trailers.filter(function(x){ return x.uid !== trailerUid; });
    s.money += price;
    E.logOp('in', price, 'Продажа: ' + TT.name);
    Game.save();
    return { ok: true, msg: '💰 ' + TT.name + ' продан за ' + Game.fmt.money(price) };
  };

  // ---------- салон б/у грузовиков ----------

  // Цена б/у машины: доля от цены нового зависит от износа,
  // уже установленные апгрейды добавляют остаточную стоимость
  E.usedPrice = function(T, wear, up){
    var D = Game.data.salon;
    var share = Math.max(D.priceMin, D.priceBase - (wear || 0) * D.wearK);
    var base = T.price * share;
    var residual = 0;
    Game.data.upgrades.forEach(function(U){
      var lvl = (up && up[U.id]) || 0;
      for (var i = 1; i <= lvl; i++) {
        residual += Math.max(500, Math.round(T.price * U.step * i / 100) * 100);
      }
    });
    return Math.max(1000, Math.round((base + residual * D.upResidual) / 100) * 100);
  };

  E.generateSalonOffer = function(){
    var s = Game.state;
    var D = Game.data.salon;
    var lvl = Game.levelInfo(s.xp).level;
    var pool = Game.data.trucks.filter(function(T){ return T.lvl <= lvl; });
    if (!pool.length) return null;
    var T = Game.pick(pool);
    var wear = Math.round(Game.rnd(D.wearMin, D.wearMax));
    var up = {};
    Game.data.upgrades.forEach(function(U){
      if (Math.random() < D.upChance) up[U.id] = Game.rndInt(1, U.levels);
    });
    var price = E.usedPrice(T, wear, up);
    var deal = Math.random() < D.dealChance;
    if (deal) price = Math.max(1000, Math.round(price * (1 - D.dealDisc) / 100) * 100);
    var km = Math.round(wear * Game.rnd(D.kmPerWear[0], D.kmPerWear[1]) / 500) * 500;
    return { uid: Game.uid(), tid: T.id, wear: wear, up: up, km: km, price: price, deal: deal };
  };

  // Завоз по таймеру (refreshAt — метка времени, офлайн тоже работает).
  // Пустой сток до срока завоза не пополняется: «всё разобрали, ждите новый завоз».
  E.refreshSalon = function(){
    var s = Game.state;
    var D = Game.data.salon;
    var sl = s.salon;
    var now = Date.now();
    if (sl.refreshAt > now) return;
    var list = [];
    var count = Game.rndInt(D.stockMin, D.stockMax);
    for (var i = 0; i < count; i++) {
      var o = E.generateSalonOffer();
      if (o) list.push(o);
    }
    sl.list = list;
    sl.refreshAt = now + D.refreshMin * 60000;
    Game.save();
  };

  E.salonBuy = function(offerUid){
    var s = Game.state;
    var offer = null;
    (s.salon.list || []).forEach(function(o){ if (o.uid === offerUid) offer = o; });
    if (!offer) return { ok: false, msg: 'Эту машину уже кто-то забрал' };
    var T = Game.truck(offer.tid);
    var lvl = Game.levelInfo(s.xp).level;
    if (T.lvl > lvl) return { ok: false, msg: 'Нужен уровень ' + T.lvl };
    if (s.trucks.length >= E.garageCap()) return { ok: false, msg: 'Гараж полон — нужно расширение' };
    if (s.money < offer.price) return { ok: false, msg: 'Не хватает: нужно ' + Game.fmt.money(offer.price) };
    var up = {};
    Game.data.upgrades.forEach(function(U){ up[U.id] = (offer.up && offer.up[U.id]) || 0; });
    s.money -= offer.price; s.stats.spent += offer.price;
    s.trucks.push({ uid: Game.uid(), tid: offer.tid, wear: offer.wear, up: up, km: offer.km });
    s.salon.list = s.salon.list.filter(function(o){ return o.uid !== offerUid; });
    E.logOp('out', offer.price, 'Покупка б/у: ' + T.name + ' (износ ' + offer.wear + '%, пробег ' + Game.fmt.km(offer.km) + ')');
    Game.save();
    return { ok: true, msg: '🎉 ' + T.name + ' с пробегом — ваш! Загляните в автопарк' };
  };

  // ---------- деньги ----------

  E.distancePayMult = function(km){
    var D = Game.data;
    var extra = Math.max(0, km - D.longRouteKm);
    return 1 + Math.min(D.longRoutePayMax, extra / D.longRouteScaleKm);
  };

  E.orderPay = function(km, weight, mult, urgent){
    // затухание по дистанции сохраняется, а дальний маршрут получает бонус за простой и риск
    var kmPart = Math.pow(Math.max(km, 10), 0.92) * 28;
    var wPart = 0.75 + (weight || 0) * 0.14;
    return Math.round((300 + kmPart) * wPart * (mult || 1) * E.distancePayMult(km) * (urgent ? 1.4 : 1));
  };

  E.fuelCost = function(km, cons, elec){
    // электрогрузовики заправляются электричеством; на дальних маршрутах расход немного ниже
    var D = Game.data;
    var extra = Math.max(0, km - D.longRouteKm);
    var discount = Math.min(D.longRouteFuelDisc, extra / D.longRouteScaleKm);
    return Math.round(km * cons / 100 * (elec ? D.fuelPriceElec : D.fuelPrice) * (1 - discount));
  };

  // ---------- время рейса ----------

  E.tripMinutes = function(km, urgent, effSpeed, skill){
    var m = km / Game.data.kmPerMin;
    var mult = 1;
    mult -= Math.max(0, effSpeed - 85) / 500; // скорость машины
    mult -= skill * 0.008;                    // навык водителя
    mult = Math.max(0.75, mult);
    m *= mult;
    if (urgent) m *= 0.75;
    return Math.max(Game.data.minTripMin, Math.min(Game.data.maxTripMin, m));
  };

  // ---------- события в пути ----------

  E.eventToastText = function(ev){
    switch (ev.type) {
      case 'traffic':    return '🚧 Пробка: рейс задержится';
      case 'goodclient': return '🤝 Хороший клиент: +10% к оплате';
      case 'police':     return '👮 ДПС: штраф ' + Game.fmt.money(ev.fine);
      case 'bonusload':  return '📦 Попутный груз: +30% к оплате';
      case 'breakdown':  return '⚡ Поломка! Рейс задержится';
    }
    return '';
  };

  E.rollEvents = function(tr, eff, driver){
    var events = [];
    var rel = eff.rel, wear = tr.wear, luck = driver ? driver.skills.luck : 0;
    // поломка: (износ − 60)/2 % × (1 − надёжность/100)
    var brkChance = Math.max(0, wear - 60) / 200 * (1 - rel / 100);
    // «лысые» шины добавляют риск поломки (до +6 % при 100 %)
    var tireWear = tr.tires || 0;
    if (tireWear > Game.data.tireRiskWear) brkChance += (tireWear - Game.data.tireRiskWear) / 100 * 0.3;
    if (Math.random() < brkChance) events.push({ type: 'breakdown', atFrac: Game.rnd(0.3, 0.8) });
    // остальные события, удача смещает веса
    var pool = [
      { type: 'traffic',    w: 30 * (1 - luck * 0.03) },
      { type: 'goodclient', w: 18 * (1 + luck * 0.05) },
      { type: 'police',     w: 12 * (1 - luck * 0.04) },
      { type: 'bonusload',  w: 6  * (1 + luck * 0.07) }
    ];
    var count = Game.rndInt(0, 2);
    for (var i = 0; i < count; i++) {
      var total = 0;
      pool.forEach(function(p){ total += p.w; });
      var r = Math.random() * total, def = null;
      for (var j = 0; j < pool.length; j++) { r -= pool[j].w; if (r <= 0) { def = pool[j]; break; } }
      if (!def) def = pool[0];
      if (events.some(function(e){ return e.type === def.type; })) continue;
      events.push({ type: def.type, atFrac: Game.rnd(0.15, 0.95) });
    }
    return events;
  };

  // ---------- биржа заказов ----------

  E.marketSlots = function(){
    var lvl = Game.levelInfo(Game.state.xp).level;
    return Math.min(9, 5 + Math.floor((lvl - 1) / 3));
  };

  E.generateOrder = function(){
    var s = Game.state;
    var lvl = Game.levelInfo(s.xp).level;
    var cities = Game.data.cities.filter(function(c){ return c.lvl <= lvl; });
    if (cities.length < 2) return null;
    // грузоподъёмность автопарка (с прицепами) — общая и по флагам
    var fleetCap = 0;
    var flaggedCap = {};
    s.trucks.forEach(function(tr){
      var e = E.effTruck(tr);
      if (e.cap > fleetCap) fleetCap = e.cap;
      e.flags.forEach(function(f){ if (!flaggedCap[f] || e.cap > flaggedCap[f]) flaggedCap[f] = e.cap; });
    });
    var cargos = Game.data.cargo.filter(function(c){
      if (c.lvl > lvl || c.min > fleetCap) return false;
      var fl = c.flags || [];
      for (var i = 0; i < fl.length; i++) if (!flaggedCap[fl[i]] || flaggedCap[fl[i]] < c.min) return false;
      return true;
    });
    if (!cargos.length) return null;
    var cargo = Game.pick(cargos);
    var maxW = Math.min(cargo.max, fleetCap);
    (cargo.flags || []).forEach(function(f){ if (flaggedCap[f] < maxW) maxW = flaggedCap[f]; });
    var weight = Math.round(Game.rnd(cargo.min, maxW) * 10) / 10;
    var a = Game.pick(cities), b;
    do { b = Game.pick(cities); } while (b.id === a.id);
    var km = Game.dist(a.id, b.id);
    var urgent = Math.random() < 0.2;
    return {
      uid: Game.uid(),
      cargoId: cargo.id,
      from: a.id, to: b.id, km: km,
      weight: weight,
      pay: E.orderPay(km, weight, cargo.mult, urgent),
      urgent: urgent,
      flags: (cargo.flags || []).slice(),
      expiresAt: Date.now() + Game.rndInt(10, 30) * 60000
    };
  };

  E.refreshMarket = function(){
    var s = Game.state;
    var now = Date.now();
    s.market.orders = (s.market.orders || []).filter(function(o){ return o.expiresAt > now; });
    var slots = E.marketSlots();
    var guard = 0;
    while (s.market.orders.length < slots && guard++ < 20) {
      var o = E.generateOrder();
      if (!o) break;
      s.market.orders.push(o);
    }
  };

  // ---------- рейсы ----------

  E.dispatch = function(orderUid, truckUid, driverUid){
    var s = Game.state;
    var order = null;
    s.market.orders.forEach(function(o){ if (o.uid === orderUid) order = o; });
    if (!order) return { ok: false, msg: 'Заказ уже забрали' };
    var tr = null, dr = null;
    s.trucks.forEach(function(x){ if (x.uid === truckUid) tr = x; });
    s.drivers.forEach(function(x){ if (x.uid === driverUid) dr = x; });
    if (!tr || !dr) return { ok: false, msg: 'Выберите машину и водителя' };
    if (E.isBusy(truckUid)) return { ok: false, msg: 'Машина уже в рейсе' };
    if ((tr.tires || 0) >= Game.data.tireMaxWear) return { ok: false, msg: 'Шины изношены — замените комплект в автопарке' };
    if (E.driverBusy(driverUid)) return { ok: false, msg: 'Водитель уже в рейсе' };
    if (dr.restUntil > Date.now()) return { ok: false, msg: 'Водитель отдыхает' };
    var eff = E.effTruck(tr);
    if (eff.cap < order.weight) return { ok: false, msg: 'Грузоподъёмности не хватает' };
    var missing = (order.flags || []).filter(function(f){ return eff.flags.indexOf(f) < 0; });
    if (missing.length) return { ok: false, msg: Game.flagRequirement(missing[0]) };
    var fuel = E.fuelCost(order.km, eff.cons, eff.elec);
    var advance = Math.round(order.pay * dr.share / 100);
    if (s.money < fuel + advance) return { ok: false, msg: 'Не хватает на топливо и аванс: ' + Game.fmt.money(fuel + advance) };
    s.money -= fuel + advance;
    s.stats.spent += fuel + advance;
    E.logOp('out', fuel, 'Топливо: ' + Game.city(order.from).name + ' → ' + Game.city(order.to).name);
    E.logOp('out', advance, 'Аванс водителю: ' + dr.name);

    var events = E.rollEvents(tr, eff, dr);
    var minutes = E.tripMinutes(order.km, order.urgent, eff.speed, dr.skills.speed);
    var duration = minutes * 60000;
    var extraTime = 0, extraPay = 0, fines = 0, brk = false;
    events.forEach(function(ev){
      var d = EVDEF[ev.type];
      if (d.time) extraTime += d.time;
      if (d.pay) extraPay += Math.round(order.pay * d.pay);
      if (d.fine) { var f = Game.rndInt(d.fine[0], d.fine[1]); ev.fine = f; fines += f; }
      if (ev.type === 'breakdown') { brk = true; extraTime += 0.3; }
    });
    duration = Math.round(duration * (1 + extraTime));

    var trip = {
      uid: Game.uid(),
      status: 'active',
      order: {
        cargoId: order.cargoId, from: order.from, to: order.to,
        km: order.km, weight: order.weight, pay: order.pay, urgent: order.urgent,
        flags: (order.flags || []).slice()
      },
      truckUid: truckUid, driverUid: driverUid,
      trailerUid: eff.trailer ? eff.trailer.uid : null,
      startedAt: Date.now(),
      endAt: Date.now() + duration,
      events: events.map(function(ev){
        return { type: ev.type, at: Math.round(ev.atFrac * duration), fine: ev.fine || 0, seen: false };
      }),
      payFinal: Math.max(0, order.pay + extraPay - fines),
      fuel: fuel, advance: advance, brk: brk
    };
    s.trips.push(trip);
    s.market.orders = s.market.orders.filter(function(o){ return o.uid !== orderUid; });
    Game.save();
    return { ok: true, trip: trip };
  };

  E.xpGain = function(order){
    return Math.round(order.km / 20 + order.weight * 2);
  };

  E.addXp = function(xp){
    var s = Game.state;
    var before = Game.levelInfo(s.xp).level;
    s.xp += xp;
    var after = Game.levelInfo(s.xp).level;
    if (after > before && Game.ui.ready) {
      Game.toast('🎉 Уровень ' + after + '! Открыты новые возможности', 'ok');
      Game.haptic('level');
      if (Game.confetti) Game.confetti();
    }
  };

  E.resolveTrip = function(t){
    if (t.status !== 'active') return;
    var s = Game.state;
    t.status = 'done';
    t.finishedAt = t.endAt;
    var o = t.order;
    // бухгалтеры: оптимизация выплат (+% к оплате, суммарно до 15%);
    // «Удвоенный доход» из магазина Stars: ×2 к оплате, пока действует
    var bonusPct = E.accountantBonus();
    var boost = (s.stars && s.stars.boostUntil && Date.now() < s.stars.boostUntil) ? 2 : 1;
    var payout = Math.round(t.payFinal * (1 + bonusPct / 100) * boost);
    // оклады офисного персонала — с каждого доставленного рейса
    var salaries = E.staffSalaries();
    var charged = (salaries > 0 && s.money + payout >= salaries) ? salaries : 0;
    s.money += payout - charged;
    s.stats.earned += payout;
    if (charged > 0) s.stats.spent += charged;
    s.stats.tripsDone++;
    s.stats.km += o.km;
    if (t.brk) s.stats.breakdowns++;
    E.logOp('in', payout, 'Оплата: ' + Game.city(o.from).name + ' → ' + Game.city(o.to).name);
    if (charged > 0) E.logOp('out', charged, 'Оклады персонала');
    // износ машины (механики снижают)
    var tr = null;
    s.trucks.forEach(function(x){ if (x.uid === t.truckUid) tr = x; });
    if (tr) {
      tr.km = (tr.km || 0) + o.km; // одометр: пробег виден в салоне б/у и автопарке
      // шины изнашиваются от пробега; поломка бьёт и по ним
      tr.tires = Math.min(Game.data.tireMaxWear, Math.round(((tr.tires || 0) + o.km / Game.data.tireWearKmK) * 10) / 10);
      if (t.brk) tr.tires = Math.min(Game.data.tireMaxWear, Math.round((tr.tires + 10) * 10) / 10);
      var dr = null;
      s.drivers.forEach(function(x){ if (x.uid === t.driverUid) dr = x; });
      var care = dr ? dr.skills.care : 0;
      var wearAdd = Math.min(Game.data.wearMax, Game.data.wearBase + o.km / Game.data.wearKmK) * (1 - care * 0.03) * (1 - E.mechanicWearReduction());
      if (t.brk) wearAdd += 15;
      tr.wear = Math.min(100, Math.round((tr.wear + wearAdd) * 10) / 10);
      // прицеп изнашивается чуть медленнее тягача; абразивные грузы дают дополнительный износ
      var trailer = null;
      if (t.trailerUid) s.trailers.forEach(function(x){ if (x.uid === t.trailerUid) trailer = x; });
      if (!trailer) trailer = E.trailerOf(tr.uid);
      if (trailer) {
        var TT = Game.trailerType(trailer.tid);
        var trailerWear = wearAdd * 0.8 * (TT.wearK || 1);
        trailer.wear = Math.min(100, Math.round((trailer.wear + trailerWear) * 10) / 10);
      }
    }
    // водитель отдыхает
    var d2 = null;
    s.drivers.forEach(function(x){ if (x.uid === t.driverUid) d2 = x; });
    if (d2) d2.restUntil = Date.now() + Math.round(60000 * (1 + o.km / 1000 * 0.4));
    // опыт
    E.addXp(E.xpGain(o));
    t.net = payout - t.fuel - t.advance - charged;
    Game.save();
  };

  // Доводит мир до «сейчас»: завершает рейсы, показывает события, пополняет биржу.
  // silent=true — при запуске приложения, без всплывающих уведомлений.
  E.settle = function(silent){
    var s = Game.state;
    var now = Date.now();
    var resolved = 0, earned = 0;
    s.trips.forEach(function(t){
      if (t.status === 'active' && t.endAt <= now) {
        E.resolveTrip(t);
        resolved++;
        earned += t.payFinal;
      }
    });
    // события активных рейсов: отметить случившиеся
    var lastEv = null;
    s.trips.forEach(function(t){
      if (t.status !== 'active') return;
      t.events.forEach(function(ev){
        if (!ev.seen && t.startedAt + ev.at <= now) {
          ev.seen = true;
          lastEv = ev;
        }
      });
    });
    E.refreshMarket();
    E.refreshSalon();
    E.autoMaintain(now);
    // историю держим компактной — последние 20
    var done = s.trips.filter(function(t){ return t.status === 'done'; });
    if (done.length > 20) {
      var keep = {};
      done.slice(-20).forEach(function(t){ keep[t.uid] = true; });
      s.trips = s.trips.filter(function(t){ return t.status === 'active' || keep[t.uid]; });
    }
    if (resolved > 0) {
      if (!silent) {
        var word = Game.plural(resolved, 'рейс доставлен', 'рейса доставлено', 'рейсов доставлено');
        Game.toast('✅ ' + word + ' · +' + Game.fmt.money(earned), 'ok');
        Game.haptic('ok');
        if (Game.sound) Game.sound.play('coin');
      }
      Game.save();
    } else if (lastEv && !silent) {
      Game.toast(E.eventToastText(lastEv));
      Game.save();
    }
    return { resolved: resolved, earned: earned };
  };

  // ---------- водители ----------

  E.generateDriver = function(){
    var speed = Game.rndInt(1, 10), care = Game.rndInt(1, 10), luck = Game.rndInt(1, 10);
    var share = Math.round(15 + (speed + care + luck) / 30 * 10);
    var name = Game.pick(Game.data.driverFirst) + ' ' + Game.pick(Game.data.driverLast);
    return { uid: Game.uid(), role: 'driver', name: name, skills: { speed: speed, care: care, luck: luck }, share: share, restUntil: 0 };
  };

  E.hire = function(candUid){
    var s = Game.state;
    if (E.staffTotal() >= E.staffSlots()) return { ok: false, msg: 'В офисе нет свободных мест — нужно расширение' };
    var cand = null;
    s.staffMarket.list.forEach(function(c){ if (c.uid === candUid) cand = c; });
    if (!cand || cand.role !== 'driver') return { ok: false, msg: 'Кандидат уже нанят' };
    s.drivers.push({ uid: cand.uid, name: cand.name, skills: cand.skills, share: cand.share, restUntil: 0 });
    s.staffMarket.list = s.staffMarket.list.filter(function(c){ return c.uid !== candUid; });
    Game.save();
    return { ok: true, msg: '👨‍✈️ ' + cand.name + ' принят на работу' };
  };

  E.fire = function(driverUid){
    var s = Game.state;
    if (E.driverBusy(driverUid)) return { ok: false, msg: 'Водитель в рейсе' };
    var d = null;
    s.drivers.forEach(function(x){ if (x.uid === driverUid) d = x; });
    if (!d) return { ok: false, msg: 'Водитель не найден' };
    s.drivers = s.drivers.filter(function(x){ return x.uid !== driverUid; });
    Game.save();
    return { ok: true, msg: '👋 ' + d.name + ' уволен' };
  };

  // ---------- офисный персонал: водители, бухгалтеры и механики ----------

  E.staffOf = function(role){
    return Game.state.staff.filter(function(x){ return x.role === role; });
  };

  // Все сотрудники компании (водители + офис) занимают общие рабочие места
  E.staffTotal = function(){
    return Game.state.drivers.length + Game.state.staff.length;
  };

  // Рабочие места офиса: 2 базовых + 1 за уровень улучшения
  E.staffSlots = function(){
    return 2 + (Game.state.officeLvl || 0);
  };

  E.staffSalaries = function(){
    var total = 0;
    Game.state.staff.forEach(function(x){ total += x.salary; });
    return total;
  };

  // Бухгалтеры: суммарный процент к оплате рейсов (максимум 15%)
  E.accountantBonus = function(){
    var total = 0;
    E.staffOf('accountant').forEach(function(a){ total += a.skill * 0.5; });
    return Math.min(15, Math.round(total * 10) / 10);
  };

  // Механики: суммарное снижение износа за рейс (максимум 60%)
  E.mechanicWearReduction = function(){
    var total = 0;
    E.staffOf('mechanic').forEach(function(m){ total += m.skill * 1.5; });
    return Math.min(60, total) / 100;
  };

  // Механики потихоньку восстанавливают машины: 0,4% износа в час за очко мастерства
  E.autoMaintain = function(now){
    var s = Game.state;
    var mechs = E.staffOf('mechanic');
    if (!mechs.length) { s.lastMaintAt = now; return; }
    var hours = (now - (s.lastMaintAt || now)) / 3600000;
    if (hours < 0.5) return;
    var rate = 0;
    mechs.forEach(function(m){ rate += m.skill * 0.4; });
    var heal = rate * hours;
    if (heal > 0) {
      s.trucks.forEach(function(tr){
        if (tr.wear > 0) tr.wear = Math.max(0, Math.round((tr.wear - heal) * 10) / 10);
      });
    }
    s.lastMaintAt = now;
  };

  E.generateStaffMember = function(role){
    var skill = Game.rndInt(1, 10);
    var name, salary;
    if (role === 'accountant') {
      salary = 300 + skill * 70;
      name = Game.pick(Game.data.staffFirstF) + ' ' + Game.pick(Game.data.staffLastF);
    } else {
      salary = 250 + skill * 60;
      name = Game.pick(Game.data.driverFirst) + ' ' + Game.pick(Game.data.driverLast);
    }
    return { uid: Game.uid(), role: role, name: name, skill: skill, salary: salary };
  };

  E.refreshStaffMarket = function(){
    var s = Game.state;
    var sm = s.staffMarket;
    var now = Date.now();
    if (!sm.list || !sm.list.length || sm.refreshAt <= now) {
      sm.list = [];
      for (var i = 0; i < 3; i++) {
        sm.list.push(E.generateDriver());
        sm.list.push(E.generateStaffMember('accountant'));
        sm.list.push(E.generateStaffMember('mechanic'));
      }
      sm.refreshAt = now + 10 * 60000;
      Game.save();
    }
  };

  E.hireStaff = function(candUid){
    var s = Game.state;
    if (E.staffTotal() >= E.staffSlots()) return { ok: false, msg: 'В офисе нет свободных мест — нужно расширение' };
    var cand = null;
    s.staffMarket.list.forEach(function(c){ if (c.uid === candUid) cand = c; });
    if (!cand) return { ok: false, msg: 'Кандидат уже нанят' };
    s.staff.push({ uid: cand.uid, role: cand.role, name: cand.name, skill: cand.skill, salary: cand.salary });
    s.staffMarket.list = s.staffMarket.list.filter(function(c){ return c.uid !== candUid; });
    Game.save();
    return { ok: true, msg: (cand.role === 'accountant' ? '🧾 ' : '🔧 ') + cand.name + ' выходит на работу' };
  };

  E.fireStaff = function(staffUid){
    var s = Game.state;
    var p = null;
    s.staff.forEach(function(x){ if (x.uid === staffUid) p = x; });
    if (!p) return { ok: false, msg: 'Сотрудник не найден' };
    s.staff = s.staff.filter(function(x){ return x.uid !== staffUid; });
    Game.save();
    return { ok: true, msg: '👋 ' + p.name + ' уволен' };
  };

  // ---------- покупки за Telegram Stars ----------

  // Награды — мягкие, «без сильного облегчения»: контент и уровни не продаются.
  E.grantStarsProduct = function(productId){
    var s = Game.state;
    if (productId === 'money') {
      // раз в сутки, сумма привязана к уровню — не обгоняет прогрессию
      if (s.stars.lastMoneyAt && Date.now() - s.stars.lastMoneyAt < 24 * 3600000) {
        return { ok: false, msg: 'Денежный перевод доступен раз в сутки' };
      }
      var lvl = Game.levelInfo(s.xp).level;
      var amount = 25000 * lvl;
      s.money += amount;
      s.stars.lastMoneyAt = Date.now();
      E.logOp('in', amount, 'Пополнение за Stars');
      Game.save();
      Game.updateHUD();
      return { ok: true, msg: '💳 Зачислено ' + Game.fmt.money(amount) };
    }
    if (productId === 'boost') {
      // продлевает текущий буст, а не перезаписывает
      var base = Math.max(Date.now(), s.stars.boostUntil || 0);
      s.stars.boostUntil = base + 24 * 3600000;
      Game.save();
      return { ok: true, msg: '⭐ Доход ×2 — активен до ' + new Date(s.stars.boostUntil).toLocaleTimeString('ru-RU') };
    }
    if (productId === 'repair') {
      var trucks = 0, trailers = 0;
      s.trucks.forEach(function(t){ if (t.wear > 0) { t.wear = 0; trucks++; } });
      s.trailers.forEach(function(t){ if (t.wear > 0) { t.wear = 0; trailers++; } });
      Game.save();
      if (Game.currentScreen) Game.navigate(Game.currentScreen, true);
      return { ok: true, msg: '🔧 Обслужено: машин ' + trucks + ', прицепов ' + trailers };
    }
    if (productId === 'hurry') {
      // все активные рейсы приезжают на 15 минут раньше; остаток меньше 15 мин — доставляется сразу
      var cutMs = 15 * 60000, cnt = 0;
      s.trips.forEach(function(t){
        if (t.status !== 'active') return;
        var newEnd = Math.max(t.startedAt, t.endAt - cutMs);
        if (newEnd < t.endAt) { t.endAt = newEnd; cnt++; }
      });
      if (cnt === 0) return { ok: false, msg: 'Нет активных рейсов — ускорять нечего' };
      Game.save();
      var r = E.settle(false); // рейсы, «срезанные до нуля», приезжают сразу
      if (r && r.resolved > 0) {
        return { ok: true, msg: '⏩ Ускорено: ' + cnt + ' · сразу доставлено: ' + r.resolved + ' (+' + Game.fmt.money(r.earned) + ')' };
      }
      return { ok: true, msg: '⏩ ' + Game.plural(cnt, 'рейс приедет', 'рейса приедут', 'рейсов приедут') + ' на 15 минут раньше' };
    }
    return { ok: false, msg: 'Неизвестный товар' };
  };

  // ---------- бонусы (выдаёт владелец игры через воркер: grants → /grant) ----------

  E.applyGrant = function(g){
    var s = Game.state;
    if (g && g.kind === 'money' && g.amount > 0) {
      var amount = Math.round(g.amount);
      s.money += amount;
      E.logOp('in', amount, g.note || 'Бонус');
      Game.save();
      Game.updateHUD();
      return { ok: true, msg: '🎁 ' + (g.note || 'Бонус') + ': +' + Game.fmt.money(amount) };
    }
    return { ok: false };
  };

  // Журнал операций для бухгалтерии + дневная сводка для графика на «Офисе»
  E.logOp = function(cat, amount, note){
    var s = Game.state;
    amount = Math.round(amount);
    if (!Array.isArray(s.oplog)) s.oplog = [];
    s.oplog.unshift({ t: Date.now(), cat: cat, amount: amount, note: note });
    if (s.oplog.length > 60) s.oplog.length = 60;
    if (!s.finance) s.finance = {};
    var k = Game.dayKey();
    var f = s.finance[k] || { in: 0, out: 0 };
    if (cat === 'in') f.in += amount; else f.out += amount;
    s.finance[k] = f;
    var keys = Object.keys(s.finance).sort();
    while (keys.length > 14) { delete s.finance[keys.shift()]; keys = Object.keys(s.finance).sort(); }
  };

  // Проверка достижений — раз в тик; новые — тост по очереди + конфетти
  E.checkAchievements = function(){
    var s = Game.state;
    if (!s.achievements) s.achievements = {};
    var fresh = [];
    Game.data.achievements.forEach(function(a){
      if (s.achievements[a.id]) return;
      var got = false;
      try { got = !!a.check(s); } catch (e) {}
      if (got) { s.achievements[a.id] = Date.now(); fresh.push(a); }
    });
    if (fresh.length && Game.ui.ready) {
      fresh.forEach(function(a, i){
        setTimeout(function(){ Game.toast('🏅 Достижение: ' + a.name, 'ok'); }, i * 350);
      });
      Game.haptic('level');
      if (Game.confetti) Game.confetti();
      Game.save();
    }
    return fresh;
  };

  // ---------- ежедневный бонус ----------

  E.dailyInfo = function(){
    var s = Game.state;
    if (!s.daily) s.daily = { lastClaim: '', streak: 0 };
    var today = Game.dayKey();
    var yesterday = Game.dayKey(new Date(Date.now() - 86400000));
    var claimed = s.daily.lastClaim === today;
    var nextStreak = (s.daily.lastClaim === yesterday) ? (s.daily.streak || 0) + 1 : 1;
    var lvl = Game.levelInfo(s.xp).level;
    var reward = Math.round((2000 + lvl * 1000) * (1 + Math.min(nextStreak - 1, 7) / 7));
    return { claimed: claimed, streak: s.daily.streak || 0, nextStreak: nextStreak, reward: reward };
  };

  E.claimDaily = function(){
    var s = Game.state;
    var info = E.dailyInfo();
    if (info.claimed) return { ok: false, msg: 'Бонус уже забран — приходите завтра' };
    s.money += info.reward;
    s.stats.earned += info.reward;
    s.daily.lastClaim = Game.dayKey();
    s.daily.streak = info.nextStreak;
    E.logOp('in', info.reward, 'Ежедневный бонус');
    Game.save();
    Game.updateHUD();
    return { ok: true, msg: '🎁 Бонус +' + Game.fmt.money(info.reward) + (info.nextStreak > 1 ? ' · серия ' + info.nextStreak + ' дн.' : ''), reward: info.reward };
  };
})();
