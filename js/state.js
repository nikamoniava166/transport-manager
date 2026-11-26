'use strict';
(function(){
  var tg = window.Telegram && window.Telegram.WebApp;
  var user = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || null;
  Game.userId = user ? String(user.id) : 'local';
  Game.playerName = (user && user.first_name) || 'Шеф';
  Game.SAVE_KEY = 'tm_save_' + Game.userId;

  Game.defaultState = function(){
    return {
      v: Game.data.version,
      money: 50000,
      xp: 0,
      uidSeq: 100,
      garageLvl: 0,
      officeLvl: 0,
      trucks: [
        { uid: 101, tid: 'gazelle', wear: 10, up: {} }
      ],
      trailers: [],
      drivers: [
        { uid: 102, name: 'Иван Петров', skills: { speed: 3, care: 4, luck: 3 }, share: 20, restUntil: 0 }
      ],
      staff: [],
      staffMarket: { list: [], refreshAt: 0 },
      warehouse: { parts: 2, tires: 4 },
      company: { name: '', named: false },
      oplog: [],
      lastMaintAt: Date.now(),
      trips: [],
      market: { orders: [], refreshAt: 0 },
      salon: { list: [], refreshAt: 0 },
      stars: { boostUntil: 0, lastMoneyAt: 0 },
      stats: { tripsDone: 0, earned: 0, spent: 0, km: 0, breakdowns: 0 },
      settings: { sound: true, haptic: true },
      achievements: {},
      finance: {},
      daily: { lastClaim: '', streak: 0 },
      created: Date.now(),
      lastSeen: Date.now()
    };
  };

  // Долит в старый сейв поля, появившиеся в новых версиях
  Game.migrate = function(st){
    var d = Game.defaultState();
    var out = Object.assign({}, d, st || {});
    out.stats         = Object.assign({}, d.stats,         (st && st.stats)         || {});
    out.settings      = Object.assign({}, d.settings,      (st && st.settings)      || {});
    out.market        = Object.assign({}, d.market,        (st && st.market)        || {});
    out.staffMarket   = Object.assign({}, d.staffMarket,   (st && st.staffMarket)   || {});
    out.salon         = Object.assign({}, d.salon,         (st && st.salon)         || {});
    out.salon.list    = Array.isArray(out.salon.list) ? out.salon.list : [];
    out.warehouse     = Object.assign({}, d.warehouse,      (st && st.warehouse)     || {});
    out.company       = Object.assign({}, d.company,        (st && st.company)       || {});
    out.stars         = Object.assign({}, d.stars,         (st && st.stars)         || {});
    out.achievements = (st && st.achievements && typeof st.achievements === 'object' && !Array.isArray(st.achievements)) ? st.achievements : {};
    out.finance      = (st && st.finance && typeof st.finance === 'object' && !Array.isArray(st.finance)) ? st.finance : {};
    out.daily        = Object.assign({}, d.daily, (st && st.daily) || {});
    // старые сейвы: кандидаты-водители из driversMarket переезжают в общий staffMarket
    if (st && st.driversMarket && Array.isArray(st.driversMarket.list)) {
      var dm = st.driversMarket, sm = out.staffMarket;
      var have = {};
      (sm.list || []).forEach(function(c){ have[c.uid] = true; });
      dm.list.forEach(function(c){
        if (!have[c.uid]) { c.role = 'driver'; (sm.list = sm.list || []).push(c); }
      });
      if (dm.refreshAt && (!sm.refreshAt || dm.refreshAt < sm.refreshAt)) sm.refreshAt = dm.refreshAt;
    }
    delete out.driversMarket;
    out.staff     = Array.isArray(out.staff)     ? out.staff     : [];
    out.oplog     = Array.isArray(out.oplog)     ? out.oplog     : [];
    out.lastMaintAt = out.lastMaintAt || Date.now();
    out.trucks   = Array.isArray(out.trucks)   ? out.trucks   : d.trucks;
    // пробег (появился вместе с салоном б/у) — у старых машин копится с нуля;
    // шины (шаг «Поломки и шины») у старых машин тоже стартуют с нуля
    out.trucks.forEach(function(t){ if (t.km == null) t.km = 0; if (t.tires == null) t.tires = 0; });
    out.trailers = Array.isArray(out.trailers) ? out.trailers : [];
    out.drivers  = Array.isArray(out.drivers)  ? out.drivers  : d.drivers;
    out.trips    = Array.isArray(out.trips)    ? out.trips    : [];
    // старые рейсы не хранили требования груза и id прицепа — восстанавливаем их
    out.trips.forEach(function(t){
      if (!t.order) return;
      if (!Array.isArray(t.order.flags)) {
        var cargo = Game.data.cargo.find(function(c){ return c.id === t.order.cargoId; });
        t.order.flags = cargo ? (cargo.flags || []).slice() : [];
      }
      if (t.status === 'active' && t.trailerUid == null) {
        out.trailers.forEach(function(trailer){
          if (trailer.attachedTo === t.truckUid) t.trailerUid = trailer.uid;
        });
      }
    });
    out.uidSeq   = Math.max(out.uidSeq || 100, 100);
    out.v        = Game.data.version;
    return out;
  };

  // Сквозной счётчик идентификаторов
  Game.uid = function(){
    Game.state.uidSeq = (Game.state.uidSeq || 100) + 1;
    return Game.state.uidSeq;
  };

  // Есть ли в сейве реальный прогресс — защита копий от затирания пустыми
  Game.hasProgress = function(x){
    return !!((x.stats && x.stats.tripsDone) || (x.xp > 0) ||
              (x.trucks && x.trucks.length > 1) || (x.money || 0) > 50000);
  };

  Game.load = function(){
    var st = null, hadLocal = false;
    try {
      var raw = localStorage.getItem(Game.SAVE_KEY);
      if (raw) { st = JSON.parse(raw); hadLocal = true; }
    } catch (e) {}
    Game.state = Game.migrate(st);

    // Последний рубеж: серверная резервная копия (воркер, D1) — когда ни локального,
    // ни облачного сейва с прогрессом не осталось (хранилище вычистили и т.п.)
    var serverTried = false;
    function tryServer(){
      if (serverTried) return;
      serverTried = true;
      if (!Game.net || !Game.net.restore) return;
      if (Game.hasProgress(Game.state)) return; // прогресс уже есть — копия не нужна
      Game.net.restore(function(res){
        if (!res || !res.ok || !res.state) return;
        try {
          var srv = Game.migrate(JSON.parse(res.state));
          if (Game.hasProgress(srv)) {
            Game.state = srv;
            Game.updateHUD();
            if (Game.currentScreen) Game.navigate(Game.currentScreen, true);
            Game.toast('Прогресс восстановлен из резервной копии', 'ok');
            Game.save(); // сразу сеем обратно в локаль и облако
          }
        } catch (e) {}
      });
    }

    // Telegram CloudStorage. Два случая:
    //  1) локального сейва нет (новое устройство, Telegram вычистил WebView-хранилище) —
    //     облако с прогрессом принимаем всегда: это единственная копия;
    //  2) локальный есть — берём облако, только если оно свежее,
    //     и не затираем реальный локальный прогресс пустым облачным.
    // Пока проверка не завершилась, Game.save не пишет в облако (Game.cloudPending),
    // чтобы дефолтный state не перезаписал облачный сейв до его прочтения.
    try {
      var cs = tg && tg.CloudStorage;
      if (cs && cs.getItem) {
        Game.cloudPending = true;
        setTimeout(function(){ Game.cloudPending = false; }, 5000);
        cs.getItem(Game.SAVE_KEY, function(err, value){
          Game.cloudPending = false;
          try {
            if (err || !value) return;
            var cloud = Game.migrate(JSON.parse(value));
            var cloudReal = Game.hasProgress(cloud);
            var take;
            if (!hadLocal) take = cloudReal;
            else take = (cloud.lastSeen || 0) > (Game.state.lastSeen || 0) + 1000 && (cloudReal || !Game.hasProgress(Game.state));
            if (take) {
              Game.state = cloud;
              Game.updateHUD();
              if (Game.currentScreen) Game.navigate(Game.currentScreen, true);
              if (cloudReal) Game.toast('Прогресс подтянут из облака', 'ok');
            }
          } catch (e) {}
          tryServer();
        });
        setTimeout(tryServer, 6000); // колбэк мог не прийти — не откладываем серверную проверку навсегда
      } else {
        tryServer();
      }
    } catch (e) { tryServer(); }
  };

  Game.save = function(){
    if (!Game.state) return;
    Game.state.lastSeen = Date.now();
    try { localStorage.setItem(Game.SAVE_KEY, JSON.stringify(Game.state)); } catch (e) {}
    // пока идёт первичная проверка облака — не затираем его текущим state
    if (Game.cloudPending) return;
    try {
      var cs = tg && tg.CloudStorage;
      if (cs && cs.setItem) cs.setItem(Game.SAVE_KEY, JSON.stringify(Game.state), function(){});
    } catch (e) {}
  };

  Game.resetSave = function(){
    try { localStorage.removeItem(Game.SAVE_KEY); } catch (e) {}
    try {
      var cs = tg && tg.CloudStorage;
      if (cs && cs.removeItem) cs.removeItem(Game.SAVE_KEY, function(){});
    } catch (e) {}
    Game.state = Game.defaultState();
    Game.save();
  };
})();
