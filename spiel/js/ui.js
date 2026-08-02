/* ROMA - Oberflaeche, Touch-Steuerung, Panels */
'use strict';

function el(id) { return document.getElementById(id); }
function zahl(n, k) { return Number(n).toLocaleString('de-DE', { maximumFractionDigits: k === undefined ? 0 : k }); }

function UI(spiel, rend, app) {
  this.s = spiel;
  this.r = rend;
  this.app = app;
  this.kat = 'infra';
  this.abrissModus = false;
  this.zeiger = {};          // aktive Pointer
  this.geste = null;
  this.tippStart = null;
  this.malen = false;
  this.baueLeiste();
  this.baueTopbar();
  this.bindeEreignisse();
  this.hilfeWennNeu();
}

/* ---------- Aufbau der Leisten ---------- */
UI.prototype.baueTopbar = function () {
  var waren = ['denar', 'holz', 'stein', 'ziegel', 'werkzeug', 'brot', 'marmor'];
  var h = '';
  for (var i = 0; i < waren.length; i++) {
    var r = waren[i];
    var def = r === 'denar' ? RES.denar : RES[r];
    h += '<div class="chip" data-res="' + r + '" title="' + def.n + '"><span class="ci">' + def.i +
      '</span><span class="cv" id="res-' + r + '">0</span></div>';
  }
  el('waren').innerHTML = h;
};

UI.prototype.baueLeiste = function () {
  var self = this, h = '', i;
  for (i = 0; i < KATEGORIEN.length; i++) {
    var k = KATEGORIEN[i];
    h += '<button class="kat' + (k.id === this.kat ? ' an' : '') + '" data-kat="' + k.id + '">' +
      '<span>' + k.icon + '</span>' + k.n + '</button>';
  }
  h += '<button class="kat abriss" id="btn-abriss"><span>🗑️</span>Abriss</button>';
  el('kats').innerHTML = h;
  el('kats').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'btn-abriss') { self.setzeAbriss(!self.abrissModus); return; }
    self.setzeAbriss(false);
    self.kat = b.dataset.kat;
    self.baueLeiste();
    self.zeigeGebaeude();
  });
  this.zeigeGebaeude();
};

UI.prototype.zeigeGebaeude = function () {
  var self = this, h = '', k;
  for (k in GEB) {
    var d = GEB[k];
    if (d.cat !== this.kat || d.versteckt) continue;
    var kosten = '';
    for (var r in d.kosten) {
      kosten += '<span>' + (r === 'denar' ? RES.denar.i : RES[r].i) + ' ' + d.kosten[r] + '</span>';
    }
    h += '<button class="gebbtn" data-typ="' + k + '">' +
      '<div class="gi">' + d.icon + '<span class="gs">' + d.size + '×' + d.size + '</span></div>' +
      '<div class="gn">' + d.n + '</div>' +
      '<div class="gk">' + kosten + '</div>' +
      '</button>';
  }
  el('gebliste').innerHTML = h;
  el('gebliste').scrollLeft = 0;
  el('gebliste').onclick = function (e) {
    var b = e.target.closest('.gebbtn');
    if (!b) return;
    self.waehleBau(b.dataset.typ);
  };
};

UI.prototype.waehleBau = function (typ) {
  this.setzeAbriss(false);
  if (this.r.bauTyp === typ) { this.beendeBau(); return; }
  this.r.bauTyp = typ;
  this.r.auswahl = null;
  this.r.zeigeRadius = null;
  el('info').classList.add('weg');
  var d = GEB[typ];
  el('bauhinweis').classList.remove('weg');
  el('bh-name').textContent = d.icon + ' ' + d.n;
  el('bh-text').textContent = d.beschr;
  this.markiereAktiv();
};

UI.prototype.beendeBau = function () {
  this.r.bauTyp = null;
  this.r.bauFeld = null;
  el('bauhinweis').classList.add('weg');
  this.markiereAktiv();
};

