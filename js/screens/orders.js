'use strict';

// Общая вкладка «Биржа»: заказы и активные рейсы в одном окне.
// Таб-бар — одна иконка «Биржа» вместо двух (index.html); внутри — переключатель
// «📦 Биржа / 🛣️ Рейсы». Под-экраны market.js и trips.js регистрируют себя в Game.screens
// как раньше; здесь они переезжают в Game.views и заворачиваются в один экран.
// Переход на «Рейсы» — алиас в Game.navigate (js/app.js): navigate('trips') открывает
// эту вкладку с под-вкладкой рейсов (так market.js переключается после отправки машины).
(function(){
  Game.views = {
    market: Game.screens.market,
    trips: Game.screens.trips
  };

  function active(){
    return Game.ui.ordersTab === 'trips' ? Game.views.trips : Game.views.market;
  }

  Game.screens.market = {
    moneySensitive: true,

    render: function(root){
      var tab = Game.ui.ordersTab === 'trips' ? 'trips' : 'market';
      var tripsNow = Game.state.trips.filter(function(t){ return t.status === 'active'; }).length;
      root.innerHTML = `
        <div class="seg">
          <button class="${tab === 'market' ? 'sel' : ''}" data-otab="market">📦 Биржа</button>
          <button class="${tab === 'trips' ? 'sel' : ''}" data-otab="trips">🛣️ Рейсы${tripsNow ? ' · ' + tripsNow : ''}</button>
        </div>
        <div id="orders-body"></div>`;
      root.querySelectorAll('[data-otab]').forEach(function(b){
        b.onclick = function(){
          Game.haptic('tap');
          Game.ui.ordersTab = b.getAttribute('data-otab');
          Game.navigate('market', true);
        };
      });
      active().render(root.querySelector('#orders-body'));
    },

    onTick: function(){
      // тики достаются только активной под-вкладке: таймеры биржи не дёргают рейсы и наоборот
      var v = active();
      if (v && v.onTick) v.onTick();
    }
  };
})();
