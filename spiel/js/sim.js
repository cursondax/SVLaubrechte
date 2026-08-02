/* ROMA - Simulation: Bauen, Produktion, Versorgung, Steuern */
'use strict';

var BASIS_LAGER = 300;
var ARBEITSQUOTE = 0.6;       // Anteil der Einwohner, der arbeiten kann
var TICKS_PRO_JAHR = 90;

function Spiel(seed) {
  this.welt = new Welt(seed, 60, 60);
  this.geb = [];
  this.naechsteId = 1;
  this.geld = 1000;
  this.lager = {};
  for (var i = 0; i < RES_IDS.length; i++) this.lager[RES_IDS[i]] = 0;
  this.lager.holz = 200;
  this.lager.stein = 150;
  this.lager.werkzeug = 10;
  this.tick = 0;
  this.pop = 0;
  this.zufrGesamt = 1;
  this.arbeiterFaktor = 1;
  this.arbeiterBedarf = 0;
  this.arbeiterFrei = 0;
  this.autoAufstieg = true;
  this.zieleErledigt = {};
  this.netzDirty = true;
  this.dienstDirty = true;
  this.zaehl = {};
  this.stat = { prod: {}, verb: {} };
  this.statGlatt = { prod: {}, verb: {} };
  this.meldungen = [];
  this.netzGrid = new Uint8Array(this.welt.w * this.welt.h);
  this.dienstGrid = {};
  this.bilanz = { steuern: 0, unterhalt: 0 };
  this.pleite = false;
  this.gerodet = [];            // Bereiche, deren Gelaende neu gezeichnet werden muss
}

/* ---------- Hilfen ---------- */
Spiel.prototype.kapazitaet = function () {
  var k = BASIS_LAGER;
  for (var i = 0; i < this.geb.length; i++) {
    var d = GEB[this.geb[i].t];
    if (d.lager) k += d.lager;
  }
  return k;
};

Spiel.prototype.hat = function (kosten) {
  for (var r in kosten) {
    if (r === 'denar') { if (this.geld < kosten[r]) return false; }
    else if ((this.lager[r] || 0) < kosten[r]) return false;
  }
  return true;
};

Spiel.prototype.zahle = function (kosten, faktor) {
  faktor = faktor === undefined ? 1 : faktor;
  for (var r in kosten) {
    var m = kosten[r] * faktor;
    if (r === 'denar') this.geld -= m;
    else this.lager[r] = Math.max(0, (this.lager[r] || 0) - m);
  }
};

Spiel.prototype.gutschrift = function (kosten, faktor) {
  var kap = this.kapazitaet();
  for (var r in kosten) {
    var m = kosten[r] * faktor;
    if (r === 'denar') this.geld += m;
    else this.lager[r] = Math.min(kap, (this.lager[r] || 0) + m);
  }
};

Spiel.prototype.melde = function (text, art) {
  this.meldungen.push({ text: text, art: art || 'info', t: this.tick });
  if (this.meldungen.length > 6) this.meldungen.shift();
};

/* ---------- Bauen ---------- */
Spiel.prototype.pruefePlatz = function (typ, bx, by) {
  var d = GEB[typ], w = this.welt, s = d.size;
  for (var y = by; y < by + s; y++) {
    for (var x = bx; x < bx + s; x++) {
      if (!w.drin(x, y)) return { ok: false, grund: 'Außerhalb der Karte' };
      var t = w.terr[y * w.w + x];
      if (!TERRAIN[t].bau) return { ok: false, grund: 'Untergrund: ' + TERRAIN[t].n };
      if (w.occ[y * w.w + x] >= 0) return { ok: false, grund: 'Feld ist bebaut' };
    }
  }
  if (d.boden) {
    var n = w.zaehleFelder(bx, by, s, d.boden.typ, d.boden.radius);
    if (n < d.boden.min * 0.5) {
      return { ok: false, grund: 'Zu wenig ' + d.boden.name + ' (' + n + '/' + d.boden.min + ')' };
    }
    return { ok: true, hinweis: d.boden.name + ': ' + n + '/' + d.boden.min, eff: Math.min(1, n / d.boden.min) };
  }
  return { ok: true };
};