UI.prototype.setzeAbriss = function (an) {
  this.abrissModus = an;
  if (an) { this.beendeBau(); }
  el('btn-abriss').classList.toggle('an', an);
  document.body.classList.toggle('abriss-an', an);
};

UI.prototype.markiereAktiv = function () {
  var btns = el('gebliste').querySelectorAll('.gebbtn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('an', btns[i].dataset.typ === this.r.bauTyp);
  }
};

/* ---------- Eingabe ---------- */
UI.prototype.bindeEreignisse = function () {
  var self = this, cv = this.r.cv;

  cv.addEventListener('pointerdown', function (e) { self.pDown(e); });
  cv.addEventListener('pointermove', function (e) { self.pMove(e); });
  cv.addEventListener('pointerup', function (e) { self.pUp(e); });
  cv.addEventListener('pointercancel', function (e) { self.pUp(e); });
  cv.addEventListener('wheel', function (e) {
    e.preventDefault();
    self.zoomeUm(Math.pow(0.999, e.deltaY), e.clientX, e.clientY);
  }, { passive: false });

  /* Doppeltipp-Zoom verhindern */
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

  el('bh-abbruch').onclick = function () { self.beendeBau(); };
  el('info-zu').onclick = function () { self.waehleGebaeude(null); };

  el('speed').onclick = function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    self.app.setzeTempo(parseFloat(b.dataset.v));
  };

  el('btn-menu').onclick = function () { self.menue(); };
  el('btn-stat').onclick = function () { self.statistik(); };
  el('btn-ziele').onclick = function () { self.zieleZeigen(); };
  el('modal-zu').onclick = function () { el('modal').classList.add('weg'); };
  el('modal').addEventListener('click', function (e) {
    if (e.target === el('modal')) el('modal').classList.add('weg');
  });
  el('waren').onclick = function () { self.lagerZeigen(); };

  window.addEventListener('resize', function () {
    self.r.anpassen();
  });
};

UI.prototype.zoomeUm = function (f, sx, sy) {
  var r = this.r;
  var vor = r.bildschirmZuWelt(sx, sy);
  r.kam.zoom = Math.max(0.35, Math.min(2.2, r.kam.zoom * f));
  var nach = r.bildschirmZuWelt(sx, sy);
  r.kam.x += vor.x - nach.x;
  r.kam.y += vor.y - nach.y;
};

UI.prototype.feldUnter = function (sx, sy) {
  var w = this.r.bildschirmZuWelt(sx, sy);
  return this.r.weltZuFeld(w.x, w.y);
};

UI.prototype.pDown = function (e) {
  this.r.cv.setPointerCapture(e.pointerId);
  this.zeiger[e.pointerId] = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: Date.now(), bewegt: 0 };
  var ids = Object.keys(this.zeiger);

  if (ids.length === 2) {
    var a = this.zeiger[ids[0]], b = this.zeiger[ids[1]];
    this.geste = {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2
    };
    this.malen = false;
  } else if (ids.length === 1) {
    /* Strassen malen */
    if (this.r.bauTyp === 'strasse') {
      this.malen = true;
      var f = this.feldUnter(e.clientX, e.clientY);
      this.baueAn(f.x, f.y, true);
    } else if (this.r.bauTyp) {
      var f2 = this.feldUnter(e.clientX, e.clientY);
      this.r.bauFeld = this.zentriertesFeld(f2, GEB[this.r.bauTyp].size);
    }
  }
};

UI.prototype.zentriertesFeld = function (f, size) {
  var o = Math.floor((size - 1) / 2);
  return { x: f.x - o, y: f.y - o };
};

