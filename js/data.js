'use strict';
window.Game = window.Game || {};
Game.screens = {};

Game.data = {
  version: 1,

  // Экономика
  fuelPrice: 65,          // ₽ за литр
  fuelPriceElec: 15,      // ₽ за кВт·ч для электрогрузовиков (дешёвая «заправка»)
  salaryShareDefault: 0.2,// доля водителя от оплаты заказа
  repairRate: 0.003,      // ремонт = цена машины × repairRate × износ(%)
  minTripMin: 2,          // минимальная длительность рейса, реальных минут
  maxTripMin: 25,         // максимальная
  kmPerMin: 50,           // километров пути на реальную минуту (темп рейсов)
  roadK: 1.2,             // коэффициент извилистости дорог к прямой линии

  // img — путь к картинке модели (например, 'img/trucks/kamaz.png'); показывается в салоне.
  // Пока путь не задан — салон рисует заглушку 🚛. Картинки можно подключить позже без правок кода.
  trucks: [
    { id:'gazelle', name:'Газель Next',  price:25000,   cap:1.5, speed:95,  cons:12, rel:70, lvl:1,  img:'img/trucks/gazelle.jpg' },
    { id:'bychok',  name:'«Бычок» ЗАО',  price:60000,   cap:3,   speed:90,  cons:14, rel:75, lvl:2,  img:'img/trucks/bychok.jpg' },
    { id:'zil',     name:'ЗИЛ-130',      price:120000,  cap:5,   speed:85,  cons:18, rel:78, lvl:3,  img:'' },
    { id:'kamaz',   name:'КамАЗ-5320',   price:300000,  cap:10,  speed:90,  cons:25, rel:82, lvl:5,  img:'' },
    { id:'maz',     name:'МАЗ-6430',     price:600000,  cap:20,  speed:95,  cons:30, rel:85, lvl:8,  img:'' },
    { id:'egaz',    name:'ГАЗель Электро',       price:300000,  cap:2,  speed:92,  cons:14, rel:74, lvl:10, img:'', elec:true },
    { id:'volvo',   name:'Volvo FH16',   price:1200000, cap:25,  speed:105, cons:28, rel:92, lvl:12, img:'' },
    { id:'ekam',    name:'КамАЗ «Электро»',      price:1300000, cap:12, speed:100, cons:22, rel:82, lvl:13, img:'', elec:true },
    { id:'apkam',   name:'КамАЗ-6490 Автопоезд', price:3200000, cap:33, speed:95,  cons:34, rel:86, lvl:15, img:'' },
    { id:'scania',  name:'Scania R730',  price:2500000, cap:26,  speed:110, cons:26, rel:95, lvl:16, img:'' },
    { id:'apscan',  name:'Scania S770 Автопоезд', price:7000000, cap:40, speed:105, cons:31, rel:96, lvl:18, img:'' },
  ],

  // Салон б/у грузовиков (вкладка «Салон»): завоз и ценообразование
  salon: {
    refreshMin: 15,           // минут между завозами
    stockMin: 3, stockMax: 5, // машин за завоз
    wearMin: 15, wearMax: 75, // износ предложений, %
    priceBase: 0.65,          // доля цены нового при нулевом износе
    wearK: 0.004,             // вычет доли за каждый 1 % износа
    priceMin: 0.18,           // нижняя граница доли цены (совсем убитая всё равно что-то стоит)
    upChance: 0.35,           // шанс, что апгрейд уже установлен на машине
    upResidual: 0.35,         // остаточная стоимость установленных апгрейдов от цены их уровней
    dealChance: 0.15,         // шанс «выгодной сделки»
    dealDisc: 0.12,           // скидка «выгодной сделки»
    kmPerWear: [700, 1600]    // км пробега на каждый 1 % износа
  },

  cities: [
    { id:'msk',   name:'Москва',           lat:55.75, lon:37.62, lvl:1  },
    { id:'tula',  name:'Тула',             lat:54.32, lon:37.62, lvl:1  },
    { id:'spb',   name:'Санкт-Петербург',  lat:59.93, lon:30.34, lvl:2  },
    { id:'yar',   name:'Ярославль',        lat:57.63, lon:39.87, lvl:1  },
    { id:'vor',   name:'Воронеж',          lat:51.66, lon:39.20, lvl:1  },
    { id:'nn',    name:'Нижний Новгород',  lat:56.33, lon:44.00, lvl:3  },
    { id:'kaz',   name:'Казань',           lat:55.79, lon:49.11, lvl:3  },
    { id:'rost',  name:'Ростов-на-Дону',   lat:47.23, lon:39.72, lvl:3  },
    { id:'kras',  name:'Краснодар',        lat:45.03, lon:38.98, lvl:4  },
    { id:'volg',  name:'Волгоград',        lat:48.71, lon:44.51, lvl:4  },
    { id:'sar',   name:'Саратов',          lat:51.55, lon:46.03, lvl:4  },
    { id:'sam',   name:'Самара',           lat:53.20, lon:50.15, lvl:5  },
    { id:'ufa',   name:'Уфа',              lat:54.73, lon:55.97, lvl:5  },
    { id:'che',   name:'Челябинск',        lat:55.16, lon:61.40, lvl:6  },
    { id:'ekb',   name:'Екатеринбург',     lat:56.84, lon:60.65, lvl:6  },
    { id:'sochi', name:'Сочи',             lat:43.60, lon:39.73, lvl:7  },
    { id:'nsk',   name:'Новосибирск',      lat:55.03, lon:82.92, lvl:10 },
  ],

  cargo: [
    { id:'build',     name:'Стройматериалы',       min:0.5, max:3,  lvl:1,  mult:1.0 },
    { id:'furn',      name:'Мебель',               min:0.3, max:2,  lvl:1,  mult:1.1 },
    { id:'food',      name:'Продукты питания',     min:0.5, max:8,  lvl:1,  mult:1.2 },
    { id:'tech',      name:'Бытовая техника',      min:0.2, max:2,  lvl:2,  mult:1.3 },
    { id:'agro',      name:'Сельхозпродукция',     min:1,   max:15, lvl:3,  mult:1.1 },
    { id:'elec',      name:'Электроника',          min:0.1, max:1,  lvl:4,  mult:1.8 },
    { id:'reefer',    name:'Рефрижераторный груз', min:1,   max:10, lvl:6,  mult:1.5, flags:['reefer'] },
    { id:'container', name:'Контейнер',            min:10,  max:25, lvl:8,  mult:1.4 },
    { id:'adr',       name:'Опасный груз (ADR)',   min:5,   max:20, lvl:10, mult:2.0, flags:['adr'] },
  ],

  // Прицепы: minCap — минимальная грузоподъёмность тягача (базовая, без прицепа),
  // consAdd — надбавка к расходу топлива, flags — какие требования грузов закрывают
  trailers: [
    { id:'light',     name:'Лёгкий прицеп',          price:35000,  capAdd:1.5, minCap:1.5, consAdd:0.10, flags:[]          },
    { id:'tarp',      name:'Тентованный прицеп',     price:120000, capAdd:8,   minCap:5,   consAdd:0.15, flags:[]          },
    { id:'reefer',    name:'Рефрижераторный прицеп', price:250000, capAdd:10,  minCap:10,  consAdd:0.20, flags:['reefer']  },
    { id:'tank',      name:'Цистерна (ADR)',         price:400000, capAdd:12,  minCap:20,  consAdd:0.20, flags:['adr']      },
    { id:'roadtrain', name:'Полуприцеп «Автопоезд»', price:900000, capAdd:20,  minCap:25,  consAdd:0.25, flags:[]          },
  ],

  upgrades: [
    { id:'engine',  name:'Двигатель',      desc:'+5 к скорости',  levels:3, step:0.2 },
    { id:'service', name:'ТО и запчасти',  desc:'+5 к надёжности', levels:3, step:0.2 },
    { id:'fuel',    name:'Тюнинг расхода', desc:'−2 л/100 км',    levels:2, step:0.2 },
  ],

  // Расширение базы: цены уровней гаража и офиса
  garageUpgrades: [40000, 90000, 200000, 450000, 1000000, 2200000, 4800000, 10000000],
  officeUpgrades: [30000, 70000, 160000, 360000, 800000, 1800000],

  driverFirst: ['Иван','Пётр','Алексей','Сергей','Дмитрий','Андрей','Николай','Виктор','Олег','Юрий','Марат','Руслан','Григорий','Тимофей','Богдан','Степан'],
  driverLast:  ['Петров','Смирнов','Кузнецов','Соколов','Попов','Волков','Алексеев','Лебедев','Семёнов','Егоров','Павлов','Козлов','Николаев','Морозов','Зайцев','Орлов'],
  staffFirstF: ['Анна','Ольга','Мария','Екатерина','Татьяна','Ирина','Светлана','Наталья','Елена','Юлия','Вера','Галина'],
  staffLastF:  ['Иванова','Петрова','Смирнова','Кузнецова','Попова','Волкова','Соколова','Лебедева','Козлова','Морозова','Егорова','Орлова'],

  // Достижения: check(state) — условие получения, вызывается каждый тик
  achievements: [
    { id:'trip1',   icon:'🛣️', name:'Первый рейс',      desc:'Доставить первый груз',        check: function(s){ return s.stats.tripsDone >= 1; } },
    { id:'trip10',  icon:'📦', name:'Десятый рейс',     desc:'10 доставленных рейсов',       check: function(s){ return s.stats.tripsDone >= 10; } },
    { id:'trip50',  icon:'🚚', name:'Полсотни рейсов',  desc:'50 доставленных рейсов',       check: function(s){ return s.stats.tripsDone >= 50; } },
    { id:'trip100', icon:'🏆', name:'Сотня рейсов',     desc:'100 доставленных рейсов',      check: function(s){ return s.stats.tripsDone >= 100; } },
    { id:'fleet2',  icon:'🚛', name:'Не одной машиной', desc:'Второй грузовик в автопарке',  check: function(s){ return s.trucks.length >= 2; } },
    { id:'fleet5',  icon:'🏭', name:'Большой автопарк', desc:'5 грузовиков в автопарке',     check: function(s){ return s.trucks.length >= 5; } },
    { id:'lvl5',    icon:'⭐', name:'Пятый уровень',    desc:'Достичь 5 уровня',             check: function(s){ return Game.levelInfo(s.xp).level >= 5; } },
    { id:'lvl10',   icon:'🌟', name:'Десятый уровень',  desc:'Достичь 10 уровня',            check: function(s){ return Game.levelInfo(s.xp).level >= 10; } },
    { id:'acc1',    icon:'🧾', name:'Первый бухгалтер', desc:'Нанять бухгалтера',            check: function(s){ return (s.staff || []).some(function(p){ return p.role === 'accountant'; }); } },
    { id:'mech1',   icon:'🔧', name:'Первый механик',   desc:'Нанять механика',              check: function(s){ return (s.staff || []).some(function(p){ return p.role === 'mechanic'; }); } },
    { id:'million', icon:'💎', name:'Миллионер',        desc:'Накопить 1 000 000 ₽',         check: function(s){ return s.money >= 1000000; } },
    { id:'km100k',  icon:'🌍', name:'100 000 км',       desc:'Пройти 100 000 км по дорогам', check: function(s){ return s.stats.km >= 100000; } },
  ],
};

