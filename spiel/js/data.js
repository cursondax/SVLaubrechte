/* ROMA - Daten: Waren, Gelaende, Gebaeude
   Alle Werte sind pro Tick (1 Tick = 1 Sekunde bei Geschwindigkeit 1x). */
'use strict';

/* ---------- Waren ---------- */
const RES = {
  denar:    { n: 'Denare',     i: '🪙', c: '#d4a017', roh: false },
  holz:     { n: 'Holz',       i: '🪵', c: '#8b5a2b', roh: true },
  stein:    { n: 'Stein',      i: '🪨', c: '#8d8d94', roh: true },
  lehm:     { n: 'Lehm',       i: '🟤', c: '#a4643c', roh: true },
  ziegel:   { n: 'Ziegel',     i: '🧱', c: '#b5462f', roh: false },
  marmor:   { n: 'Marmor',     i: '🏛️', c: '#dfe3ea', roh: true },
  eisenerz: { n: 'Eisenerz',   i: '⛏️', c: '#6b6f7a', roh: true },
  werkzeug: { n: 'Werkzeug',   i: '🔨', c: '#94724a', roh: false },
  getreide: { n: 'Getreide',   i: '🌾', c: '#d8b45a', roh: true },
  mehl:     { n: 'Mehl',       i: '🥣', c: '#e6dcc3', roh: false },
  brot:     { n: 'Brot',       i: '🍞', c: '#c58a3c', roh: false },
  fisch:    { n: 'Fisch',      i: '🐟', c: '#6aa6c8', roh: true },
  oliven:   { n: 'Oliven',     i: '🫒', c: '#6f7a3a', roh: true },
  oel:      { n: 'Olivenöl',   i: '🏺', c: '#c9a227', roh: false },
  trauben:  { n: 'Trauben',    i: '🍇', c: '#7b4397', roh: true },
  wein:     { n: 'Wein',       i: '🍷', c: '#8e2b3f', roh: false },
  wolle:    { n: 'Wolle',      i: '🐑', c: '#e3e0d8', roh: true },
  kleidung: { n: 'Kleidung',   i: '👘', c: '#b26fa0', roh: false }
};
const RES_IDS = Object.keys(RES).filter(function (k) { return k !== 'denar'; });

/* ---------- Gelaende ---------- */
const T = { WASSER: 0, STRAND: 1, GRAS: 2, FRUCHTBAR: 3, WALD: 4, FELS: 5, LEHM: 6, ERZ: 7, MARMOR: 8, BERG: 9 };

const TERRAIN = [
  { id: T.WASSER,    n: 'Wasser',        c: '#2f6f96', c2: '#3b81aa', bau: false },
  { id: T.STRAND,    n: 'Sand',          c: '#ddc98f', c2: '#e6d5a3', bau: true },
  { id: T.GRAS,      n: 'Wiese',         c: '#6d9a4e', c2: '#79a857', bau: true },
  { id: T.FRUCHTBAR, n: 'Fruchtbarer Boden', c: '#87a63f', c2: '#95b449', bau: true },
  { id: T.WALD,      n: 'Wald',          c: '#4d7a3c', c2: '#568644', bau: true },
  { id: T.FELS,      n: 'Steinvorkommen', c: '#9a9a9f', c2: '#a9a9af', bau: false },
  { id: T.LEHM,      n: 'Lehmvorkommen',  c: '#a4643c', c2: '#b47049', bau: false },
  { id: T.ERZ,       n: 'Eisenvorkommen', c: '#77787f', c2: '#84858d', bau: false },
  { id: T.MARMOR,    n: 'Marmorvorkommen', c: '#d6dae2', c2: '#e2e6ed', bau: false },
  { id: T.BERG,      n: 'Gebirge',       c: '#6f6b66', c2: '#7d7974', bau: false }
];