UI.prototype.pMove = function (e) {
  var p = this.zeiger[e.pointerId];
  if (!p) {
    if (this.r.bauTyp && e.pointerType === 'mouse') {
      var fm = this.feldUnter(e.clientX, e.clientY);
      this.r.bauFeld = this.zentriertesFeld(fm, GEB[this.r.bauTyp].size);
    }
    return;
  }
  var dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.bewegt += Math.abs(dx) + Math.abs(dy);
  p.x = e.clientX; p.y = e.clientY;

  var ids = Object.keys(this.zeiger);
  if (ids.length >= 2 && this.geste) {
    var a = this.zeiger[ids[0]], b = this.zeiger[ids[1]];
    var dist = Math.hypot(a.x - b.x, a.y - b.y);
    var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if (this.geste.dist > 0) this.zoomeUm(dist / this.geste.dist, mx, my);
    this.r.kam.x -= (mx - this.geste.mx) / this.r.kam.zoom;
    this.r.kam.y -= (my - this.geste.my) / this.r.kam.zoom;
    this.geste = { dist: dist, mx: mx, my: my };
    return;
  }

  if (this.malen) {
    var f = this.feldUnter(e.clientX, e.clientY);
    this.baueAn(f.x, f.y, true);
    return;
  }
  if (this.r.bauTyp) {
    var f3 = this.feldUnter(e.clientX, e.clientY);
    this.r.bauFeld = this.zentriertesFeld(f3, GEB[this.r.bauTyp].size);
  }
  /* Karte schieben */
  this.r.kam.x -= dx / this.r.kam.zoom;
  this.r.kam.y -= dy / this.r.kam.zoom;
};

UI.prototype.pUp = function (e) {
  var p = this.zeiger[e.pointerId];
  delete this.zeiger[e.pointerId];
  if (Object.keys(this.zeiger).length < 2) this.geste = null;
  if (!p) return;
  var dauer = Date.now() - p.t;
  var tipp = p.bewegt < 12 && dauer < 500;
  if (this.malen) { this.malen = Object.keys(this.zeiger).length > 0 ? this.malen : false; return; }
  if (!tipp) return;

  var f = this.feldUnter(e.clientX, e.clientY);
  if (this.r.bauTyp) {
    var o = this.zentriertesFeld(f, GEB[this.r.bauTyp].size);
    this.baueAn(o.x, o.y, false);
    return;
  }
  var g = this.s.gebaeudeAn(f.x, f.y);
  if (this.abrissModus) {
    if (g) {
      this.s.abreissen(g);
      this.app.klang('abriss');
      this.waehleGebaeude(null);
    }
    return;
  }
  this.waehleGebaeude(g);
};

UI.prototype.baueAn = function (x, y, still) {
  var typ = this.r.bauTyp;
  if (!typ) return;
  if (!this.s.welt.drin(x, y)) return;
  var res = this.s.baue(typ, x, y, false);
  if (res.ok) {
    this.app.klang('bau');
    this.aktualisiere();
  } else if (!still) {
    this.toast(res.grund, 'warn');
    this.app.klang('fehler');
  }
};

/* ---------- Auswahl-Panel ---------- */
UI.prototype.waehleGebaeude = function (g) {
  this.r.auswahl = g;
  this.r.zeigeRadius = g;
  var p = el('info');
  if (!g) { p.classList.add('weg'); return; }
  p.classList.remove('weg');
  this.zeichneInfo();
};

