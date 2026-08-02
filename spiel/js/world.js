/* ROMA - Weltgenerierung, Zufall, Isometrie-Mathematik */
'use strict';

/* ---------- deterministischer Zufall ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------- Value-Noise mit Oktaven ---------- */
function makeNoise(rand) {
  var G = 256, grid = new Float32Array(G * G), i;
  for (i = 0; i < grid.length; i++) grid[i] = rand();
  function smooth(t) { return t * t * (3 - 2 * t); }
  function raw(x, y) {
    var x0 = Math.floor(x), y0 = Math.floor(y);
    var fx = smooth(x - x0), fy = smooth(y - y0);
    var a = grid[((y0 & 255) * G) + (x0 & 255)];
    var b = grid[((y0 & 255) * G) + ((x0 + 1) & 255)];
    var c = grid[(((y0 + 1) & 255) * G) + (x0 & 255)];
    var d = grid[(((y0 + 1) & 255) * G) + ((x0 + 1) & 255)];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }
  return function (x, y, okt, skala) {
    var sum = 0, amp = 1, max = 0, f = skala, o;
    for (o = 0; o < okt; o++) {
      sum += raw(x * f, y * f) * amp;
      max += amp; amp *= 0.5; f *= 2;
    }
    return sum / max;
  };
}

/* ---------- Isometrie ---------- */
var TW = 64, TH = 32;               // Kachelbreite / -hoehe bei Zoom 1

function isoX(x, y) { return (x - y) * (TW / 2); }
function isoY(x, y) { return (x + y) * (TH / 2); }

/* Bildschirm -> Kachel (ohne Kamera; Aufrufer rechnet Kamera heraus) */
function weltZuKachel(wx, wy) {
  return {
    x: Math.floor((wy / TH) + (wx / TW)),
    y: Math.floor((wy / TH) - (wx / TW))
  };
}

/* ---------- Welt ---------- */
function Welt(seed, w, h) {
  this.seed = seed >>> 0;
  this.w = w; this.h = h;
  this.terr = new Uint8Array(w * h);
  this.deko = new Uint8Array(w * h);   // Zufallswert fuer Baeume/Steine/Farbvariation
  this.occ = new Int32Array(w * h).fill(-1);
  this.generiere();
}

Welt.prototype.idx = function (x, y) { return y * this.w + x; };
Welt.prototype.drin = function (x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; };
Welt.prototype.typ = function (x, y) { return this.drin(x, y) ? this.terr[y * this.w + x] : T.WASSER; };

/* Schwelle, unterhalb derer ein Anteil der Werte liegt (Quantil) */
function quantil(werte, anteil) {
  var kopie = Array.prototype.slice.call(werte).sort(function (a, b) { return a - b; });
  var i = Math.max(0, Math.min(kopie.length - 1, Math.floor(anteil * kopie.length)));
  return kopie[i];
}

/* Anteile der Kartenflaeche - so sind alle Inseln aehnlich gut bespielbar */
var ANTEIL_LAND = 0.48;
var ANTEIL_STRAND = 0.09;   // Anteil des Landes
var ANTEIL_BERG = 0.07;     // Anteil des Landes
var ANTEIL_WALD = 0.28;     // Anteil des uebrigen Landes
var ANTEIL_ACKER = 0.30;

