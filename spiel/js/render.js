/* ROMA - Isometrisches Zeichnen */
'use strict';

function Renderer(canvas, spiel) {
  this.cv = canvas;
  this.ctx = canvas.getContext('2d');
  this.spiel = spiel;
  this.kam = { x: 0, y: 0, zoom: 1 };
  this.dpr = Math.min(window.devicePixelRatio || 1, 2);
  this.offX = (spiel.welt.h + 1) * (TW / 2);
  this.cacheBreite = (spiel.welt.w + spiel.welt.h + 2) * (TW / 2);
  this.cacheHoehe = (spiel.welt.w + spiel.welt.h + 2) * (TH / 2) + 64;
  this.terrainCache = null;
  this.zeigeRadius = null;      // Gebaeude, dessen Reichweite gezeigt wird
  this.bauTyp = null;           // aktiver Bau-Typ (Vorschau)
  this.bauFeld = null;          // { x, y } Vorschau-Position
  this.auswahl = null;
  this.zeigeNetz = false;
  this.baueTerrain();
  this.anpassen();
}

Renderer.prototype.anpassen = function () {
  var b = this.cv.clientWidth, h = this.cv.clientHeight;
  this.cv.width = Math.round(b * this.dpr);
  this.cv.height = Math.round(h * this.dpr);
  this.breite = b; this.hoehe = h;
};

/* Kachel-Eckpunkt in Weltpixeln */
Renderer.prototype.px = function (x, y) {
  return { x: (x - y) * (TW / 2) + this.offX, y: (x + y) * (TH / 2) };
};

Renderer.prototype.weltZuFeld = function (wx, wy) {
  var u = (wx - this.offX) / (TW / 2);
  var v = (wy - TH / 2) / (TH / 2);
  return { x: Math.floor((u + v) / 2), y: Math.floor((v - u) / 2) };
};

Renderer.prototype.bildschirmZuWelt = function (sx, sy) {
  return {
    x: (sx - this.breite / 2) / this.kam.zoom + this.kam.x,
    y: (sy - this.hoehe / 2) / this.kam.zoom + this.kam.y
  };
};

Renderer.prototype.zentriereAuf = function (fx, fy) {
  var p = this.px(fx, fy);
  this.kam.x = p.x; this.kam.y = p.y;
};

/* ---------- Gelaende in Offscreen-Canvas vorrendern ---------- */
Renderer.prototype.baueTerrain = function () {
  var w = this.spiel.welt;
  var cv = document.createElement('canvas');
  cv.width = this.cacheBreite; cv.height = this.cacheHoehe;
  var c = cv.getContext('2d');
  c.fillStyle = '#24587a';
  c.fillRect(0, 0, cv.width, cv.height);

  var d, x, y;
  for (d = 0; d <= w.w + w.h - 2; d++) {
    for (x = Math.max(0, d - w.h + 1); x <= Math.min(w.w - 1, d); x++) {
      y = d - x;
      this.zeichneFeld(c, x, y);
    }
  }
  this.terrainCache = cv;
  this.terrainDirty = false;
};

/* Nur einen Ausschnitt des Gelaende-Caches neu zeichnen (z. B. nach Rodung) */
Renderer.prototype.aktualisiereBereich = function (bx, by, s) {
  if (!this.terrainCache) return;
  var w = this.spiel.welt, pad = 4;
  var x0 = Math.max(0, bx - pad), y0 = Math.max(0, by - pad);
  var x1 = Math.min(w.w - 1, bx + s - 1 + pad), y1 = Math.min(w.h - 1, by + s - 1 + pad);
  var minX = this.px(x0, y1).x - TW / 2 - 2;
  var maxX = this.px(x1, y0).x + TW / 2 + 2;
  var minY = this.px(x0, y0).y - 48;
  var maxY = this.px(x1, y1).y + TH + 12;

  var c = this.terrainCache.getContext('2d');
  c.save();
  c.beginPath();
  c.rect(minX, minY, maxX - minX, maxY - minY);
  c.clip();
  c.fillStyle = '#24587a';
  c.fillRect(minX, minY, maxX - minX, maxY - minY);
  for (var d = x0 + y0; d <= x1 + y1; d++) {
    for (var x = Math.max(x0, d - y1); x <= Math.min(x1, d - y0); x++) {
      this.zeichneFeld(c, x, d - x);
    }
  }
  c.restore();
};