Spiel.prototype.baue = function (typ, bx, by, gratis) {
  var d = GEB[typ];
  var p = this.pruefePlatz(typ, bx, by);
  if (!p.ok) return p;
  if (!gratis && !this.hat(d.kosten)) return { ok: false, grund: 'Nicht genug Material' };
  if (!gratis) this.zahle(d.kosten, 1);

  var g = {
    id: this.naechsteId++, t: typ, x: bx, y: by, s: d.size,
    fort: 0, eff: 0, aktiv: true, wartet: false, netz: false,
    bodenFaktor: 1, arbFaktor: 1, bemannt: true, pop: 0, zufr: 0, dienste: {}, versorgt: {}, alter: 0
  };
  if (d.haus !== undefined) { g.pop = 3; g.zufr = 0.5; }
  this.setzeBelegung(g, this.geb.length);
  this.geb.push(g);
  this.aktualisiereBoden(g);
  this.netzDirty = true;
  if (d.dienst) this.dienstDirty = true;
  return { ok: true, geb: g };
};

Spiel.prototype.setzeBelegung = function (g, index) {
  var w = this.welt, gerodet = false;
  for (var y = g.y; y < g.y + g.s; y++) {
    for (var x = g.x; x < g.x + g.s; x++) {
      w.occ[y * w.w + x] = index;
      /* Wald weicht dem Bau */
      if (w.terr[y * w.w + x] === T.WALD) { w.terr[y * w.w + x] = T.GRAS; gerodet = true; }
    }
  }
  if (gerodet) {
    this.gerodet.push({ x: g.x, y: g.y, s: g.s });
    this.alleBodenNeu();
  }
};

Spiel.prototype.neuIndizieren = function () {
  var w = this.welt;
  w.occ.fill(-1);
  for (var i = 0; i < this.geb.length; i++) {
    var g = this.geb[i];
    for (var y = g.y; y < g.y + g.s; y++) {
      for (var x = g.x; x < g.x + g.s; x++) w.occ[y * w.w + x] = i;
    }
  }
};

Spiel.prototype.abreissen = function (g) {
  var i = this.geb.indexOf(g);
  if (i < 0) return;
  this.gutschrift(GEB[g.t].kosten, 0.4);
  this.geb.splice(i, 1);
  this.neuIndizieren();
  this.netzDirty = true;
  this.dienstDirty = true;
  this.alleBodenNeu();
};

Spiel.prototype.gebaeudeAn = function (x, y) {
  var w = this.welt;
  if (!w.drin(x, y)) return null;
  var i = w.occ[y * w.w + x];
  return i >= 0 ? this.geb[i] : null;
};

Spiel.prototype.aktualisiereBoden = function (g) {
  var d = GEB[g.t];
  if (!d.boden) { g.bodenFaktor = 1; g.bodenZahl = 0; return; }
  var n = this.welt.zaehleFelder(g.x, g.y, g.s, d.boden.typ, d.boden.radius);
  g.bodenZahl = n;
  g.bodenFaktor = Math.max(0, Math.min(1, n / d.boden.min));
};

Spiel.prototype.alleBodenNeu = function () {
  for (var i = 0; i < this.geb.length; i++) this.aktualisiereBoden(this.geb[i]);
};

/* ---------- Strassennetz ---------- */
Spiel.prototype.baueNetz = function () {
  var w = this.welt, grid = this.netzGrid, i, x, y;
  grid.fill(0);
  var queue = [];
  for (i = 0; i < this.geb.length; i++) {
    var g = this.geb[i];
    if (!GEB[g.t].markt) continue;
    for (y = g.y; y < g.y + g.s; y++) {
      for (x = g.x; x < g.x + g.s; x++) { grid[y * w.w + x] = 1; queue.push(y * w.w + x); }
    }
  }
  var nb = [1, -1, w.w, -w.w];
  while (queue.length) {
    var p = queue.pop();
    var px = p % w.w;
    for (var k = 0; k < 4; k++) {
      var q = p + nb[k];
      if (q < 0 || q >= grid.length) continue;
      if (k < 2 && Math.abs((q % w.w) - px) !== 1) continue;   // Zeilenumbruch
      if (grid[q]) continue;
      var oi = w.occ[q];
      if (oi < 0 || this.geb[oi].t !== 'strasse') continue;
      grid[q] = 1; queue.push(q);
    }
  }
  for (i = 0; i < this.geb.length; i++) {
    var b = this.geb[i];
    b.netz = GEB[b.t].markt ? true : this.beruehrtNetz(b);
  }
  this.netzDirty = false;
};

