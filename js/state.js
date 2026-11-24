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
      drivers: [
        { uid: 102, name: 'Иван Петров', skills: { speed: 3, care: 4, luck: 3 }, share: 20, restUntil: 0 }
      ],
      staff: [],
      staffMarket: { list: [], refreshAt: 0 },
      oplog: [],
      lastMaintAt: Date.now(),
      trips: [],
      market: { orders: [], refreshAt: 0 },
      stats: { tripsDone: 0, earned: 0, spent: 0, km: 0, breakdowns: 0 },
      settings: { sound: true, haptic: true },
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
    out.drivers  = Array.isArray(out.drivers)  ? out.drivers  : d.drivers;
    out.trips    = Array.isArray(out.trips)    ? out.trips    : [];
    out.uidSeq   = Math.max(out.uidSeq || 100, 100);
    out.v        = Game.data.version;
    return out;
  };

  // Сквозной счётчик идентификаторов
  Game.uid = function(){
    Game.state.uidSeq = (Game.state.uidSeq || 100) + 1;
    return Game.state.uidSeq;
  };

  Game.load = function(){
    var st = null;
    try {
      var raw = localStorage.getItem(Game.SAVE_KEY);
      if (raw) st = JSON.parse(raw);
    } catch (e) {}
    Game.state = Game.migrate(st);

    // Telegram CloudStorage: если облако свежее локального — берём облако
    try {
      var cs = tg && tg.CloudStorage;
      if (cs && cs.getItem) {
        cs.getItem(Game.SAVE_KEY, function(err, value){
          if (err || !value) return;
          try {
            var cloud = Game.migrate(JSON.parse(value));
            if ((cloud.lastSeen || 0) > (Game.state.lastSeen || 0) + 1000) {
              Game.state = cloud;
              Game.updateHUD();
              if (Game.currentScreen) Game.navigate(Game.currentScreen, true);
              Game.toast('Прогресс подтянут из облака', 'ok');
            }
          } catch (e) {}
        });
      }
    } catch (e) {}
  };

  Game.save = function(){
    if (!Game.state) return;
    Game.state.lastSeen = Date.now();
    try { localStorage.setItem(Game.SAVE_KEY, JSON.stringify(Game.state)); } catch (e) {}
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