Renderer.prototype.zeichneFeld = function (c, x, y) {
  var w = this.spiel.welt, i = y * w.w + x;
  var t = w.terr[i], deko = w.deko[i], def = TERRAIN[t];
  var p = this.px(x, y);
  var X = p.x, Y = p.y;

  var hoch = (t === T.BERG) ? 16 + (deko % 12) : 0;
  var basis = Y - hoch;

  if (hoch > 0) {
    /* Bergflanken */
    c.fillStyle = '#5b5751';
    c.beginPath();
    c.moveTo(X - TW / 2, basis + TH / 2); c.lineTo(X, basis + TH);
    c.lineTo(X, Y + TH); c.lineTo(X - TW / 2, Y + TH / 2);
    c.closePath(); c.fill();
    c.fillStyle = '#4b4842';
    c.beginPath();
    c.moveTo(X, basis + TH); c.lineTo(X + TW / 2, basis + TH / 2);
    c.lineTo(X + TW / 2, Y + TH / 2); c.lineTo(X, Y + TH);
    c.closePath(); c.fill();
  }

  c.fillStyle = (deko % 2) ? def.c : def.c2;
  c.beginPath();
  c.moveTo(X, basis);
  c.lineTo(X + TW / 2, basis + TH / 2);
  c.lineTo(X, basis + TH);
  c.lineTo(X - TW / 2, basis + TH / 2);
  c.closePath();
  c.fill();

  /* Dekoration je Untergrund */
  if (t === T.WALD) this.baum(c, X, basis + TH / 2, deko);
  else if (t === T.FELS) this.brocken(c, X, basis + TH / 2, deko, '#c2c2c8', '#84848c');
  else if (t === T.MARMOR) this.brocken(c, X, basis + TH / 2, deko, '#ffffff', '#b8bfc9');
  else if (t === T.ERZ) this.brocken(c, X, basis + TH / 2, deko, '#8a8f9c', '#4f545e');
  else if (t === T.LEHM) {
    c.fillStyle = 'rgba(90,50,25,.35)';
    c.beginPath(); c.ellipse(X, basis + TH / 2, 12, 6, 0, 0, 6.2832); c.fill();
  } else if (t === T.FRUCHTBAR) {
    c.strokeStyle = 'rgba(80,110,40,.45)'; c.lineWidth = 1;
    for (var k = -1; k <= 1; k++) {
      c.beginPath();
      c.moveTo(X - TW / 2 + 8, basis + TH / 2 + k * 6);
      c.lineTo(X + TW / 2 - 8, basis + TH / 2 + k * 6);
      c.stroke();
    }
  } else if (t === T.WASSER) {
    if (deko % 7 === 0) {
      c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(X - 10, basis + TH / 2); c.lineTo(X + 10, basis + TH / 2); c.stroke();
    }
  } else if (t === T.GRAS && deko % 11 === 0) {
    c.fillStyle = 'rgba(255,255,255,.10)';
    c.beginPath(); c.ellipse(X, basis + TH / 2, 9, 4, 0, 0, 6.2832); c.fill();
  }
};

Renderer.prototype.baum = function (c, X, Y, deko) {
  var n = 2 + (deko % 2), i;
  for (i = 0; i < n; i++) {
    var ox = ((deko >> (i * 2)) % 5 - 2) * 8;
    var oy = ((deko >> (i * 3)) % 3 - 1) * 5;
    var hh = 16 + ((deko >> i) % 6);
    c.fillStyle = '#4a3521';
    c.fillRect(X + ox - 1.5, Y + oy - hh * 0.45, 3, hh * 0.5);
    c.fillStyle = i % 2 ? '#2f6b34' : '#37773a';
    c.beginPath();
    c.ellipse(X + ox, Y + oy - hh * 0.62, 8, 9, 0, 0, 6.2832);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,.10)';
    c.beginPath();
    c.ellipse(X + ox - 2.5, Y + oy - hh * 0.72, 3.5, 4, 0, 0, 6.2832);
    c.fill();
  }
};

Renderer.prototype.brocken = function (c, X, Y, deko, hell, dunkel) {
  var n = 2 + (deko % 3);
  for (var i = 0; i < n; i++) {
    var ox = ((deko >> (i * 2)) % 5 - 2) * 9;
    var oy = ((deko >> (i * 3)) % 3 - 1) * 5;
    var s = 5 + ((deko >> i) % 5);
    c.fillStyle = dunkel;
    c.beginPath();
    c.moveTo(X + ox - s, Y + oy); c.lineTo(X + ox, Y + oy + s * 0.55);
    c.lineTo(X + ox + s, Y + oy); c.lineTo(X + ox, Y + oy - s * 0.75);
    c.closePath(); c.fill();
    c.fillStyle = hell;
    c.beginPath();
    c.moveTo(X + ox - s, Y + oy); c.lineTo(X + ox, Y + oy - s * 0.75);
    c.lineTo(X + ox, Y + oy + s * 0.1);
    c.closePath(); c.fill();
  }
};