UI.prototype.zeichneInfo = function () {
  var g = this.r.auswahl;
  if (!g) return;
  var d = GEB[g.t], s = this.s, h = '';

  el('info-titel').innerHTML = '<span class="ii">' + d.icon + '</span>' + d.n;

  if (!g.netz && !d.markt) {
    h += '<div class="warn">🚧 Kein Straßenanschluss zum Forum – keine Lieferung!</div>';
  }

  if (d.haus !== undefined) {
    var st = STUFEN[d.haus];
    h += '<div class="zeile"><span>Stufe</span><b>' + st.icon + ' ' + st.name + '</b></div>';
    h += '<div class="zeile"><span>Einwohner</span><b>' + Math.round(g.pop) + ' / ' + st.maxPop + '</b></div>';
    h += '<div class="zeile"><span>Zufriedenheit</span><b>' + Math.round(g.zufr * 100) + ' %</b></div>';
    h += '<div class="balken"><i style="width:' + Math.round(Math.max(0, Math.min(1, g.zufr)) * 100) + '%"></i></div>';
    h += '<h4>Bedarf</h4>';
    for (var i = 0; i < st.waren.length; i++) {
      var b = st.waren[i];
      var dk = Math.round((g.versorgt[b.r] || 0) * 100);
      var nam = b.r === 'nahrung' ? '🍞 Nahrung' : RES[b.r].i + ' ' + RES[b.r].n;
      h += '<div class="zeile"><span>' + nam + '</span><b class="' + (dk > 80 ? 'gut' : dk > 30 ? 'mittel' : 'schlecht') + '">' + dk + ' %</b></div>';
    }
    for (var j = 0; j < st.dienste.length; j++) {
      var ds = st.dienste[j];
      var ok = g.dienste[ds.d];
      h += '<div class="zeile"><span>' + (ds.d === 'wasser' ? '⛲' : ds.d === 'unterhaltung' ? '♨️' : ds.d === 'glaube' ? '🏛️' : '🎭') +
        ' ' + ds.name + '</span><b class="' + (ok ? 'gut' : 'schlecht') + '">' + (ok ? 'ja' : 'fehlt') + '</b></div>';
    }
    if (d.haus < 2) {
      var nx = d.haus === 0 ? 'insula' : 'domus';
      var kt = '';
      for (var r2 in GEB[nx].kosten) kt += (r2 === 'denar' ? RES.denar.i : RES[r2].i) + ' ' + GEB[nx].kosten[r2] + ' ';
      h += '<h4>Aufstieg zu ' + GEB[nx].n + '</h4><div class="hint">Voraussetzung: Haus voll belegt, Zufriedenheit über 82 %.<br>Kosten: ' + kt + '</div>';
    }
  }

  if (d.prod) {
    h += '<h4>Produktion</h4>';
    var ein = '';
    for (var re in (d.prod.ein || {})) ein += RES[re].i + ' ' + d.prod.ein[re] + ' ';
    var aus = '';
    for (var ra in d.prod.aus) aus += RES[ra].i + ' ' + d.prod.aus[ra] + ' ';
    h += '<div class="zeile"><span>Kette</span><b>' + (ein ? ein + '→ ' : '') + aus + '</b></div>';
    h += '<div class="zeile"><span>Zyklus</span><b>' + d.prod.zeit + ' s</b></div>';
    h += '<div class="zeile"><span>Auslastung</span><b class="' + (g.eff > 0.7 ? 'gut' : g.eff > 0.2 ? 'mittel' : 'schlecht') + '">' + Math.round(g.eff * 100) + ' %</b></div>';
    if (g.wartet) h += '<div class="warn">⚠️ Wartet auf Rohstoffe oder das Lager ist voll.</div>';
  }
  if (d.boden) {
    h += '<div class="zeile"><span>' + d.boden.name + '</span><b class="' + (g.bodenFaktor > 0.85 ? 'gut' : g.bodenFaktor > 0.5 ? 'mittel' : 'schlecht') + '">' +
      g.bodenZahl + ' / ' + d.boden.min + '</b></div>';
  }
  if (d.arb) {
    var bes = Math.round((g.arbFaktor === undefined ? 1 : g.arbFaktor) * d.arb);
    h += '<div class="zeile"><span>Arbeiter</span><b class="' + (bes >= d.arb ? 'gut' : bes > 0 ? 'mittel' : 'schlecht') + '">' +
      bes + ' / ' + d.arb + '</b></div>';
    if (bes < d.arb) h += '<div class="warn">👷 Arbeitermangel – baue mehr Wohnhäuser.</div>';
  }
  if (d.dienst) {
    h += '<div class="zeile"><span>Reichweite</span><b>' + d.dienst.radius + ' Felder</b></div>';
  }
  if (d.lager) h += '<div class="zeile"><span>Lagerplatz</span><b>+' + d.lager + '</b></div>';
  if (d.unterh) h += '<div class="zeile"><span>Unterhalt</span><b>' + zahl(d.unterh * 60, 0) + ' 🪙/min</b></div>';

  h += '<div class="btnreihe">';
  if (d.prod || d.dienst) h += '<button class="kbtn" id="b-pause">' + (g.aktiv ? '⏸️ Stilllegen' : '▶️ Anschalten') + '</button>';
  h += '<button class="kbtn rot" id="b-abriss">🗑️ Abreißen</button></div>';

  el('info-inhalt').innerHTML = h;

  var self = this;
  var bp = el('b-pause');
  if (bp) bp.onclick = function () {
    g.aktiv = !g.aktiv;
    self.s.dienstDirty = true;
    self.zeichneInfo();
  };
  el('b-abriss').onclick = function () {
    self.s.abreissen(g);
    self.app.klang('abriss');
    self.waehleGebaeude(null);
  };
};

