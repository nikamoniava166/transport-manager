'use strict';

// Синтезированные звуки через Web Audio — без файлов.
// Контекст создаётся при первом действии пользователя (требование браузеров).
(function(){
  var ctx = null;

  function ac(){
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') {
      try { ctx.resume(); } catch (e) {}
    }
    return ctx;
  }

  function tone(freq, dur, type, vol, delay){
    var c = ac();
    if (!c) return;
    var t0 = c.currentTime + (delay || 0);
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.06, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }

  var lib = {
    tap:   function(){ tone(520, 0.06, 'triangle', 0.04); },
    ok:    function(){ tone(660, 0.10, 'sine', 0.07); tone(880, 0.14, 'sine', 0.07, 0.09); },
    err:   function(){ tone(220, 0.16, 'sawtooth', 0.05); tone(175, 0.20, 'sawtooth', 0.05, 0.10); },
    coin:  function(){ tone(988, 0.08, 'square', 0.04); tone(1319, 0.16, 'square', 0.04, 0.08); },
    level: function(){ [523, 659, 784, 1047].forEach(function(f, i){ tone(f, 0.18, 'triangle', 0.07, i * 0.11); }); }
  };

  Game.sound = {
    play: function(name){
      if (!Game.state || !Game.state.settings || !Game.state.settings.sound) return;
      var fn = lib[name];
      if (fn) { try { fn(); } catch (e) {} }
    }
  };
})();
