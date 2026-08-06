# Cloud-Sync einrichten – Schritt-für-Schritt

Diese Anleitung beschreibt, wie du die Daten der SV-Lau-Brechte-App
automatisch auf deinem Ionos-Webspace (raw-bert.de) sichern lässt.

**Komplett über den Browser**, ohne FileZilla – über den Ionos-Webspace-Explorer.

**Geschätzter Aufwand:** ca. 10 Minuten.

---

## Was machen wir?

1. 4 Dateien über das Ionos-Webinterface in einen neuen Ordner `svlb/` hochladen.
2. Im Browser einmal die URL aufrufen – Test, ob alles läuft.
3. In der App das Token eintragen.
4. Fertig – ab dann wird automatisch gesichert.

---

## Schritt 1: Dateien lokal bereit legen

Du brauchst diese **4 Dateien** vom Ordner `D:\Dev\SVLaubrechte\Mitgliederverwaltung\server\`:

| Datei | Inhalt |
|---|---|
| `api.php` | Die Sync-Schnittstelle |
| `config.php` | Enthält dein Token – **niemals teilen!** |
| `.htaccess` | Sicherheitseinstellung |
| `ANLEITUNG.md` | Diese Anleitung (optional, schadet nicht) |

Öffne den Ordner schon mal im Windows-Explorer:
**D:\Dev\SVLaubrechte\Mitgliederverwaltung\server\**

> ⚠ Wichtig: die Datei `.htaccess` beginnt mit einem **Punkt**. Windows zeigt sie
> manchmal nicht an oder versteckt die Endung. Falls du sie nicht siehst:
> Im Explorer oben **Ansicht → Anzeigen → Ausgeblendete Elemente** aktivieren.

---

## Schritt 2: Ionos Webspace-Explorer öffnen

1. https://www.ionos.de/login öffnen und einloggen.
2. Im Menü **„Hosting"** klicken.
3. Das Hosting-Paket auswählen, das zu **raw-bert.de** gehört.
4. Im linken Menü nach einem dieser Punkte suchen (heißt je nach Tarif unterschiedlich):
   - **„Webspace Explorer"**
   - **„Datei-Manager"**
   - **„Hosting Files"**
   - Manchmal unter **„Erweiterte Funktionen"** oder **„Tools"** versteckt.

Wenn du es geöffnet hast, siehst du eine Datei-Übersicht ähnlich wie ein
Windows-Explorer-Fenster.

---

## Schritt 3: Ordner `svlb` anlegen

1. Im Webspace-Explorer in den Ordner deiner Domain wechseln. Heißt meist:
   - **`raw-bert.de`** oder
   - **`htdocs`** oder
   - **`/clickandbuilds/...`** – je nach Setup.
   Wenn unklar: such den Ordner, in dem die bestehende andere App liegt – das
   ist der richtige.
2. **„Neuer Ordner"** klicken (oder Rechtsklick → „Neuer Ordner"). Name: **`svlb`**.
3. Doppelklick auf den neuen Ordner – er ist leer.

---

## Schritt 4: Die 4 Dateien hochladen

1. Im Webspace-Explorer **„Hochladen"** klicken (oder Drag-&-Drop benutzen).
2. Alle 4 Dateien aus `D:\Dev\SVLaubrechte\Mitgliederverwaltung\server\` auswählen:
   - `api.php`
   - `config.php`
   - `.htaccess`
   - `ANLEITUNG.md`
3. Hochladen – kann 5–10 Sekunden dauern.

### Falls `.htaccess` nicht hochgeladen werden kann

Manche Browser/Datei-Manager filtern Dateien mit Punkt am Anfang. Falls die
Datei nach dem Upload fehlt:

**Plan B:**
1. Lade die anderen 3 Dateien hoch (`api.php`, `config.php`, `ANLEITUNG.md`).
2. Im Webspace-Explorer **„Neue Datei"** klicken → Name: **`.htaccess`** (mit Punkt).
3. Dann **„Bearbeiten"** auf die neue Datei → den Inhalt aus
   `D:\Dev\SVLaubrechte\Mitgliederverwaltung\server\.htaccess` rein-kopieren → speichern.

Notfall-Variante, falls das Ionos-Interface keine Dateinamen mit Punkt am
Anfang akzeptiert:
- Datei umbenennen zu `htaccess.txt` (lokal),
- hochladen,
- im Webspace-Explorer per **„Umbenennen"** den Namen auf `.htaccess` ändern.

---

## Schritt 5: Im Browser prüfen

1. Im Browser folgende Adresse öffnen:

   **https://raw-bert.de/svlb/api.php**

2. Du solltest sehen:
   ```
   {"error":"Ungueltiges oder fehlendes Token."}
   ```
   ✔ **Das ist genau richtig.** Die Datei läuft und blockiert Fremde ohne Token.

### Wenn was anderes kommt

| Was du siehst | Was es bedeutet |
|---|---|
| `Internal Server Error` (500) | `config.php` nicht hochgeladen oder PHP-Version zu alt. Im Ionos-Login → Hosting → PHP-Einstellungen → mindestens 7.4 auswählen. |
| `Not Found` (404) | Falscher Pfad. Schau im Webspace-Explorer, in welchem Ordner du gelandet bist. Sollte `raw-bert.de` → `svlb/` sein. |
| Quellcode der `api.php` als Text | PHP läuft auf dem Webspace nicht. Im Ionos-Hosting PHP für die Domain aktivieren. |
| Kein HTTPS möglich | Im Ionos-Login → Hosting → **SSL-Zertifikate** → für raw-bert.de Let's Encrypt aktivieren (gratis, einmal klicken, 2 Minuten warten). |

---

## Schritt 6: In der App das Token eintragen

1. Die App öffnen: https://sv-laubrechte.vercel.app/
2. Oben rechts im Header siehst du jetzt einen neuen Knopf **„Sync aus"**.
   → **Anklicken**.
3. Ein Dialog öffnet sich. Die Server-Adresse ist schon vorausgefüllt:
   `https://raw-bert.de/svlb/api.php`