/* ---------- HUD ---------- */
UI.prototype.aktualisiere = function () {
  var s = this.s, kap = s.kapazitaet();
  var waren = ['denar', 'holz', 'stein', 'ziegel', 'werkzeug', 'brot', 'marmor'];
  for (var i = 0; i < waren.length; i++) {
    var r = waren[i];
    var e = el('res-' + r);
    if (!e) continue;
    if (r === 'denar') {
      e.textContent = zahl(s.geld);
      e.className = 'cv' + (s.geld < 0 ? ' schlecht' : '');
    } else {
      var v = s.lager[r] || 0;
      e.textContent = zahl(v);
      e.className = 'cv' + (v >= kap ? ' voll' : '');
    }
  }
  el('pop').textContent = zahl(s.pop);
  el('zufr').textContent = Math.round(s.zufrGesamt * 100) + ' %';
  var ae = el('arbeiter');
  ae.textContent = zahl(s.arbeiterDa || 0) + '/' + zahl(s.arbeiterBedarf);
  ae.className = s.arbeiterFaktor < 0.95 ? 'schlecht' : '';
  el('datum').textContent = 'Jahr ' + s.jahr() + ' a.u.c.';
  document.body.classList.toggle('pleite', !!s.pleite);
  var bil = s.bilanz.steuern - s.bilanz.unterhalt;
  var be = el('bilanz');
  be.textContent = (bil >= 0 ? '+' : '') + zahl(bil * 60, 0) + ' 🪙/min';
  be.className = bil >= 0 ? 'gut' : 'schlecht';
  if (this.r.auswahl) this.zeichneInfo();
};

UI.prototype.toast = function (text, art) {
  var d = document.createElement('div');
  d.className = 'toast ' + (art || 'info');
  d.textContent = text;
  el('toasts').appendChild(d);
  setTimeout(function () { d.classList.add('aus'); }, 2600);
  setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 3200);
};

/* ---------- Modale Fenster ---------- */
UI.prototype.modal = function (titel, inhalt) {
  el('modal-titel').innerHTML = titel;
  el('modal-inhalt').innerHTML = inhalt;
  el('modal').classList.remove('weg');
};

UI.prototype.lagerZeigen = function () {
  var s = this.s, kap = s.kapazitaet(), h = '<div class="lagerliste">';
  for (var i = 0; i < RES_IDS.length; i++) {
    var r = RES_IDS[i], v = s.lager[r] || 0;
    var pr = (s.statGlatt.prod[r] || 0) * 60, vb = (s.statGlatt.verb[r] || 0) * 60;
    var saldo = pr - vb;
    h += '<div class="lagerzeile"><span class="lz-n">' + RES[r].i + ' ' + RES[r].n + '</span>' +
      '<span class="lz-v">' + zahl(v) + ' / ' + zahl(kap) + '</span>' +
      '<span class="lz-s ' + (saldo >= 0 ? 'gut' : 'schlecht') + '">' + (saldo >= 0 ? '+' : '') + zahl(saldo, 1) + '/min</span></div>';
  }
  h += '</div>';
  this.modal('📦 Lager & Bilanz', h);
};

