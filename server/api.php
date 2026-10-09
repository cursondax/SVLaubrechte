<?php
/**
 * SV Lau-Brechte – Cloud-Sync-API
 *
 * Endpoints:
 *   GET  /api.php          -> aktuelle Daten laden
 *   GET  /api.php?action=head -> nur Version (rev, server_ts, count), ohne Daten
 *   POST /api.php          -> Daten speichern (+ Snapshot)
 *   OPTIONS /api.php       -> CORS-Preflight
 *
 * Konfliktschutz: Jeder gespeicherte Stand bekommt eine laufende Nummer "rev".
 * Schickt die App "base_rev" mit und passt das nicht zum aktuellen Stand
 * (ein anderes Geraet hat inzwischen gespeichert), antwortet der Server mit
 * 409 statt zu ueberschreiben. "force": true ueberschreibt bewusst.
 * Ohne base_rev (aeltere App-Versionen) wird wie frueher gespeichert.
 *
 * Auth: Bearer-Token im Authorization-Header.
 * Daten: data/current.json
 *        data/snapshots/snap-YYYYMMDD-HHMMSS.json (Stand VOR jeder Aenderung, max 10)
 *        data/daily/day-YYYYMMDD.json (Stand am Ende jedes Tages, deutsche Zeit, max 30)
 */