Welt.prototype.generiere = function () {
  var rand = mulberry32(this.seed);
  var noise = makeNoise(rand);
  var w = this.w, h = this.h, cx = (w - 1) / 2, cy = (h - 1) / 2;
  var x, y, i;

  /* Hoehenfeld: Noise minus radialer Abfall ergibt eine Insel */
  var hoehe = new Float32Array(w * h);
  for (y = 0; y < h; y++) {
    for (x = 0; x < w; x++) {
      i = y * w + x;
      var dx = (x - cx) / (w / 2), dy = (y - cy) / (h / 2);
      var d = Math.sqrt(dx * dx + dy * dy);
      hoehe[i] = noise(x, y, 4, 0.055) * 1.3 - Math.pow(d, 2.4) * 0.9;
      this.deko[i] = Math.floor(rand() * 256);
    }
  }

  /* Schwellen aus Quantilen: jede Karte hat aehnlich viel Land, Strand und Gebirge */
  var sLand = quantil(hoehe, 1 - ANTEIL_LAND);
  var landWerte = [];
  for (i = 0; i < hoehe.length; i++) if (hoehe[i] >= sLand) landWerte.push(hoehe[i]);
  var sStrand = quantil(landWerte, ANTEIL_STRAND);
  var sBerg = quantil(landWerte, 1 - ANTEIL_BERG);

  for (i = 0; i < hoehe.length; i++) {
    if (hoehe[i] < sLand) this.terr[i] = T.WASSER;
    else if (hoehe[i] < sStrand) this.terr[i] = T.STRAND;
    else if (hoehe[i] >= sBerg) this.terr[i] = T.BERG;
    else this.terr[i] = T.GRAS;
  }

  /* Winzige Inselchen dem Meer zurueckgeben, damit die Karte spielbar bleibt */
  this.entferneKleineInseln(40);

  /* Wald und fruchtbarer Boden, ebenfalls quantilbasiert */
  var nWald = makeNoise(mulberry32(this.seed ^ 0x9e3779b9));
  var nAcker = makeNoise(mulberry32(this.seed ^ 0x51ed270b));
  var wWerte = [], aWerte = [], wFeld = new Float32Array(w * h), aFeld = new Float32Array(w * h);
  for (y = 0; y < h; y++) {
    for (x = 0; x < w; x++) {
      i = y * w + x;
      if (this.terr[i] !== T.GRAS) continue;
      wFeld[i] = nWald(x, y, 3, 0.09);
      aFeld[i] = nAcker(x, y, 3, 0.075);
      wWerte.push(wFeld[i]); aWerte.push(aFeld[i]);
    }
  }
  var sWald = quantil(wWerte, 1 - ANTEIL_WALD);
  var sAcker = quantil(aWerte, 1 - ANTEIL_ACKER);
  for (i = 0; i < this.terr.length; i++) {
    if (this.terr[i] !== T.GRAS) continue;
    if (wFeld[i] >= sWald) this.terr[i] = T.WALD;
    else if (aFeld[i] >= sAcker) this.terr[i] = T.FRUCHTBAR;
  }

  /* Vorkommen als Cluster verteilen */
  this.streueVorkommen(rand, T.FELS, 5, 16, 30, false);
  this.streueVorkommen(rand, T.LEHM, 4, 10, 22, false);
  this.streueVorkommen(rand, T.ERZ, 3, 8, 16, true);
  this.streueVorkommen(rand, T.MARMOR, 2, 7, 14, true);

  this.startFeld = this.findeStartplatz();
};

/* Setzt n Cluster eines Vorkommens; bergNah -> bevorzugt am Gebirge */
Welt.prototype.streueVorkommen = function (rand, typ, anzahl, minGr, maxGr, bergNah) {
  var w = this.w, h = this.h, versuche = 0, gesetzt = 0;
  while (gesetzt < anzahl && versuche < 4000) {
    versuche++;
    var x = 2 + Math.floor(rand() * (w - 4));
    var y = 2 + Math.floor(rand() * (h - 4));
    var t = this.terr[y * w + x];
    if (t !== T.GRAS && t !== T.WALD && t !== T.FRUCHTBAR) continue;
    if (bergNah && !this.nahBei(x, y, T.BERG, 4)) continue;

    var groesse = minGr + Math.floor(rand() * (maxGr - minGr));
    var offen = [[x, y]], k = 0;
    while (k < groesse && offen.length) {
      var p = offen.splice(Math.floor(rand() * offen.length), 1)[0];
      var pi = p[1] * w + p[0];
      var pt = this.terr[pi];
      if (pt !== T.GRAS && pt !== T.WALD && pt !== T.FRUCHTBAR) continue;
      this.terr[pi] = typ; k++;
      var nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (var j = 0; j < nb.length; j++) {
        var nx = p[0] + nb[j][0], ny = p[1] + nb[j][1];
        if (this.drin(nx, ny)) offen.push([nx, ny]);
      }
    }
    if (k > 0) gesetzt++;
  }
};