/* ---------- Beduerfnisse der Wohnstufen ---------- */
const STUFEN = [
  {
    id: 0, name: 'Plebejer', icon: '🛖', maxPop: 8, steuer: 0.095,
    waren: [{ r: 'nahrung', pro: 0.0045, w: 3 }],
    dienste: [{ d: 'wasser', name: 'Wasser', w: 2 }]
  },
  {
    id: 1, name: 'Bürger', icon: '🏘️', maxPop: 18, steuer: 0.17,
    waren: [
      { r: 'nahrung', pro: 0.0055, w: 3 },
      { r: 'kleidung', pro: 0.0016, w: 2 },
      { r: 'wein', pro: 0.0014, w: 2 }
    ],
    dienste: [
      { d: 'wasser', name: 'Wasser', w: 2 },
      { d: 'unterhaltung', name: 'Therme', w: 1.5 }
    ]
  },
  {
    id: 2, name: 'Patrizier', icon: '🏛️', maxPop: 30, steuer: 0.32,
    waren: [
      { r: 'nahrung', pro: 0.0060, w: 3 },
      { r: 'kleidung', pro: 0.0020, w: 2 },
      { r: 'wein', pro: 0.0026, w: 2 },
      { r: 'oel', pro: 0.0022, w: 2 }
    ],
    dienste: [
      { d: 'wasser', name: 'Wasser', w: 2 },
      { d: 'unterhaltung', name: 'Therme', w: 1.5 },
      { d: 'glaube', name: 'Tempel', w: 1.5 },
      { d: 'spiele', name: 'Amphitheater', w: 1.5 }
    ]
  }
];

/* Nahrung kann aus mehreren Waren gedeckt werden */
const NAHRUNG = ['brot', 'fisch'];