/* ---------- Hauptbild ---------- */
Renderer.prototype.zeichne = function () {
  var ctx = this.ctx, s = this.spiel, z = this.kam.zoom;
  ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  ctx.fillStyle = '#1b4560';
  ctx.fillRect(0, 0, this.breite, this.hoehe);

  ctx.save();
  ctx.translate(this.breite / 2, this.hoehe / 2);
  ctx.scale(z, z);
  ctx.translate(-this.kam.x, -this.kam.y);

  if (this.terrainDirty) this.baueTerrain();
  ctx.imageSmoothingEnabled = z < 1;
  ctx.drawImage(this.terrainCache, 0, 0);

  /* Sichtbarer Weltausschnitt fuer Culling */
  var m = 200;
  var links = this.kam.x - this.breite / (2 * z) - m;
  var rechts = this.kam.x + this.breite / (2 * z) + m;
  var oben = this.kam.y - this.hoehe / (2 * z) - m;
  var unten = this.kam.y + this.hoehe / (2 * z) + m;

  /* Reichweiten-Overlay */
  if (this.zeigeRadius) this.radiusOverlay(ctx, this.zeigeRadius);
  if (this.bauTyp && this.bauFeld && GEB[this.bauTyp].dienst) {
    this.radiusOverlayFeld(ctx, this.bauFeld.x, this.bauFeld.y, GEB[this.bauTyp].size, GEB[this.bauTyp].dienst.radius, 'rgba(120,200,255,.16)');
  }
  if (this.bauTyp && this.bauFeld && GEB[this.bauTyp].boden) {
    this.radiusOverlayFeld(ctx, this.bauFeld.x, this.bauFeld.y, GEB[this.bauTyp].size, GEB[this.bauTyp].boden.radius, 'rgba(255,230,140,.14)');
  }

  /* Gebaeude in Tiefensortierung */
  var liste = s.geb.slice().sort(function (a, b) {
    return (a.x + a.y + a.s) - (b.x + b.y + b.s) || a.x - b.x;
  });
  for (var i = 0; i < liste.length; i++) {
    var g = liste[i];
    var p = this.px(g.x, g.y);
    if (p.x + 200 < links || p.x - 200 > rechts || p.y + 260 < oben || p.y - 120 > unten) continue;
    this.zeichneGebaeude(ctx, g, z);
  }

  /* Bauvorschau */
  if (this.bauTyp && this.bauFeld) this.zeichneVorschau(ctx);

  ctx.restore();
};

Renderer.prototype.mitte = function (x, y, s) {
  return {
    x: (x - y) * (TW / 2) + this.offX,
    y: (x + y + s - 1) * (TH / 2) + TH / 2
  };
};

Renderer.prototype.diamant = function (ctx, cx, cy, hw, hh) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
};

Renderer.prototype.zeichneGebaeude = function (ctx, g, z) {
  var d = GEB[g.t], s = g.s;
  var m = this.mitte(g.x, g.y, s);
  var hw = s * TW / 2, hh = s * TH / 2;
  var hoehe = d.hoehe || 0;
  var gewaehlt = this.auswahl === g;

  /* Schatten */
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  this.diamant(ctx, m.x + 4, m.y + 3, hw * 0.92, hh * 0.92);
  ctx.fill();

  if (d.flach || hoehe === 0) {
    ctx.fillStyle = d.wand;
    this.diamant(ctx, m.x, m.y, hw * 0.98, hh * 0.98);
    ctx.fill();
    if (g.t === 'strasse') {
      ctx.strokeStyle = 'rgba(60,48,34,.45)'; ctx.lineWidth = 1.5;
      this.diamant(ctx, m.x, m.y, hw * 0.98, hh * 0.98); ctx.stroke();
      ctx.fillStyle = 'rgba(255,248,230,.35)';
      ctx.beginPath();
      ctx.ellipse(m.x, m.y, 4, 2, 0, 0, 6.2832);
      ctx.fill();
    }
  } else {
    /* Grundflaeche */
    ctx.fillStyle = '#8e8067';
    this.diamant(ctx, m.x, m.y, hw, hh);
    ctx.fill();

    var oben = m.y - hoehe;
    /* linke Wand */
    ctx.fillStyle = this.dunkler(d.wand, 0.72);
    ctx.beginPath();
    ctx.moveTo(m.x - hw, m.y); ctx.lineTo(m.x, m.y + hh);
    ctx.lineTo(m.x, oben + hh); ctx.lineTo(m.x - hw, oben);
    ctx.closePath(); ctx.fill();
    /* rechte Wand */
    ctx.fillStyle = this.dunkler(d.wand, 0.88);
    ctx.beginPath();
    ctx.moveTo(m.x, m.y + hh); ctx.lineTo(m.x + hw, m.y);
    ctx.lineTo(m.x + hw, oben); ctx.lineTo(m.x, oben + hh);
    ctx.closePath(); ctx.fill();
    /* Dach */
    ctx.fillStyle = d.dach;
    this.diamant(ctx, m.x, oben, hw, hh);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 1;
    this.diamant(ctx, m.x, oben, hw, hh); ctx.stroke();

    /* Dachfirst-Andeutung */
    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    ctx.beginPath();
    ctx.moveTo(m.x - hw * 0.5, oben - hh * 0.5 + hh * 0.5);
    ctx.lineTo(m.x + hw * 0.5, oben + hh * 0.5 - hh * 0.5);
    ctx.stroke();

    /* Symbol */
    if (z > 0.55) {
      ctx.font = Math.round(Math.min(30, 13 + s * 5)) + 'px system-ui, "Apple Color Emoji", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(d.icon, m.x, oben + 1);
    }
  }

  /* Statusanzeigen */
  if (z > 0.5) this.status(ctx, g, m, hoehe, hh);

  if (gewaehlt) {
    ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 2.5;
    this.diamant(ctx, m.x, m.y, hw, hh); ctx.stroke();
  }
};