Spiel.prototype.beruehrtNetz = function (g) {
  var w = this.welt, x, y;
  for (x = g.x - 1; x <= g.x + g.s; x++) {
    if (w.drin(x, g.y - 1) && this.netzGrid[(g.y - 1) * w.w + x]) return true;
    if (w.drin(x, g.y + g.s) && this.netzGrid[(g.y + g.s) * w.w + x]) return true;
  }
  for (y = g.y; y < g.y + g.s; y++) {
    if (w.drin(g.x - 1, y) && this.netzGrid[y * w.w + (g.x - 1)]) return true;
    if (w.drin(g.x + g.s, y) && this.netzGrid[y * w.w + (g.x + g.s)]) return true;
  }
  return false;
};

/* ---------- Dienste (Wasser, Therme, Tempel, Spiele) ---------- */
Spiel.prototype.baueDienste = function () {
  var w = this.welt, i, d, g;
  this.dienstGrid = {};
  for (i = 0; i < this.geb.length; i++) {
    g = this.geb[i]; d = GEB[g.t];
    if (!d.dienst || !g.aktiv) continue;
    if (d.arb && g.bemannt === false) continue;
    if (!this.dienstGrid[d.dienst.d]) this.dienstGrid[d.dienst.d] = new Uint8Array(w.w * w.h);
    var grid = this.dienstGrid[d.dienst.d];
    var mx = g.x + (g.s - 1) / 2, my = g.y + (g.s - 1) / 2, r = d.dienst.radius;
    var r0 = Math.ceil(r);
    for (var dy = -r0; dy <= r0; dy++) {
      for (var dx = -r0; dx <= r0; dx++) {
        if (Math.sqrt(dx * dx + dy * dy) > r) continue;
        var x = Math.round(mx) + dx, y = Math.round(my) + dy;
        if (w.drin(x, y)) grid[y * w.w + x] = 1;
      }
    }
  }
  this.dienstDirty = false;
};

Spiel.prototype.hatDienst = function (g, name) {
  var grid = this.dienstGrid[name];
  if (!grid) return false;
  var mx = Math.round(g.x + (g.s - 1) / 2), my = Math.round(g.y + (g.s - 1) / 2);
  return !!grid[my * this.welt.w + mx];
};

