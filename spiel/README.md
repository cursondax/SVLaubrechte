# ROMA – Aufbau & Handel im alten Rom

Eine Wirtschafts- und Aufbausimulation im Stil von *Anno*, gebaut für das iPad.
Läuft komplett im Browser, ohne Server, ohne Framework, ohne Tracking – und nach
dem ersten Laden auch offline.

![Kategorien](icon-192.png)

## Spielprinzip

Du gründest eine römische Stadt auf einer Insel im Mittelmeer:

* **Straßen** verbinden jedes Gebäude mit dem **Forum Romanum**. Ohne Anschluss
  wird nichts geliefert (🚧 am Gebäude).
* **Rohstoffbetriebe** brauchen passende Vorkommen in Reichweite: Wald, Fels,
  Lehm, Eisenerz, Marmor, fruchtbaren Boden oder Wasser.
* **Produktionsketten** veredeln die Rohstoffe:
  * Getreide → Mehl → Brot
  * Lehm + Holz → Ziegel
  * Trauben → Wein · Oliven → Öl · Wolle → Kleidung
  * Eisenerz + Holz → Werkzeug
* **Wohnhäuser** steigen auf, wenn ihre Bedürfnisse gedeckt sind:
  * 🛖 **Plebejer** – Wasser, Nahrung
  * 🏘️ **Bürger** – zusätzlich Kleidung, Wein, Therme
  * 🏛️ **Patrizier** – zusätzlich Olivenöl, Tempel, Amphitheater
* **Arbeiter** kommen aus den Wohnhäusern (60 % der Einwohner). Bei Knappheit
  werden zuerst Nahrung und Baustoffe besetzt, damit die Stadt nicht kollabiert.
* **Steuern** steigen mit Wohnstufe und Zufriedenheit, **Unterhalt** kostet
  jedes Gebäude – die Bilanz oben rechts zeigt den Saldo pro Minute.

Zehn Meilensteine führen von den ersten 25 Siedlern bis zur Großstadt mit
Amphitheater.

## Steuerung (Touch)

| Geste | Wirkung |
|---|---|
| Ein Finger ziehen | Karte verschieben |
| Zwei Finger | Zoomen und schieben |
| Tippen | Gebäude auswählen bzw. im Baumodus setzen |
| Im Straßen-Modus ziehen | Straßen malen |
| 🗑️ Abriss | Modus aktivieren, dann Gebäude antippen (40 % Rückerstattung) |

Maus und Mausrad funktionieren genauso – zum Testen am Rechner.

## Lokal starten

```bash
cd spiel
python3 -m http.server 8080
# http://localhost:8080 im Browser öffnen
```

## Auf Vercel veröffentlichen

Das Verzeichnis ist ein reines Static-Site-Projekt, es gibt keinen Build-Schritt.

**Variante A – Vercel CLI (schnellster Weg):**

```bash
cd spiel
npx vercel        # Vorschau-Deployment
npx vercel --prod # Produktiv-Deployment
```

**Variante B – GitHub-Import (automatische Deployments bei jedem Push):**

1. Auf [vercel.com/new](https://vercel.com/new) das Repository importieren.
2. Bei **Root Directory** `spiel` auswählen. Wichtig, sonst wird die
   Mitgliederverwaltung im Repo-Wurzelverzeichnis ausgeliefert.
3. Framework Preset: **Other**. Build Command und Output Directory leer lassen.
4. Deploy. Ab jetzt löst jeder Push auf den Branch ein neues Deployment aus.

Die `vercel.json` sorgt dafür, dass der Service Worker und die Skripte nicht zu
lange gecacht werden – Updates kommen so sofort beim Spieler an.

## Als App aufs iPad legen

Seite in **Safari** öffnen → Teilen-Symbol → **Zum Home-Bildschirm**. Danach
startet ROMA im Vollbild ohne Browserleiste und läuft dank Service Worker auch
ohne Internetverbindung.

## Spielstand

Der Spielstand liegt in `localStorage` (Schlüssel `roma-stand-v1`) und wird alle
20 Sekunden sowie beim Verlassen der Seite gespeichert. „Neue Insel“ im Menü
löscht ihn und startet eine frisch generierte Karte.

## Aufbau des Codes

| Datei | Inhalt |
|---|---|
| `js/data.js` | Waren, Geländetypen, Gebäude, Wohnstufen, Meilensteine |
| `js/world.js` | Kartengenerator (Noise + Quantil-Schwellen), Isometrie-Mathematik |
| `js/sim.js` | Simulation: Bauen, Straßennetz, Produktion, Versorgung, Steuern |
| `js/render.js` | Isometrisches Zeichnen, Gelände-Cache, Overlays |
| `js/ui.js` | Bedienoberfläche, Touch-Gesten, Panels |
| `js/main.js` | Spielschleife, Speichern/Laden, Töne |
| `generate-icons.py` | Erzeugt die App-Icons (ohne externe Bibliotheken) |

Balancing-Werte stehen gesammelt in `js/data.js` – Produktionszeiten, Kosten,
Unterhalt, Arbeiterzahlen, Steuersätze und Bedarfsmengen lassen sich dort
anpassen, ohne den Simulationscode anzufassen.
