<?php
/**
 * SV Lau-Brechte – Cloud-Sync-API
 *
 * Endpoints:
 *   GET  /api.php          -> aktuelle Daten laden
 *   POST /api.php          -> Daten speichern (+ Snapshot)
 *   OPTIONS /api.php       -> CORS-Preflight
 *
 * Auth: Bearer-Token im Authorization-Header.
 * Daten: data/current.json + data/snapshots/snap-YYYYMMDD-HHMMSS.json (max 10)
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
    fail(401, 'Token stimmt nicht ueberein (gesendet: ' . substr($given, 0, 6) . '..., erwartet: ' . substr($expected, 0, 6) . '...).');
}

// --- Storage ---------------------------------------------------------------
$data_dir = __DIR__ . '/data';
$snap_dir = $data_dir . '/snapshots';
$current  = $data_dir . '/current.json';

if (!is_dir($data_dir)) { @mkdir($data_dir, 0775, true); }
if (!is_dir($snap_dir)) { @mkdir($snap_dir, 0775, true); }
if (!is_dir($data_dir) || !is_writable($data_dir)) {
    fail(500, 'Daten-Verzeichnis nicht beschreibbar.');
}

// --- Routes ----------------------------------------------------------------
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? '';

if ($method === 'GET') {
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
            // Anzahl Mitglieder lesen (billig: peek auf "count":)
            $count = null;
            $fh = @fopen($f, 'r');
            if ($fh) {
                $head = fread($fh, 8192);
                fclose($fh);
                if (preg_match('/"count"\s*:\s*(\d+)/', $head, $m)) {
                    $count = (int) $m[1];
                }
            }
            $list[] = ['name' => $name, 'ts' => $iso, 'size' => $size, 'count' => $count];
        }
        echo json_encode(['snapshots' => $list], JSON_UNESCAPED_UNICODE);
        exit;
    }
    // --- Einzelnen Snapshot laden -------------------------------------------
    if ($action === 'snapshot') {
        $name = $_GET['name'] ?? '';
        // Strikte Validierung: nur unser Namens-Schema akzeptieren (kein Path-Traversal)
        if (!preg_match('/^snap-\d{8}-\d{6}\.json$/', $name)) {
            fail(400, 'Ungueltiger Snapshot-Name.');
        }
        $f = $snap_dir . '/' . $name;
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

    // Server-Zeitstempel einsetzen (UTC ISO-8601)
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
        // Rotation: nur die juengsten 10 behalten
        $snaps = glob($snap_dir . '/snap-*.json') ?: [];
        if (count($snaps) > 10) {
            sort($snaps); // alphabetisch = chronologisch
            $to_delete = array_slice($snaps, 0, count($snaps) - 10);
            foreach ($to_delete as $f) { @unlink($f); }
        }
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

    echo json_encode([
        'ok'        => true,
        'server_ts' => $payload['server_ts'],
        'count'     => $payload['count'],
        'bytes'     => $written,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

fail(405, 'Methode nicht erlaubt.');