/* ---------- Ein Simulationsschritt ---------- */
Spiel.prototype.schritt = function () {
  var i, j, g, d;
  this.tick++;
  if (this.netzDirty) this.baueNetz();
  if (this.dienstDirty) this.baueDienste();

  var kap = this.kapazitaet();
  this.pleite = this.geld < 0;     // unbezahlte Arbeiter schaffen weniger
  this.stat = { prod: {}, verb: {} };
  var zaehl = {};
  for (i = 0; i < this.geb.length; i++) {
    zaehl[this.geb[i].t] = (zaehl[this.geb[i].t] || 0) + 1;
  }
  this.zaehl = zaehl;

  /* 1) Einwohner und Arbeiter */
  var pop = 0;
  for (i = 0; i < this.geb.length; i++) if (GEB[this.geb[i].t].haus !== undefined) pop += this.geb[i].pop;
  this.pop = pop;
  var arbeiterDa = Math.floor(pop * ARBEITSQUOTE);
  var bedarf = 0, betriebe = [];
  for (i = 0; i < this.geb.length; i++) {
    g = this.geb[i]; d = GEB[g.t];
    if (!d.arb) { g.arbFaktor = 1; continue; }
    if (!g.aktiv || !g.netz) { g.arbFaktor = 0; continue; }
    bedarf += d.arb;
    betriebe.push(g);
  }
  this.arbeiterBedarf = bedarf;
  this.arbeiterDa = arbeiterDa;
  this.arbeiterFrei = Math.max(0, arbeiterDa - bedarf);
  this.arbeiterFaktor = bedarf > 0 ? Math.min(1, arbeiterDa / bedarf) : 1;

  /* Arbeiter nach Wichtigkeit verteilen: erst Nahrung, dann Baustoffe,
     dann oeffentliche Bauten, zuletzt Luxus und Bergbau. So bricht bei
     Arbeitermangel nicht die ganze Stadt zusammen. */
  betriebe.sort(function (a, b) {
    return (GEB[a.t].prio || 9) - (GEB[b.t].prio || 9) || a.id - b.id;
  });
  var rest = arbeiterDa;
  for (i = 0; i < betriebe.length; i++) {
    g = betriebe[i];
    var noetig = GEB[g.t].arb;
    var zugeteilt = Math.min(noetig, rest);
    rest -= zugeteilt;
    g.arbFaktor = noetig > 0 ? zugeteilt / noetig : 1;
    /* Dienstgebaeude wirken nur mit halber Besetzung aufwaerts */
    if (GEB[g.t].dienst) {
      var bemannt = g.arbFaktor >= 0.5;
      if (bemannt !== g.bemannt) { g.bemannt = bemannt; this.dienstDirty = true; }
    }
  }
  if (this.dienstDirty) this.baueDienste();

  /* 2) Produktion */
  for (i = 0; i < this.geb.length; i++) {
    g = this.geb[i]; d = GEB[g.t];
    if (!d.prod) continue;
    if (!g.aktiv || !g.netz) { g.eff = 0; g.wartet = false; continue; }

    var eff = (g.arbFaktor === undefined ? 1 : g.arbFaktor) * (d.boden ? g.bodenFaktor : 1) * (this.pleite ? 0.65 : 1);
    if (eff <= 0) { g.eff = 0; continue; }

    /* Zyklusbeginn: Eingangswaren verbrauchen */
    if (g.fort === 0 && d.prod.ein) {
      var ok = true;
      for (var r in d.prod.ein) if ((this.lager[r] || 0) < d.prod.ein[r]) { ok = false; break; }
      if (!ok) { g.wartet = true; g.eff = 0; continue; }
      for (var r2 in d.prod.ein) {
        this.lager[r2] -= d.prod.ein[r2];
        this.stat.verb[r2] = (this.stat.verb[r2] || 0) + d.prod.ein[r2];
      }
    }
    /* Lager voll? Dann pausiert der Betrieb */
    var voll = false;
    for (var ro in d.prod.aus) if ((this.lager[ro] || 0) >= kap) { voll = true; break; }
    if (voll) { g.wartet = true; g.eff = 0; continue; }

    g.wartet = false;
    g.eff = eff;
    g.fort += eff;
    if (g.fort >= d.prod.zeit) {
      g.fort = 0;
      for (var ra in d.prod.aus) {
        var menge = d.prod.aus[ra];
        this.lager[ra] = Math.min(kap, (this.lager[ra] || 0) + menge);
        this.stat.prod[ra] = (this.stat.prod[ra] || 0) + menge;
      }
    }
  }

  /* 3) Bedarf der Haushalte sammeln */
  var bedarfWaren = {};
  var haeuser = [];
  for (i = 0; i < this.geb.length; i++) {
    g = this.geb[i]; d = GEB[g.t];
    if (d.haus === undefined) continue;
    haeuser.push(g);
    if (!g.netz) continue;
    var st = STUFEN[d.haus];
    for (j = 0; j < st.waren.length; j++) {
      var b = st.waren[j];
      var m = b.pro * g.pop;
      bedarfWaren[b.r] = (bedarfWaren[b.r] || 0) + m;
    }
  }

  /* 4) Verteilung: Deckungsgrad je Ware */
  var deckung = {};
  for (var wr in bedarfWaren) {
    var need = bedarfWaren[wr];
    if (need <= 0) { deckung[wr] = 1; continue; }
    if (wr === 'nahrung') {
      var vorrat = 0, n2;
      for (n2 = 0; n2 < NAHRUNG.length; n2++) vorrat += this.lager[NAHRUNG[n2]] || 0;
      var nimm = Math.min(need, vorrat);
      deckung.nahrung = nimm / need;
      /* gleichmaessig aus den Nahrungsmitteln entnehmen */
      var rest = nimm;
      for (n2 = 0; n2 < NAHRUNG.length && rest > 1e-9; n2++) {
        var k = NAHRUNG[n2];
        var teil = vorrat > 0 ? Math.min(this.lager[k], (this.lager[k] / vorrat) * nimm) : 0;
        teil = Math.min(teil, rest);
        this.lager[k] -= teil; rest -= teil;
        this.stat.verb[k] = (this.stat.verb[k] || 0) + teil;
      }
    } else {
      var da = this.lager[wr] || 0;
      var take = Math.min(need, da);
      this.lager[wr] = da - take;
      this.stat.verb[wr] = (this.stat.verb[wr] || 0) + take;
      deckung[wr] = take / need;
    }
  }

  /* 5) Zufriedenheit, Wachstum, Aufstieg */
  var steuern = 0, zufrSum = 0, zufrGew = 0;
  for (i = 0; i < haeuser.length; i++) {
    g = haeuser[i]; d = GEB[g.t];
    var stufe = STUFEN[d.haus];
    var punkte = 0, maxPunkte = 0;
    g.versorgt = {};
    for (j = 0; j < stufe.waren.length; j++) {
      var bw = stufe.waren[j];
      var dk = g.netz ? (deckung[bw.r] === undefined ? 0 : deckung[bw.r]) : 0;
      g.versorgt[bw.r] = dk;
      punkte += dk * bw.w; maxPunkte += bw.w;
    }
    for (j = 0; j < stufe.dienste.length; j++) {
      var ds = stufe.dienste[j];
      var ok2 = this.hatDienst(g, ds.d);
      g.dienste[ds.d] = ok2;
      punkte += (ok2 ? 1 : 0) * ds.w; maxPunkte += ds.w;
    }
    var ziel = maxPunkte > 0 ? punkte / maxPunkte : 1;
    if (!g.netz) ziel = 0;
    g.zufr += (ziel - g.zufr) * 0.08;

    /* Wachstum - ein angeschlossenes Haus behaelt immer eine Grundbelegung */
    var grund = g.netz ? 3 : 0;
    var zielPop = Math.max(grund, stufe.maxPop * Math.max(0, Math.min(1, (g.zufr - 0.2) / 0.7)));
    g.pop += (zielPop - g.pop) * 0.02;

    steuern += g.pop * stufe.steuer * (0.3 + 0.7 * g.zufr);
    zufrSum += g.zufr * g.pop; zufrGew += g.pop;

    /* Aufstieg */
    if (this.autoAufstieg && d.haus < 2 && g.pop >= stufe.maxPop * 0.92 && g.zufr > 0.82) {
      var nnaechst = d.haus === 0 ? 'insula' : 'domus';
      var kosten = GEB[nnaechst].kosten;
      if (this.hat(kosten)) {
        this.zahle(kosten, 1);
        g.t = nnaechst;
        this.melde('Aufstieg: ' + GEB[nnaechst].n + ' errichtet!', 'gut');
      }
    }
  }
  this.zufrGesamt = zufrGew > 0 ? zufrSum / zufrGew : 1;

  /* 6) Finanzen */
  var unterhalt = 0;
  for (i = 0; i < this.geb.length; i++) {
    d = GEB[this.geb[i].t];
    if (d.unterh) unterhalt += this.geb[i].aktiv ? d.unterh : d.unterh * 0.25;
  }
  this.bilanz.steuern = steuern;
  this.bilanz.unterhalt = unterhalt;
  this.geld += steuern - unterhalt;

  /* 7) geglaettete Statistik */
  var glatt = function (ziel, quelle) {
    for (var k in quelle) ziel[k] = (ziel[k] || 0) * 0.9 + quelle[k] * 0.1;
    for (var k2 in ziel) if (quelle[k2] === undefined) ziel[k2] *= 0.9;
  };
  glatt(this.statGlatt.prod, this.stat.prod);
  glatt(this.statGlatt.verb, this.stat.verb);

  /* 8) Meilensteine */
  for (i = 0; i < ZIELE.length; i++) {
    var z = ZIELE[i];
    if (this.zieleErledigt[z.id]) continue;
    if (z.pruef(this)) {
      this.zieleErledigt[z.id] = true;
      this.geld += z.lohn;
      this.melde('Meilenstein „' + z.n + '“ erreicht (+' + z.lohn + ' 🪙)', 'gut');
    }
  }
};