/* Landflaechen unter minGroesse werden zu Wasser */
Welt.prototype.entferneKleineInseln = function (minGroesse) {
  var w = this.w, h = this.h, gesehen = new Uint8Array(w * h), i;
  for (i = 0; i < this.terr.length; i++) {
    if (gesehen[i] || this.terr[i] === T.WASSER) continue;
    var stapel = [i], teile = [];
    gesehen[i] = 1;
    while (stapel.length) {
      var p = stapel.pop();
      teile.push(p);
      var px = p % w, py = (p - px) / w;
      var nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (var k = 0; k < 4; k++) {
        var nx = px + nb[k][0], ny = py + nb[k][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        var q = ny * w + nx;
        if (gesehen[q] || this.terr[q] === T.WASSER) continue;
        gesehen[q] = 1; stapel.push(q);
      }
    }
    if (teile.length < minGroesse) {
      for (var j = 0; j < teile.length; j++) this.terr[teile[j]] = T.WASSER;
    }
  }
};

Welt.prototype.nahBei = function (x, y, typ, r) {
  for (var dy = -r; dy <= r; dy++) {
    for (var dx = -r; dx <= r; dx++) {
      if (this.typ(x + dx, y + dy) === typ) return true;
    }
  }
  return false;
};

/* Zaehlt Felder bestimmter Typen im Umkreis eines Gebaeudes */
Welt.prototype.zaehleFelder = function (bx, by, size, typen, radius) {
  var mx = bx + (size - 1) / 2, my = by + (size - 1) / 2;
  var r = Math.ceil(radius), n = 0;
  for (var dy = -r; dy <= r; dy++) {
    for (var dx = -r; dx <= r; dx++) {
      var x = Math.round(mx) + dx, y = Math.round(my) + dy;
      if (!this.drin(x, y)) continue;
      if (Math.sqrt(dx * dx + dy * dy) > radius) continue;
      if (typen.indexOf(this.terr[y * this.w + x]) >= 0) n++;
    }
  }
  return n;
};

/* Guter Startplatz: viel freie Baulaeche, dazu Wald, Acker, Fels und Kueste in Reichweite */
Welt.prototype.findeStartplatz = function () {
  var w = this.w, h = this.h, best = null, bestWert = -1;
  var gew = {};
  gew[T.GRAS] = 1.0; gew[T.STRAND] = 0.5; gew[T.FRUCHTBAR] = 1.6; gew[T.WALD] = 1.4;
  gew[T.FELS] = 1.8; gew[T.LEHM] = 1.1; gew[T.ERZ] = 0.7; gew[T.MARMOR] = 0.7;
  gew[T.WASSER] = 0.15; gew[T.BERG] = -0.6;
  var R = 11;

  for (var y = 3; y < h - 9; y += 2) {
    for (var x = 3; x < w - 9; x += 2) {
      if (!this.flaecheFrei(x, y, 7)) continue;
      var wert = 0, offen = 0;
      for (var dy = -R; dy <= R; dy++) {
        for (var dx = -R; dx <= R; dx++) {
          if (dx * dx + dy * dy > R * R) continue;
          var tx = x + 1 + dx, ty = y + 1 + dy;
          if (!this.drin(tx, ty)) { wert -= 0.4; continue; }
          var t = this.terr[ty * this.w + tx];
          wert += gew[t] || 0;
          if (t === T.GRAS || t === T.FRUCHTBAR || t === T.WALD || t === T.STRAND) offen++;
        }
      }
      /* Ohne genug offene Bauflaeche taugt der Platz nicht */
      if (offen < 130) continue;
      if (wert > bestWert) { bestWert = wert; best = { x: x, y: y }; }
    }
  }
  if (best) return best;

  /* Rueckfall: irgendein freier Platz */
  for (var y2 = 2; y2 < h - 8; y2++) {
    for (var x2 = 2; x2 < w - 8; x2++) if (this.flaecheFrei(x2, y2, 5)) return { x: x2, y: y2 };
  }
  return { x: Math.floor(w / 2), y: Math.floor(h / 2) };
};

Welt.prototype.flaecheFrei = function (bx, by, size) {
  for (var y = by; y < by + size; y++) {
    for (var x = bx; x < bx + size; x++) {
      if (!this.drin(x, y)) return false;
      var t = this.terr[y * this.w + x];
      if (!TERRAIN[t].bau) return false;
      if (this.occ[y * this.w + x] >= 0) return false;
    }
  }
  return true;
};