/* ---------- Gebaeude ----------
   size:    Kantenlaenge (quadratisch)
   kosten:  Baukosten
   unterh:  Unterhalt in Denaren pro Tick
   arb:     benoetigte Arbeiter
   prod:    { ein:{}, aus:{}, zeit: Ticks }
   boden:   { typ:[...], radius:n, min:n, name:'' }  Vorkommen in Reichweite
   dienst:  { d:'wasser', radius:n }
   lager:   zusaetzliche Lagerkapazitaet
   markt:   true  -> Startpunkt des Strassennetzes
*/
const GEB = {
  /* --- Wohnen --- */
  huette: {
    n: 'Plebejer-Hütte', cat: 'wohnen', size: 2, icon: '🛖',
    wand: '#c8ab7c', dach: '#8a5a3b', hoehe: 20,
    kosten: { holz: 15 }, unterh: 0, haus: 0,
    beschr: 'Einfache Kate. Zieht Plebejer an, sobald Wasser und Nahrung verfügbar sind.'
  },
  insula: {
    n: 'Insula', cat: 'wohnen', size: 2, icon: '🏘️',
    wand: '#d9c39a', dach: '#a5462f', hoehe: 34, versteckt: true,
    kosten: { holz: 20, ziegel: 15 }, unterh: 0, haus: 1,
    beschr: 'Mehrstöckiges Mietshaus der Bürger. Entsteht durch Aufstieg einer Hütte.'
  },
  domus: {
    n: 'Domus', cat: 'wohnen', size: 2, icon: '🏛️',
    wand: '#efe7d6', dach: '#b5462f', hoehe: 40, versteckt: true,
    kosten: { ziegel: 30, marmor: 10, werkzeug: 5 }, unterh: 0, haus: 2,
    beschr: 'Stadthaus der Patrizier. Entsteht durch Aufstieg einer Insula.'
  },

  /* --- Infrastruktur --- */
  strasse: {
    n: 'Straße', cat: 'infra', size: 1, icon: '🛣️',
    wand: '#a99b80', dach: '#a99b80', hoehe: 0, flach: true,
    kosten: { stein: 1 }, unterh: 0.002,
    beschr: 'Verbindet Gebäude mit dem Forum. Ohne Anschluss wird nichts geliefert.'
  },
  forum: {
    n: 'Forum Romanum', cat: 'infra', size: 3, icon: '⚖️', prio: 3,
    wand: '#efe7d6', dach: '#c0713a', hoehe: 30, markt: true,
    kosten: { holz: 50, stein: 40, denar: 200 }, unterh: 0.4, arb: 4, lager: 200,
    beschr: 'Herz der Stadt. Alle Straßen führen von hier aus zu deinen Betrieben.'
  },
  lager: {
    n: 'Lagerhaus', cat: 'infra', size: 2, icon: '📦', prio: 3,
    wand: '#c9b48c', dach: '#7a5236', hoehe: 26,
    kosten: { holz: 30, stein: 20 }, unterh: 0.4, arb: 2, lager: 400,
    beschr: 'Erhöht die Lagerkapazität für jede Ware um 400.'
  },
  brunnen: {
    n: 'Brunnen', cat: 'infra', size: 1, icon: '⛲', hoehe: 12,
    wand: '#b9b2a4', dach: '#8ea9bd',
    kosten: { holz: 5, stein: 15 }, unterh: 0.2,
    dienst: { d: 'wasser', radius: 9 },
    beschr: 'Versorgt alle Wohnhäuser im Umkreis mit Wasser.'
  },

  /* --- Rohstoffe --- */
  holzfaeller: {
    n: 'Holzfällerhütte', cat: 'rohstoff', size: 2, icon: '🪓', prio: 2,
    wand: '#b98f5e', dach: '#6b4a2f', hoehe: 22,
    kosten: { holz: 20 }, unterh: 0.18, arb: 3,
    prod: { aus: { holz: 1 }, zeit: 4 },
    boden: { typ: [T.WALD], radius: 6, min: 14, name: 'Waldfelder' },
    beschr: 'Schlägt Holz im umliegenden Wald. Je mehr Wald, desto höher der Ertrag.'
  },
  steinbruch: {
    n: 'Steinbruch', cat: 'rohstoff', size: 2, icon: '⛏️', prio: 2,
    wand: '#a9a6a0', dach: '#6f6c66', hoehe: 18,
    kosten: { holz: 25 }, unterh: 0.22, arb: 3,
    prod: { aus: { stein: 1 }, zeit: 5 },
    boden: { typ: [T.FELS], radius: 5, min: 6, name: 'Steinfelder' },
    beschr: 'Bricht Stein aus einem Felsvorkommen in der Nähe.'
  },
  lehmgrube: {
    n: 'Lehmgrube', cat: 'rohstoff', size: 2, icon: '🟤', prio: 2,
    wand: '#b0784f', dach: '#7d5233', hoehe: 16,
    kosten: { holz: 20 }, unterh: 0.18, arb: 3,
    prod: { aus: { lehm: 1 }, zeit: 5 },
    boden: { typ: [T.LEHM], radius: 5, min: 5, name: 'Lehmfelder' },
    beschr: 'Sticht Lehm für die Ziegelei ab.'
  },
  eisenmine: {
    n: 'Eisenmine', cat: 'rohstoff', size: 2, icon: '⚒️', prio: 5,
    wand: '#8b8b92', dach: '#5c5c63', hoehe: 24,
    kosten: { holz: 40, ziegel: 10 }, unterh: 0.45, arb: 6,
    prod: { aus: { eisenerz: 1 }, zeit: 8 },
    boden: { typ: [T.ERZ], radius: 4, min: 4, name: 'Erzfelder' },
    beschr: 'Fördert Eisenerz für die Schmiede.'
  },
  marmorbruch: {
    n: 'Marmorbruch', cat: 'rohstoff', size: 3, icon: '🗿', prio: 5,
    wand: '#d9dce2', dach: '#9aa0aa', hoehe: 22,
    kosten: { holz: 50, werkzeug: 10 }, unterh: 0.7, arb: 8,
    prod: { aus: { marmor: 1 }, zeit: 12 },
    boden: { typ: [T.MARMOR], radius: 5, min: 4, name: 'Marmorfelder' },
    beschr: 'Liefert Marmor für Tempel, Amphitheater und die Domus.'
  },
  fischerhuette: {
    n: 'Fischerhütte', cat: 'rohstoff', size: 2, icon: '🎣', prio: 1,
    wand: '#c3ad86', dach: '#5e7f93', hoehe: 20,
    kosten: { holz: 20 }, unterh: 0.18, arb: 2,
    prod: { aus: { fisch: 2 }, zeit: 9 },
    boden: { typ: [T.WASSER], radius: 4, min: 8, name: 'Wasserfelder' },
    beschr: 'Fischt an der Küste. Muss dicht am Wasser stehen.'
  },
  getreidefarm: {
    n: 'Getreidefarm', cat: 'rohstoff', size: 3, icon: '🌾', prio: 1,
    wand: '#cbb082', dach: '#8a6a41', hoehe: 22,
    kosten: { holz: 30 }, unterh: 0.22, arb: 4,
    prod: { aus: { getreide: 2 }, zeit: 8 },
    boden: { typ: [T.FRUCHTBAR], radius: 6, min: 14, name: 'Ackerfelder' },
    beschr: 'Baut Getreide auf fruchtbarem Boden an.'
  },
  olivenhain: {
    n: 'Olivenhain', cat: 'rohstoff', size: 3, icon: '🫒', prio: 4,
    wand: '#c2b98e', dach: '#6f7a3a', hoehe: 18,
    kosten: { holz: 30 }, unterh: 0.22, arb: 4,
    prod: { aus: { oliven: 1 }, zeit: 7 },
    boden: { typ: [T.FRUCHTBAR], radius: 6, min: 10, name: 'Ackerfelder' },
    beschr: 'Erntet Oliven für die Ölpresse.'
  },
  weinberg: {
    n: 'Weinberg', cat: 'rohstoff', size: 3, icon: '🍇', prio: 4,
    wand: '#bda98c', dach: '#7b4397', hoehe: 18,
    kosten: { holz: 35 }, unterh: 0.25, arb: 5,
    prod: { aus: { trauben: 1 }, zeit: 7 },
    boden: { typ: [T.FRUCHTBAR], radius: 6, min: 10, name: 'Ackerfelder' },
    beschr: 'Zieht Reben für die Kelterei.'
  },
  schafweide: {
    n: 'Schafweide', cat: 'rohstoff', size: 3, icon: '🐑', prio: 4,
    wand: '#cdc3a8', dach: '#93a06a', hoehe: 16,
    kosten: { holz: 25 }, unterh: 0.18, arb: 3,
    prod: { aus: { wolle: 1 }, zeit: 8 },
    boden: { typ: [T.GRAS, T.FRUCHTBAR], radius: 6, min: 12, name: 'Weidefelder' },
    beschr: 'Schert Wolle für die Weberei.'
  },

  /* --- Verarbeitung --- */
  ziegelei: {
    n: 'Ziegelei', cat: 'produktion', size: 2, icon: '🧱', prio: 2,
    wand: '#bb7b58', dach: '#7a4028', hoehe: 26,
    kosten: { holz: 30, stein: 20 }, unterh: 0.32, arb: 4,
    prod: { ein: { lehm: 2, holz: 1 }, aus: { ziegel: 2 }, zeit: 6 },
    beschr: 'Brennt Lehm und Holz zu Ziegeln.'
  },
  schmiede: {
    n: 'Schmiede', cat: 'produktion', size: 2, icon: '🔨', prio: 5,
    wand: '#a58b6b', dach: '#4f4a45', hoehe: 24,
    kosten: { holz: 30, stein: 25 }, unterh: 0.35, arb: 5,
    prod: { ein: { eisenerz: 2, holz: 1 }, aus: { werkzeug: 1 }, zeit: 8 },
    beschr: 'Schmiedet Werkzeug aus Eisenerz.'
  },
  muehle: {
    n: 'Mühle', cat: 'produktion', size: 2, icon: '🌀', prio: 1,
    wand: '#d3c39c', dach: '#8a6a41', hoehe: 30,
    kosten: { holz: 25, stein: 10 }, unterh: 0.22, arb: 2,
    prod: { ein: { getreide: 2 }, aus: { mehl: 1 }, zeit: 5 },
    beschr: 'Mahlt Getreide zu Mehl.'
  },
  baeckerei: {
    n: 'Bäckerei', cat: 'produktion', size: 2, icon: '🍞', prio: 1,
    wand: '#dcc9a4', dach: '#a5502f', hoehe: 24,
    kosten: { holz: 25, stein: 15 }, unterh: 0.28, arb: 3,
    prod: { ein: { mehl: 1 }, aus: { brot: 2 }, zeit: 5 },
    beschr: 'Backt Brot aus Mehl – die wichtigste Nahrung deiner Stadt.'
  },
  oelpresse: {
    n: 'Ölpresse', cat: 'produktion', size: 2, icon: '🏺', prio: 4,
    wand: '#cfc09a', dach: '#6f7a3a', hoehe: 24,
    kosten: { holz: 25, stein: 15 }, unterh: 0.28, arb: 4,
    prod: { ein: { oliven: 2 }, aus: { oel: 1 }, zeit: 8 },
    beschr: 'Presst Olivenöl für die Patrizier.'
  },
  kelterei: {
    n: 'Kelterei', cat: 'produktion', size: 2, icon: '🍷', prio: 4,
    wand: '#c9b294', dach: '#6d2f45', hoehe: 24,
    kosten: { holz: 30, ziegel: 10 }, unterh: 0.28, arb: 4,
    prod: { ein: { trauben: 2 }, aus: { wein: 1 }, zeit: 8 },
    beschr: 'Keltert Wein aus Trauben.'
  },
  weberei: {
    n: 'Weberei', cat: 'produktion', size: 2, icon: '🧵', prio: 4,
    wand: '#cfc4ad', dach: '#8a5f7d', hoehe: 24,
    kosten: { holz: 25, stein: 10 }, unterh: 0.28, arb: 4,
    prod: { ein: { wolle: 2 }, aus: { kleidung: 1 }, zeit: 8 },
    beschr: 'Webt Kleidung aus Wolle.'
  },

  /* --- Oeffentlich --- */
  therme: {
    n: 'Therme', cat: 'oeffentlich', size: 3, icon: '♨️', prio: 3,
    wand: '#eae2d2', dach: '#8fb0c4', hoehe: 28,
    kosten: { stein: 60, ziegel: 30, denar: 200 }, unterh: 1.8, arb: 6,
    dienst: { d: 'unterhaltung', radius: 11 },
    beschr: 'Badehaus. Bürger und Patrizier verlangen danach.'
  },
  tempel: {
    n: 'Tempel', cat: 'oeffentlich', size: 3, icon: '🏛️', prio: 3,
    wand: '#f2eee2', dach: '#c07a3a', hoehe: 36,
    kosten: { stein: 50, marmor: 20, denar: 250 }, unterh: 1.6, arb: 5,
    dienst: { d: 'glaube', radius: 13 },
    beschr: 'Heiligtum für Jupiter. Pflicht für Patrizier.'
  },
  amphitheater: {
    n: 'Amphitheater', cat: 'oeffentlich', size: 4, icon: '🎭', prio: 3,
    wand: '#e3d9c4', dach: '#a86a3c', hoehe: 34,
    kosten: { stein: 90, marmor: 30, ziegel: 40, denar: 400 }, unterh: 3.5, arb: 10,
    dienst: { d: 'spiele', radius: 13 },
    beschr: 'Brot und Spiele – der Stolz jeder römischen Stadt.'
  }
};