Spiel.prototype.jahr = function () { return 1 + Math.floor(this.tick / TICKS_PRO_JAHR); };

/* ---------- Speichern / Laden ---------- */
Spiel.prototype.speichern = function () {
  var geb = this.geb.map(function (g) {
    return [g.t, g.x, g.y, Math.round(g.pop * 100) / 100, Math.round(g.zufr * 1000) / 1000, g.aktiv ? 1 : 0, Math.round(g.fort * 100) / 100];
  });
  return {
    v: 1, seed: this.welt.seed, tick: this.tick, geld: Math.round(this.geld * 100) / 100,
    lager: this.lager, geb: geb, ziele: this.zieleErledigt, autoAufstieg: this.autoAufstieg
  };
};

Spiel.laden = function (daten) {
  var s = new Spiel(daten.seed);
  s.tick = daten.tick || 0;
  s.geld = daten.geld || 0;
  s.autoAufstieg = daten.autoAufstieg !== false;
  s.zieleErledigt = daten.ziele || {};
  for (var r in daten.lager) if (s.lager[r] !== undefined) s.lager[r] = daten.lager[r];
  for (var i = 0; i < daten.geb.length; i++) {
    var e = daten.geb[i];
    var res = s.baue(e[0], e[1], e[2], true);
    if (res.ok) {
      res.geb.pop = e[3]; res.geb.zufr = e[4];
      res.geb.aktiv = e[5] !== 0; res.geb.fort = e[6] || 0;
    }
  }
  s.alleBodenNeu();
  s.netzDirty = true; s.dienstDirty = true;
  return s;
};