UI.prototype.statistik = function () {
  var s = this.s;
  var h = '<div class="statgrid">';
  h += '<div class="statbox"><span>Einwohner</span><b>' + zahl(s.pop) + '</b></div>';
  var st = [0, 0, 0];
  for (var i = 0; i < s.geb.length; i++) {
    var d = GEB[s.geb[i].t];
    if (d.haus !== undefined) st[d.haus] += s.geb[i].pop;
  }
  h += '<div class="statbox"><span>🛖 Plebejer</span><b>' + zahl(st[0]) + '</b></div>';
  h += '<div class="statbox"><span>🏘️ Bürger</span><b>' + zahl(st[1]) + '</b></div>';
  h += '<div class="statbox"><span>🏛️ Patrizier</span><b>' + zahl(st[2]) + '</b></div>';
  h += '<div class="statbox"><span>Zufriedenheit</span><b>' + Math.round(s.zufrGesamt * 100) + ' %</b></div>';
  h += '<div class="statbox"><span>Arbeiter frei</span><b>' + zahl(s.arbeiterFrei) + '</b></div>';
  h += '<div class="statbox"><span>Arbeitsplätze</span><b>' + zahl(s.arbeiterBedarf) + '</b></div>';
  h += '<div class="statbox"><span>Gebäude</span><b>' + zahl(s.geb.length) + '</b></div>';
  h += '<div class="statbox"><span>Steuern</span><b class="gut">+' + zahl(s.bilanz.steuern * 60, 0) + '/min</b></div>';
  h += '<div class="statbox"><span>Unterhalt</span><b class="schlecht">−' + zahl(s.bilanz.unterhalt * 60, 0) + '/min</b></div>';
  h += '</div>';

  h += '<h4>Warenbilanz je Minute</h4><div class="lagerliste">';
  for (var j = 0; j < RES_IDS.length; j++) {
    var r = RES_IDS[j];
    var pr = (s.statGlatt.prod[r] || 0) * 60, vb = (s.statGlatt.verb[r] || 0) * 60;
    if (pr < 0.05 && vb < 0.05 && (s.lager[r] || 0) < 1) continue;
    var saldo = pr - vb;
    h += '<div class="lagerzeile"><span class="lz-n">' + RES[r].i + ' ' + RES[r].n + '</span>' +
      '<span class="lz-v">+' + zahl(pr, 1) + ' / −' + zahl(vb, 1) + '</span>' +
      '<span class="lz-s ' + (saldo >= 0 ? 'gut' : 'schlecht') + '">' + (saldo >= 0 ? '+' : '') + zahl(saldo, 1) + '</span></div>';
  }
  h += '</div>';
  this.modal('📊 Statistik', h);
};

UI.prototype.zieleZeigen = function () {
  var s = this.s, h = '<div class="ziele">';
  for (var i = 0; i < ZIELE.length; i++) {
    var z = ZIELE[i], f = !!s.zieleErledigt[z.id];
    h += '<div class="ziel' + (f ? ' fertig' : '') + '"><div class="zh">' + (f ? '✅' : '⬜') + ' ' + z.n +
      '<span class="zl">+' + z.lohn + ' 🪙</span></div><div class="zb">' + z.b + '</div></div>';
  }
  h += '</div>';
  this.modal('🎯 Meilensteine', h);
};