4. Ins **Token-Feld** dieses Token einfügen:

   ```
   875bfb69dc28e31b3f5d448dcb7a7a8594e9fd4d14914d2997af5171fbae51e5
   ```

5. **„Verbinden & testen"** klicken.

Mögliche Antworten:
- **„✔ Verbunden! Lade Mitgliederdaten auf den Server…"** → alles gut, deine
  223 Einträge werden initial gespeichert. Nach 1–2 Sekunden steht ein
  ✔ Synchron im Header.
- **„❌ ..."** → Fehler. Häufigste Ursachen:
  - Token falsch kopiert (alle 64 Zeichen?). Tipp: vom Anfang bis zum Ende
    nochmal markieren und einfügen.
  - HTTPS nicht aktiviert (siehe Tabelle oben).
  - `config.php` enthält ein anderes Token als hier in der Anleitung steht.
    Schau zur Sicherheit nochmal in `D:\Dev\SVLaubrechte\Mitgliederverwaltung\server\config.php`
    rein – dort steht das echte Token zwischen Anführungszeichen.

---

## Was passiert ab jetzt?

- Jede Änderung (neues Mitglied, Foto, Adresse, Geocoding, Tour-Ausschluss)
  wird **automatisch** auf den Server gespeichert – innerhalb von ca. 2 Sek.
- Der Knopf oben rechts zeigt den Status:

  | Anzeige | Bedeutung |
  |---|---|
  | ✔ Synchron (grün) | alles gesichert |
  | ⏳ Sichere… (blau) | läuft gerade |
  | ⚠ Offline (orange) | Server nicht erreichbar; Daten bleiben lokal, werden bei der nächsten Verbindung automatisch nachgesichert |
  | ❌ Sync-Fehler (rot) | z. B. Token plötzlich ungültig – im Setup nochmal prüfen |

- Auf einem **zweiten Gerät** (Handy, anderer Browser): App öffnen, „Sync aus"
  klicken, dasselbe Token eintragen → Daten werden vom Server geladen.

---

## Backup-Sicherheit (4-stufig)

1. **Lokal im Browser** (wie bisher)
2. **Server `current.json`** (live)
3. **Server-Snapshots**: die letzten 10 Versionen, automatisch.
   Liegen unter `svlb/data/snapshots/` – über Ionos-Webspace-Explorer
   einsehbar.
4. **Ionos-Backup**: tägliche Server-Backups in der Ionos-Cloud (je nach
   Tarif 6–30 Tage rückwirkend wiederherstellbar).

Damit sind Datenverluste praktisch ausgeschlossen.

---

## Wo liegen die Daten auf dem Server?

Nach dem ersten erfolgreichen Sync siehst du im Ionos-Webspace-Explorer
unter `svlb/`:

```
svlb/
├── api.php             (die Schnittstelle)
├── config.php          (dein Token – BLEIBT GEHEIM)
├── .htaccess           (Sicherheit)
└── data/
    ├── current.json    (aktuelle Mitgliederliste, als JSON)
    └── snapshots/
        ├── snap-20260619-143000.json
        ├── snap-20260619-150100.json
        └── ... (max. 10)
```

Wenn du die Daten manuell anschauen willst: rechtsklick auf `current.json`
im Webspace-Explorer → herunterladen → mit Notepad oder Editor öffnen.

---

## Häufige Fragen

**Was kostet das?**
Nichts. Ionos-Hosting hast du eh.

**Was, wenn ich raw-bert.de mal kündige?**
Vorher in der App auf **„Als CSV exportieren"** klicken und Daten lokal sichern.
Dann Token + URL in der App auf den neuen Server umstellen.

**Kann jemand anders meine Mitgliederdaten klauen?**
Nicht ohne das Token. Das steht nur in der `config.php` (auf dem Server) und
in deinem lokalen Browser-Speicher. Außerdem verschlüsselt HTTPS die Übertragung.

**Was, wenn ich das Token verliere?**
Per Webspace-Explorer die `config.php` öffnen (Bearbeiten-Funktion) und das
Token kopieren – das ist die Zeichenkette zwischen den Anführungszeichen.

**Browser-Cache leeren – sind die Daten dann weg?**
Nein. Beim nächsten Start lädt die App die Daten vom Server. Genau das ist
der Punkt von Cloud-Sync.

**Funktioniert das auch offline?**
Ja. Die App speichert weiterhin lokal. Wenn keine Verbindung da ist, zeigt
das Symbol „⚠ Offline". Sobald wieder online: automatisch synchronisiert.