// --- CORS ------------------------------------------------------------------
$allowed_origins = [
    'https://sv-laubrechte.vercel.app',
    'http://localhost:8765',
    'http://127.0.0.1:8765',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Max-Age: 3600');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// --- Helpers ---------------------------------------------------------------
function fail($code, $msg) {
    http_response_code($code);
    echo json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

function get_bearer_token() {
    // Verschiedene Stellen pruefen - Ionos/Apache/FastCGI legen den
    // Authorization-Header an unterschiedlichen Plaetzen ab.
    $hdr = '';
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        $hdr = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $hdr = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    } elseif (function_exists('apache_request_headers')) {
        $h = apache_request_headers();
        foreach (['Authorization','authorization','AUTHORIZATION'] as $k) {
            if (!empty($h[$k])) { $hdr = $h[$k]; break; }
        }
    } elseif (function_exists('getallheaders')) {
        $h = getallheaders();
        foreach (['Authorization','authorization','AUTHORIZATION'] as $k) {
            if (!empty($h[$k])) { $hdr = $h[$k]; break; }
        }
    }
    if (preg_match('/Bearer\s+(.+)/i', $hdr, $m)) {
        return trim($m[1]);
    }
    return '';
}

// --- Auth ------------------------------------------------------------------
$config_path = __DIR__ . '/config.php';
if (!is_file($config_path)) {
    fail(500, 'Server-Konfiguration fehlt (config.php).');
}
$config = require $config_path;
$expected = $config['token'] ?? '';
if ($expected === '' || $expected === 'HIER-DEIN-64-ZEICHEN-HEX-TOKEN-EINTRAGEN') {
    fail(500, 'Server-Token nicht gesetzt.');
}

$given = get_bearer_token();
if ($given === '') {
    fail(401, 'Authorization-Header fehlt (Server schluckt ihn moeglicherweise - .htaccess pruefen).');
}
if (!hash_equals($expected, $given)) {
    // Bewusst KEINE Teile des Tokens in der Antwort (frueher wurden die ersten
    // 6 Zeichen des echten Tokens verraten). Kurze Pause bremst Durchprobieren.
    usleep(1000000);
    fail(401, 'Token ungueltig.');
}

// --- Storage ---------------------------------------------------------------
// Optional in config.php: 'data_dir' => '/pfad/ausserhalb/des/webroots'
// Ohne Angabe wie bisher: Unterordner data/ neben api.php.
$data_dir = rtrim($config['data_dir'] ?? (__DIR__ . '/data'), '/');
$snap_dir  = $data_dir . '/snapshots';
$daily_dir = $data_dir . '/daily';
$current   = $data_dir . '/current.json';
define('SNAP_MAX', 10);    // Snapshots vor jeder Aenderung
define('DAILY_MAX', 30);   // Tagesstaende

if (!is_dir($data_dir))  { @mkdir($data_dir, 0775, true); }
if (!is_dir($snap_dir))  { @mkdir($snap_dir, 0775, true); }
if (!is_dir($daily_dir)) { @mkdir($daily_dir, 0775, true); }
if (!is_dir($data_dir) || !is_writable($data_dir)) {
    fail(500, 'Daten-Verzeichnis nicht beschreibbar.');
}

// Zweite Schutzschicht: eigene .htaccess direkt im Datenordner, die JEDEN
// Browser-Zugriff sperrt - unabhaengig davon, ob die .htaccess im
// Elternordner hochgeladen wurde. api.php liest die Dateien direkt vom
// Dateisystem und ist davon nicht betroffen.
$guard = $data_dir . '/.htaccess';
if (!is_file($guard)) {
    @file_put_contents($guard,
        "# Automatisch von api.php angelegt - nicht loeschen\n"
      . "<IfModule mod_authz_core.c>\n    Require all denied\n</IfModule>\n"
      . "<IfModule !mod_authz_core.c>\n    Order allow,deny\n    Deny from all\n</IfModule>\n"
      . "Options -Indexes\n");
}

// --- Routes ----------------------------------------------------------------
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? '';

// Kopfdaten des aktuellen Stands (rev, server_ts, count) oder null
function read_head($current) {
    if (!is_file($current)) return null;
    $raw = @file_get_contents($current);
    if ($raw === false) return null;
    $d = json_decode($raw, true);
    if (!is_array($d)) return null;
    return [
        'rev'       => isset($d['rev']) ? (int) $d['rev'] : 0,
        'server_ts' => $d['server_ts'] ?? null,
        'count'     => isset($d['members']) && is_array($d['members']) ? count($d['members']) : ($d['count'] ?? null),
    ];
}

// Anzahl und Zeitstempel einer gespeicherten Datei billig ablesen, ohne sie
// ganz zu dekodieren. "count" und "server_ts" stehen am ENDE der Datei (hinter
// der Mitgliederliste), deshalb Anfang und Ende lesen.
function peek_meta($f) {
    $count = null; $ts = null;
    $size = @filesize($f) ?: 0;
    $fh = @fopen($f, 'r');
    if (!$fh) return [null, null];
    $head = fread($fh, 8192);
    $tail = '';
    if ($size > 8192) {
        fseek($fh, max(0, $size - 8192));
        $tail = fread($fh, 8192);
    }
    fclose($fh);
    foreach ([$tail, $head] as $chunk) {
        if ($count === null && preg_match_all('/"count"\s*:\s*(\d+)/', $chunk, $m)) {
            $count = (int) end($m[1]);
        }
        if ($ts === null && preg_match_all('/"server_ts"\s*:\s*"([^"]+)"/', $chunk, $m)) {
            $ts = end($m[1]);
        }
    }
    return [$count, $ts];
}

// Gespeicherte Datei nach Typ: Snapshot oder Tagesstand (strikte Namen, kein Path-Traversal)
function stored_file($name, $snap_dir, $daily_dir) {
    if (preg_match('/^snap-\d{8}-\d{6}\.json$/', $name)) return $snap_dir . '/' . $name;
    if (preg_match('/^day-\d{8}\.json$/', $name))        return $daily_dir . '/' . $name;
    return null;
}

// Nur die juengsten $max Dateien eines Musters behalten
function rotate($pattern, $max) {
    $files = glob($pattern) ?: [];
    if (count($files) <= $max) return;
    sort($files); // alphabetisch = chronologisch
    foreach (array_slice($files, 0, count($files) - $max) as $f) { @unlink($f); }
}

if ($method === 'GET') {
    // --- Nur Version abfragen (fuer schnellen Abgleich ohne Datenmenge) -----
    if ($action === 'head') {
        $head = read_head($current);
        echo json_encode($head ? $head : ['empty' => true, 'rev' => 0], JSON_UNESCAPED_UNICODE);
        exit;
    }
    // --- Snapshot-Liste -----------------------------------------------------
    if ($action === 'list_snapshots') {
        $snaps = glob($snap_dir . '/snap-*.json') ?: [];
        sort($snaps); // chronologisch (Dateiname enthaelt Datum)
        $snaps = array_reverse($snaps); // juengste zuerst
        $list = [];
        foreach ($snaps as $f) {
            $size = @filesize($f) ?: 0;
            // Snapshot-Datum aus Dateiname: snap-YYYYMMDD-HHMMSS.json
            $name = basename($f);
            $iso = null;
            if (preg_match('/^snap-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.json$/', $name, $m)) {
                $iso = sprintf('%s-%s-%sT%s:%s:%sZ', $m[1], $m[2], $m[3], $m[4], $m[5], $m[6]);
            }
            list($count, ) = peek_meta($f);
            $list[] = ['name' => $name, 'ts' => $iso, 'size' => $size, 'count' => $count];
        }
        // Tagesstaende: juengster zuerst; ts = letzte Aenderung an diesem Tag
        $days = glob($daily_dir . '/day-*.json') ?: [];
        rsort($days);
        $daily = [];
        foreach ($days as $f) {
            $name = basename($f);
            list($count, $ts) = peek_meta($f);
            $day = null;
            if (preg_match('/^day-(\d{4})(\d{2})(\d{2})\.json$/', $name, $m)) {
                $day = $m[1] . '-' . $m[2] . '-' . $m[3];
            }
            $daily[] = ['name' => $name, 'day' => $day, 'ts' => $ts, 'size' => @filesize($f) ?: 0, 'count' => $count];
        }
        echo json_encode(['snapshots' => $list, 'daily' => $daily], JSON_UNESCAPED_UNICODE);
        exit;
    }
    // --- Einzelnen Snapshot laden -------------------------------------------
    if ($action === 'snapshot') {
        $name = $_GET['name'] ?? '';
        // Strikte Validierung: nur unsere Namens-Schemata akzeptieren (kein Path-Traversal)
        $f = stored_file($name, $snap_dir, $daily_dir);
        if ($f === null) {
            fail(400, 'Ungueltiger Snapshot-Name.');
        }
        if (!is_file($f)) {
            fail(404, 'Snapshot nicht gefunden.');
        }
        $raw = @file_get_contents($f);
        if ($raw === false) {
            fail(500, 'Lesen fehlgeschlagen.');
        }
        echo $raw;
        exit;
    }
    // --- Standard: current.json ---------------------------------------------
    if (!is_file($current)) {
        echo json_encode(['empty' => true, 'ts' => null], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $raw = @file_get_contents($current);
    if ($raw === false) {
        fail(500, 'Lesen fehlgeschlagen.');
    }
    // Direkt durchreichen (ist bereits valides JSON)
    echo $raw;
    exit;
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        fail(400, 'Leerer Request-Body.');
    }
    if (strlen($raw) > 50 * 1024 * 1024) { // 50 MB Limit
        fail(413, 'Datenmenge zu gross.');
    }
    $payload = json_decode($raw, true);
    if (!is_array($payload)) {
        fail(400, 'Ungueltiges JSON.');
    }
    // Mindest-Schema-Pruefung: members muss ein Array sein
    if (!isset($payload['members']) || !is_array($payload['members'])) {
        fail(400, 'Feld "members" fehlt oder ist kein Array.');
    }

    // Sperre: Pruefen und Schreiben duerfen sich zwischen zwei Geraeten nicht
    // ueberschneiden. Wird beim Skriptende automatisch freigegeben.
    $lock = @fopen($data_dir . '/.lock', 'c');
    if ($lock) { flock($lock, LOCK_EX); }

    $head     = read_head($current);
    $cur_rev  = $head ? $head['rev'] : 0;
    $force    = !empty($payload['force']);
    $has_base = array_key_exists('base_rev', $payload) && $payload['base_rev'] !== null;
    if ($head && $has_base && !$force && (int) $payload['base_rev'] !== $cur_rev) {
        http_response_code(409);
        echo json_encode([
            'error'     => 'Auf dem Server liegt inzwischen ein neuerer Stand.',
            'conflict'  => true,
            'rev'       => $cur_rev,
            'server_ts' => $head['server_ts'],
            'count'     => $head['count'],
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    // Steuerfelder nicht mit abspeichern
    unset($payload['base_rev'], $payload['force']);

    // Server-Zeitstempel einsetzen (UTC ISO-8601)
    $payload['rev']       = $cur_rev + 1;
    $payload['server_ts'] = gmdate('Y-m-d\TH:i:s\Z');
    $payload['count']     = count($payload['members']);
    $serialized = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($serialized === false) {
        fail(500, 'JSON-Encoding fehlgeschlagen.');
    }

    // Snapshot der vorherigen Version (falls vorhanden)
    if (is_file($current)) {
        $snap_name = 'snap-' . gmdate('Ymd-His') . '.json';
        @copy($current, $snap_dir . '/' . $snap_name);
        rotate($snap_dir . '/snap-*.json', SNAP_MAX);
    }

    // Atomar schreiben: erst .tmp, dann rename
    $tmp = $current . '.tmp';
    $written = @file_put_contents($tmp, $serialized, LOCK_EX);
    if ($written === false) {
        fail(500, 'Schreiben fehlgeschlagen.');
    }
    if (!@rename($tmp, $current)) {
        @unlink($tmp);
        fail(500, 'Umbenennen fehlgeschlagen.');
    }

    // Tagesstand: neuen Stand als day-JJJJMMTT.json ablegen (deutsche Zeit).
    // Spaetere Aenderungen am selben Tag ueberschreiben ihn -> es bleibt der
    // Stand vom Tagesende. Die letzten 30 Tage mit Aenderungen bleiben erhalten.
    $berlin = new DateTime('now', new DateTimeZone('Europe/Berlin'));
    @copy($current, $daily_dir . '/day-' . $berlin->format('Ymd') . '.json');
    rotate($daily_dir . '/day-*.json', DAILY_MAX);

    echo json_encode([
        'ok'        => true,
        'rev'       => $payload['rev'],
        'server_ts' => $payload['server_ts'],
        'count'     => $payload['count'],
        'bytes'     => $written,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

fail(405, 'Methode nicht erlaubt.');