UI.prototype.menue = function () {
  var self = this;
  var h = '<div class="menue">' +
    '<button class="mbtn" id="m-hilfe">📖 Spielanleitung</button>' +
    '<button class="mbtn" id="m-speichern">💾 Jetzt speichern</button>' +
    '<button class="mbtn" id="m-auto">' + (this.s.autoAufstieg ? '⬆️ Auto-Aufstieg: an' : '⬆️ Auto-Aufstieg: aus') + '</button>' +
    '<button class="mbtn" id="m-ton">' + (this.app.ton ? '🔊 Ton: an' : '🔇 Ton: aus') + '</button>' +
    '<button class="mbtn rot" id="m-neu">🗺️ Neue Insel (Spielstand geht verloren)</button>' +
    '</div><div class="hint">Version 1.0 · Alles läuft offline auf deinem iPad. Der Spielstand liegt lokal im Browser.</div>';
  this.modal('☰ Menü', h);
  el('m-hilfe').onclick = function () { self.hilfe(); };
  el('m-speichern').onclick = function () { self.app.speichern(); self.toast('Gespeichert', 'gut'); el('modal').classList.add('weg'); };
  el('m-auto').onclick = function () { self.s.autoAufstieg = !self.s.autoAufstieg; self.menue(); };
  el('m-ton').onclick = function () { self.app.ton = !self.app.ton; self.menue(); };
  el('m-neu').onclick = function () {
    if (confirm('Wirklich eine neue Insel starten? Der aktuelle Spielstand wird gelöscht.')) self.app.neuesSpiel();
  };
};

UI.prototype.hilfe = function () {
  var h =
    '<div class="hilfe">' +
    '<p><b>Ziel:</b> Baue aus einer Siedlung am Mittelmeer eine römische Stadt. Deine Einwohner steigen von Plebejern über Bürger zu Patriziern auf – je besser du sie versorgst.</p>' +
    '<h4>Steuerung</h4>' +
    '<ul>' +
    '<li><b>Ziehen</b> mit einem Finger: Karte verschieben</li>' +
    '<li><b>Zwei Finger</b>: zoomen und schieben</li>' +
    '<li><b>Tippen</b>: Gebäude auswählen oder (im Baumodus) setzen</li>' +
    '<li><b>Straßen</b>: im Straßen-Modus mit dem Finger über die Karte ziehen</li>' +
    '</ul>' +
    '<h4>Die wichtigsten Regeln</h4>' +
    '<ul>' +
    '<li>🛣️ <b>Jedes Gebäude braucht eine Straßenverbindung zum Forum.</b> Ohne Anschluss wird nichts geliefert (Symbol 🚧).</li>' +
    '<li>👷 Betriebe brauchen <b>Arbeiter</b>. Arbeiter kommen aus Wohnhäusern (55 % der Einwohner).</li>' +
    '<li>🌾 Rohstoffbetriebe brauchen passende <b>Vorkommen</b> in Reichweite – Wald, Fels, Lehm, Erz, Marmor, fruchtbaren Boden oder Wasser.</li>' +
    '<li>⛲ Wohnhäuser brauchen Wasser, Nahrung und – je nach Stufe – Kleidung, Wein, Öl, Therme, Tempel und Amphitheater.</li>' +
    '<li>📦 Das Lager ist begrenzt. Lagerhäuser erhöhen die Kapazität.</li>' +
    '</ul>' +
    '<h4>Empfohlener Start</h4>' +
    '<ol>' +
    '<li>Straßen vom Forum aus verlegen</li>' +
    '<li>Holzfällerhütte am Wald, Steinbruch am Fels</li>' +
    '<li>3–4 Plebejer-Hütten und einen Brunnen daneben</li>' +
    '<li>Getreidefarm → Mühle → Bäckerei für Brot</li>' +
    '<li>Lehmgrube → Ziegelei, dann Insula-Aufstieg</li>' +
    '</ol>' +
    '</div>';
  this.modal('📖 Spielanleitung', h);
};

UI.prototype.hilfeWennNeu = function () {
  if (!localStorage.getItem('roma-hilfe-gesehen')) {
    localStorage.setItem('roma-hilfe-gesehen', '1');
    var self = this;
    setTimeout(function () { self.hilfe(); }, 400);
  }
};