Renderer.prototype.status = function (ctx, g, m, hoehe, hh) {
  var d = GEB[g.t];
  var y = m.y - hoehe - hh - 8;

  if (!g.netz && !d.markt) {
    ctx.font = '16px system-ui, "Apple Color Emoji", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🚧', m.x, y - 6);
    return;
  }
  if (d.prod) {
    if (!g.aktiv) {
      ctx.font = '15px system-ui, "Apple Color Emoji", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('⏸️', m.x, y - 6); return;
    }
    if (g.wartet) {
      ctx.font = '15px system-ui, "Apple Color Emoji", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('⚠️', m.x, y - 6); return;
    }
    var br = 26, ho = 5;
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(m.x - br / 2, y - ho, br, ho);
    ctx.fillStyle = '#8fd25a';
    ctx.fillRect(m.x - br / 2, y - ho, br * Math.min(1, g.fort / d.prod.zeit), ho);
  } else if (d.haus !== undefined) {
    var f = g.zufr;
    var farbe = f > 0.75 ? '#8fd25a' : (f > 0.45 ? '#f0c14b' : '#e2603f');
    var b2 = 24;
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(m.x - b2 / 2, y - 5, b2, 5);
    ctx.fillStyle = farbe;
    ctx.fillRect(m.x - b2 / 2, y - 5, b2 * Math.max(0, Math.min(1, f)), 5);
  }
};

Renderer.prototype.radiusOverlay = function (ctx, g) {
  var d = GEB[g.t];
  var r = d.dienst ? d.dienst.radius : (d.boden ? d.boden.radius : (d.markt ? 0 : 0));
  if (!r) return;
  var farbe = d.dienst ? 'rgba(120,200,255,.16)' : 'rgba(255,230,140,.14)';
  this.radiusOverlayFeld(ctx, g.x, g.y, g.s, r, farbe);
};

Renderer.prototype.radiusOverlayFeld = function (ctx, x, y, s, r, farbe) {
  var m = this.mitte(x, y, s);
  ctx.save();
  ctx.fillStyle = farbe;
  ctx.strokeStyle = farbe.replace(/[\d.]+\)$/, '.55)');
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(m.x, m.y - (s - 1) * TH / 2 + (s - 1) * TH / 2, r * TW / 2, r * TH / 2, 0, 0, 6.2832);
  ctx.fill(); ctx.stroke();
  ctx.restore();
};

Renderer.prototype.zeichneVorschau = function (ctx) {
  var typ = this.bauTyp, f = this.bauFeld, d = GEB[typ];
  var pruef = this.spiel.pruefePlatz(typ, f.x, f.y);
  var m = this.mitte(f.x, f.y, d.size);
  var hw = d.size * TW / 2, hh = d.size * TH / 2;

  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = pruef.ok ? 'rgba(120,220,120,.45)' : 'rgba(230,90,70,.5)';
  this.diamant(ctx, m.x, m.y, hw, hh);
  ctx.fill();
  ctx.strokeStyle = pruef.ok ? '#8fe08f' : '#ff8b74';
  ctx.lineWidth = 2;
  this.diamant(ctx, m.x, m.y, hw, hh);
  ctx.stroke();

  if (!d.flach && d.hoehe) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = d.dach;
    this.diamant(ctx, m.x, m.y - d.hoehe, hw, hh);
    ctx.fill();
  }
  ctx.restore();
  this.letztePruefung = pruef;
};

Renderer.prototype.dunkler = function (hex, f) {
  var r = parseInt(hex.substr(1, 2), 16), g = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
  r = Math.round(r * f); g = Math.round(g * f); b = Math.round(b * f);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
};
