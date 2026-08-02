/* ROMA - Start, Spielschleife, Speichern */
'use strict';

var SPEICHER = 'roma-stand-v1';

var App = {
  tempo: 1,
  ton: true,
  akku: 0,
  letzte: 0,
  ac: null,

  start: function () {
    var daten = null;
    try {
      var roh = localStorage.getItem(SPEICHER);
      if (roh) daten = JSON.parse(roh);
    } catch (e) { daten = null; }

    if (daten && daten.geb) {
      try { this.spiel = Spiel.laden(daten); }
      catch (e) { this.spiel = this.frischesSpiel(); }
    } else {
      this.spiel = this.frischesSpiel();
    }

    this.rend = new Renderer(el('cv'), this.spiel);
    var st = this.spiel.startFeld || this.spiel.welt.startFeld;
    this.rend.zentriereAuf(st.x + 1, st.y + 1);
    this.rend.kam.zoom = 1;

    this.ui = new UI(this.spiel, this.rend, this);
    this.ui.aktualisiere();
    this.setzeTempo(1);

    var self = this;
    window.addEventListener('pagehide', function () { self.speichern(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) self.speichern();
    });
    this.letzte = performance.now();
    requestAnimationFrame(function (t) { self.schleife(t); });
  },

  frischesSpiel: function (seed) {
    var s = new Spiel(seed === undefined ? Math.floor(Math.random() * 1e9) : seed);
    var st = s.welt.startFeld;
    /* Forum als Startgebaeude, dazu ein paar Strassen */
    var res = s.baue('forum', st.x, st.y, true);
    if (!res.ok) {
      /* Notfall: naechstbesten Platz suchen */
      for (var r = 1; r < 25 && !res.ok; r++) {
        for (var dy = -r; dy <= r && !res.ok; dy++) {
          for (var dx = -r; dx <= r && !res.ok; dx++) {
            res = s.baue('forum', st.x + dx, st.y + dy, true);
          }
        }
      }
    }
    if (res.ok) {
      var f = res.geb;
      s.startFeld = { x: f.x, y: f.y };
      for (var i = 0; i < 4; i++) {
        s.baue('strasse', f.x + f.s, f.y + i, true);
        s.baue('strasse', f.x + i, f.y + f.s, true);
      }
    } else {
      s.startFeld = st;
    }
    s.netzDirty = true;
    return s;
  },

  neuesSpiel: function () {
    localStorage.removeItem(SPEICHER);
    location.reload();
  },

  setzeTempo: function (v) {
    this.tempo = v;
    var btns = el('speed').querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('an', parseFloat(btns[i].dataset.v) === v);
    }
  },

  schleife: function (t) {
    var self = this;
    var dt = Math.min(250, t - this.letzte);
    this.letzte = t;

    if (this.tempo > 0) {
      this.akku += dt * this.tempo;
      var schritte = 0;
      while (this.akku >= 1000 && schritte < 8) {
        this.spiel.schritt();
        this.akku -= 1000;
        schritte++;
        this.pruefeWarnungen();
      }
      if (schritte > 0) this.ui.aktualisiere();
    }

    /* Gerodete Bereiche im Gelaende-Cache nachziehen */
    while (this.spiel.gerodet.length) {
      var g = this.spiel.gerodet.shift();
      this.rend.aktualisiereBereich(g.x, g.y, g.s);
    }

    this.rend.zeichne();
    this.zeigeMeldungen();
    requestAnimationFrame(function (n) { self.schleife(n); });
  },

  letzteMeldung: 0,
  zeigeMeldungen: function () {
    var m = this.spiel.meldungen;
    while (m.length) {
      var e = m.shift();
      this.ui.toast(e.text, e.art);
      if (e.art === 'gut') this.klang('ziel');
    }
  },

  warnStand: {},
  pruefeWarnungen: function () {
    var s = this.spiel;
    if (s.tick % 25 !== 0) return;
    var nahrung = (s.lager.brot || 0) + (s.lager.fisch || 0);
    if (s.pop > 5 && nahrung < 3) this.warne('hunger', '🍞 Nahrung fehlt! Baue Bäckerei oder Fischerhütte.');
    if (s.geld < 0) this.warne('pleite', '🪙 Deine Kasse ist leer – senke den Unterhalt.');
    if (s.arbeiterFaktor < 0.8 && s.arbeiterBedarf > 0) this.warne('arbeit', '👷 Arbeitermangel – baue mehr Wohnhäuser.');
    var ohne = 0;
    for (var i = 0; i < s.geb.length; i++) if (!s.geb[i].netz && !GEB[s.geb[i].t].markt) ohne++;
    if (ohne > 0) this.warne('netz', '🚧 ' + ohne + ' Gebäude ohne Straßenanschluss.');
  },
  warne: function (id, text) {
    var jetzt = this.spiel.tick;
    if (this.warnStand[id] && jetzt - this.warnStand[id] < 120) return;
    this.warnStand[id] = jetzt;
    this.ui.toast(text, 'warn');
  },

  speichern: function () {
    try {
      localStorage.setItem(SPEICHER, JSON.stringify(this.spiel.speichern()));
    } catch (e) { /* Speicher voll oder privat */ }
  },

  /* ---------- kleine Toene ---------- */
  klang: function (art) {
    if (!this.ton) return;
    try {
      if (!this.ac) this.ac = new (window.AudioContext || window.webkitAudioContext)();
      var ac = this.ac;
      if (ac.state === 'suspended') ac.resume();
      var o = ac.createOscillator(), g = ac.createGain();
      var f = art === 'bau' ? 520 : art === 'abriss' ? 180 : art === 'ziel' ? 760 : 200;
      o.type = art === 'fehler' ? 'square' : 'triangle';
      o.frequency.setValueAtTime(f, ac.currentTime);
      if (art === 'ziel') o.frequency.linearRampToValueAtTime(1040, ac.currentTime + 0.18);
      g.gain.setValueAtTime(0.0001, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.09, ac.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.22);
      o.connect(g); g.connect(ac.destination);
      o.start(); o.stop(ac.currentTime + 0.24);
    } catch (e) { /* ohne Ton weiter */ }
  }
};

/* Autospeichern */
setInterval(function () { if (App.spiel) App.speichern(); }, 20000);

window.addEventListener('load', function () {
  App.start();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(function () { });
  }
});