const KATEGORIEN = [
  { id: 'wohnen', n: 'Wohnen', icon: '🏠' },
  { id: 'infra', n: 'Infrastruktur', icon: '🛣️' },
  { id: 'rohstoff', n: 'Rohstoffe', icon: '🌾' },
  { id: 'produktion', n: 'Produktion', icon: '⚙️' },
  { id: 'oeffentlich', n: 'Öffentlich', icon: '🏛️' }
];

/* ---------- Meilensteine ---------- */
const ZIELE = [
  { id: 'z1', n: 'Erste Siedler', b: 'Erreiche 25 Einwohner.', pruef: function (s) { return s.pop >= 25; }, lohn: 150 },
  { id: 'z2', n: 'Handwerk', b: 'Baue eine Ziegelei.', pruef: function (s) { return s.zaehl.ziegelei > 0; }, lohn: 150 },
  { id: 'z3', n: 'Brot für alle', b: 'Baue eine Bäckerei.', pruef: function (s) { return s.zaehl.baeckerei > 0; }, lohn: 200 },
  { id: 'z4', n: 'Aufstieg', b: 'Errichte die erste Insula.', pruef: function (s) { return s.zaehl.insula > 0; }, lohn: 250 },
  { id: 'z5', n: 'Wachsende Stadt', b: 'Erreiche 100 Einwohner.', pruef: function (s) { return s.pop >= 100; }, lohn: 400 },
  { id: 'z6', n: 'Wohlstand', b: 'Habe 2.000 Denare im Schatz.', pruef: function (s) { return s.geld >= 2000; }, lohn: 300 },
  { id: 'z7', n: 'Pietas', b: 'Weihe einen Tempel.', pruef: function (s) { return s.zaehl.tempel > 0; }, lohn: 500 },
  { id: 'z8', n: 'Nobilitas', b: 'Errichte die erste Domus.', pruef: function (s) { return s.zaehl.domus > 0; }, lohn: 750 },
  { id: 'z9', n: 'Panem et circenses', b: 'Baue ein Amphitheater.', pruef: function (s) { return s.zaehl.amphitheater > 0; }, lohn: 1000 },
  { id: 'z10', n: 'Urbs Magna', b: 'Erreiche 500 Einwohner.', pruef: function (s) { return s.pop >= 500; }, lohn: 2000 }
];