Game.truck = function(id){ return Game.data.trucks.find(function(t){ return t.id === id; }); };
Game.trailerType = function(id){ return Game.data.trailers.find(function(t){ return t.id === id; }); };
Game.city  = function(id){ return Game.data.cities.find(function(c){ return c.id === id; }); };

// Расстояние между городами, км (гаверсинус × коэффициент дорог)
Game.dist = function(aId, bId){
  var a = Game.city(aId), b = Game.city(bId);
  if (!a || !b || a === b) return 0;
  var rad = Math.PI / 180;
  var dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(a.lat * rad) * Math.cos(b.lat * rad) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var km = 2 * 6371 * Math.asin(Math.sqrt(s));
  km = km * Game.data.roadK;
  return Math.max(10, Math.round(km / 10) * 10);
};

// Уровень по суммарному опыту: пороги 150, 248, 409, 675…
Game.levelInfo = function(xp){
  var lvl = 1, need = 150, rest = Math.max(0, Math.round(xp || 0));
  while (rest >= need && lvl < 99) { rest -= need; lvl++; need = Math.round(need * 1.65); }
  return { level: lvl, cur: rest, need: need };
};

// Ключ дня в формате YYYY-MM-DD (локальная дата)
Game.dayKey = function(d){
  d = d || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
