/* PADD-Modus: Enterprise-Tablet-Gehäuse um diese App (USS Enterprise NCC-1701-D).
 *
 * Wirkt NUR, wenn die Seite mit ?padd=1 aufgerufen wird. Das macht ausschließlich
 * die Enterprise-App (https://ncc1701d.vercel.app). Ein normaler Aufruf bleibt
 * völlig unverändert.
 *
 * Funktionsweise: Das Skript steht als erstes im <head>. Im PADD-Modus hält es
 * den Aufbau der App an und zeichnet stattdessen das Tablet-Gehäuse. Darin läuft
 * die App selbst unverändert in einem Rahmen von DERSELBEN Adresse. Weil Adresse
 * und Website gleich bleiben, nutzt die App dieselben Daten (localStorage, IndexedDB)
 * und dieselbe Anmeldung wie beim normalen Aufruf.
 *
 * Die Datei ist in allen Apps identisch; Änderungen bitte überall gleich übernehmen.
 */
(function () {
  "use strict";
  var ENTERPRISE = "https://ncc1701d.vercel.app/";
  var params;
  try { params = new URLSearchParams(location.search); } catch (e) { return; }
  if (params.get("padd") !== "1") return;
  try { if (window.top !== window.self) return; } catch (e) { return; }

  // Adresse der App ohne den PADD-Schalter
  params.delete("padd");
  var qs = params.toString();
  var inner = location.pathname + (qs ? "?" + qs : "") + location.hash;
  try { history.replaceState(null, "", location.pathname + "?padd=1" + (qs ? "&" + qs : "") + location.hash); } catch (e) {}

  // Aufbau der eigentlichen App an dieser Stelle anhalten
  try { window.stop(); } catch (e) {}
  window.__PADD_SHELL__ = true;

  var appName = (document.title || "App").replace(/\s+[–—|-]\s+.*$/, "");

  function sternzeit() {
    var d = new Date(), y = d.getFullYear();
    var s = new Date(y, 0, 1), e = new Date(y + 1, 0, 1);
    return (41000 + (y - 1987) * 1000 + (d - s) / (e - s) * 1000).toFixed(1).replace(".", ",");
  }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  var css = [
    ":root{--o:#FF9C3A;--g:#FFCC66;--t:#FFCC99;--l:#CC99CC;--v:#9999CC;--b:#7799FF;--s:#99CCFF;",
    "--lc:'Antonio','Arial Narrow',sans-serif;--edge:clamp(6px,1.6vw,22px)}",
    "*{box-sizing:border-box}html,body{margin:0;height:100%;background:#000;overflow:hidden}",
    "body{display:flex;align-items:center;justify-content:center;",
    "padding:calc(env(safe-area-inset-top) + 6px) calc(env(safe-area-inset-right) + 6px) calc(env(safe-area-inset-bottom) + 6px) calc(env(safe-area-inset-left) + 6px);",
    "background:radial-gradient(120% 90% at 50% 40%,#0d1424 0%,#000 70%)}",
    /* Gehaeuse */
    ".padd{position:relative;width:100%;max-width:1280px;height:100%;display:flex;flex-direction:column;",
    "padding:var(--edge) var(--edge) calc(var(--edge) + 18px);border-radius:clamp(16px,3vw,38px);",
    "background:linear-gradient(150deg,#5d4c3a 0%,#3b3027 30%,#241d17 70%,#3a2f25 100%);",
    "box-shadow:0 0 0 1px rgba(255,204,153,.25) inset,0 2px 0 rgba(255,230,200,.18) inset,0 -3px 0 rgba(0,0,0,.5) inset,",
    "0 30px 80px rgba(0,0,0,.8),0 0 60px rgba(119,153,255,.12)}",
    ".padd::before{content:'';position:absolute;left:12%;right:12%;top:3px;height:2px;border-radius:2px;",
    "background:linear-gradient(90deg,transparent,rgba(255,230,200,.35),transparent)}",
    /* Bildschirm */
    ".screen{flex:1;min-height:0;display:flex;flex-direction:column;background:#000;border-radius:clamp(8px,1.6vw,18px);",
    "overflow:hidden;box-shadow:0 0 0 2px #0b0907,0 0 0 3px rgba(255,204,153,.18),inset 0 0 24px rgba(119,153,255,.10)}",
    /* LCARS-Kopf */
    ".bar{flex:0 0 auto;display:flex;align-items:stretch;gap:4px;height:46px;padding:6px 8px 4px 0;background:#000}",
    ".elbow{position:relative;width:96px;flex:0 0 auto;background:var(--o);border-radius:0 0 0 0;border-top-left-radius:0;",
    "border-bottom-right-radius:0;display:flex;align-items:flex-start;justify-content:flex-end;padding:2px 10px 0 0;",
    "font-family:var(--lc);font-size:12px;letter-spacing:.12em;color:#000;font-weight:600}",
    ".elbow::after{content:'';position:absolute;right:0;bottom:0;width:22px;height:calc(100% - 16px);background:#000;border-top-left-radius:14px}",
    ".elbow{border-bottom-left-radius:22px}",
    ".seg{height:16px;align-self:flex-start;background:var(--v)}.seg.t{background:var(--t)}.seg.l{background:var(--l)}.seg.g{background:var(--g)}",
    ".grow{flex:1;min-width:8px}",
    ".title{align-self:flex-start;display:flex;flex-direction:column;align-items:flex-end;margin-top:-4px;min-width:0}",
    ".title b{font-family:var(--lc);font-weight:700;color:var(--o);font-size:clamp(16px,2.6vw,26px);letter-spacing:.06em;",
    "text-transform:uppercase;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:46vw}",
    ".title small{font-family:var(--lc);font-size:10px;letter-spacing:.2em;color:var(--v);white-space:nowrap}",
    ".title small i{font-style:normal;color:var(--g)}",
    ".back{align-self:flex-start;height:22px;border:0;border-radius:11px;padding:0 12px;background:var(--b);color:#000;cursor:pointer;",
    "font-family:var(--lc);font-weight:600;font-size:12px;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap}",
    ".back:hover{filter:brightness(1.15)}.back:focus-visible{outline:2px solid #fff;outline-offset:2px}",
    /* App-Rahmen */
    ".app{flex:1;min-height:0;position:relative;background:#fff}",
    ".app iframe{position:absolute;inset:0;width:100%;height:100%;border:0;display:block;background:#fff}",
    ".foot{flex:0 0 auto;display:flex;gap:4px;height:8px;padding:0 8px 0 0;margin-top:4px;background:#000}",
    ".foot .seg{height:8px}.foot .first{width:96px;background:var(--o);border-radius:0 0 0 4px}",
    /* Hardware am Gehaeuse */
    ".hw{position:absolute;left:0;right:0;bottom:4px;height:14px;display:flex;align-items:center;justify-content:center;gap:10px;pointer-events:none}",
    ".hw span{width:9px;height:9px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff 0%,#99CCFF 40%,#3f7dff 100%);",
    "box-shadow:0 0 6px rgba(153,204,255,.8)}",
    ".hw span.r{background:radial-gradient(circle at 35% 30%,#fff 0%,#FFCC99 45%,#FF9C3A 100%);box-shadow:0 0 6px rgba(255,156,58,.7)}",
    ".hw em{font-style:normal;font-family:var(--lc);font-size:9px;letter-spacing:.3em;color:rgba(255,220,180,.45);text-transform:uppercase}",
    ".hw .lft{position:absolute;left:calc(var(--edge) + 10px)}.hw .rgt{position:absolute;right:calc(var(--edge) + 10px)}",
    "@media (max-width:640px){.bar{height:38px}.elbow{width:58px;font-size:10px;padding-right:6px}.foot .first{width:58px}",
    ".seg.hide{display:none}.title small{display:none}.back{font-size:11px;padding:0 9px}.hw em{display:none}}",
    "@media (prefers-reduced-motion:no-preference){.screen{animation:on .5s ease-out both}",
    "@keyframes on{from{opacity:0;filter:brightness(2.2)}to{opacity:1;filter:none}}}"
  ].join("");

  var html =
    '<head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' +
    '<meta name="theme-color" content="#000000">' +
    "<title>" + esc(appName) + " · PADD</title>" +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Antonio:wght@400;600;700&display=swap" rel="stylesheet">' +
    "<style>" + css + "</style></head>" +
    '<body><div class="padd" role="application" aria-label="Enterprise-PADD">' +
    '<div class="screen">' +
    '<div class="bar"><div class="elbow">PADD</div>' +
    '<span class="seg t grow"></span><span class="seg l hide" style="width:40px"></span>' +
    '<div class="title"><b id="paddTitle">' + esc(appName) + "</b>" +
    "<small>NCC-1701-D · <i>STERNZEIT " + sternzeit() + "</i></small></div>" +
    '<span class="seg" style="width:14px"></span>' +
    '<button class="back" id="paddBack" type="button">◂ Enterprise</button></div>' +
    '<div class="app"><iframe id="paddFrame" title="' + esc(appName) + '" ' +
    'allow="geolocation; camera; microphone; clipboard-read; clipboard-write; fullscreen; screen-wake-lock; web-share; autoplay; display-capture" ' +
    'allowfullscreen src="' + esc(inner) + '"></iframe></div>' +
    '<div class="foot"><span class="seg first"></span><span class="seg g grow"></span><span class="seg l" style="width:60px"></span><span class="seg" style="width:24px"></span></div>' +
    "</div>" +
    '<div class="hw"><em class="lft">Sternenflotte</em><span></span><span class="r"></span><span></span><em class="rgt">PADD 1701-D</em></div>' +
    "</div></body>";

  function build() {
    document.documentElement.innerHTML = html;
    var frame = document.getElementById("paddFrame");
    var titleEl = document.getElementById("paddTitle");
    // Titel der App uebernehmen, sobald sie geladen ist (gleiche Adresse, daher lesbar)
    frame.addEventListener("load", function () {
      try {
        var t = frame.contentDocument && frame.contentDocument.title;
        if (t) { t = t.replace(/\s+[–—|-]\s+.*$/, ""); titleEl.textContent = t; document.title = t + " · PADD"; }
      } catch (e) {}
    });
    document.getElementById("paddBack").addEventListener("click", function () {
      // In einem eigenen Tab geoeffnet: Tab schliessen; sonst zur Enterprise wechseln
      try { window.close(); } catch (e) {}
      setTimeout(function () { location.href = ENTERPRISE; }, 250);
    });
  }
  if (document.documentElement) build();
  else document.addEventListener("DOMContentLoaded", build);
})();
