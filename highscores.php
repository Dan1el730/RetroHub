<?php
// Simple highscores API for local XAMPP development.
// GET returns JSON list, POST appends a score.
// Stores data in ./data/highscores.json (auto-created).
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    // CORS preflight
    http_response_code(204);
    exit;
}

$basedir = __DIR__;
$dataDir = $basedir . DIRECTORY_SEPARATOR . 'data';
$dataFile = $dataDir . DIRECTORY_SEPARATOR . 'highscores.json';

// Ensure data directory exists
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}

// Helper: read stored scores
function read_scores($path) {
    if (!file_exists($path)) return [];
    $json = @file_get_contents($path);
    $arr = json_decode($json, true);
    if (!is_array($arr)) return [];
    // reindex to ensure numeric array (prevents accidental key-based replacement)
    return array_values($arr);
}

// Helper: write scores with locking
function write_scores($path, $arr) {
    $tmp = $path . '.tmp';
    $fp = fopen($tmp, 'c');
    if (!$fp) return false;
    if (!flock($fp, LOCK_EX)) { fclose($fp); return false; }
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode(array_values($arr), JSON_PRETTY_PRINT));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    rename($tmp, $path);
    return true;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 10;
    if ($limit <= 0) $limit = 10;
    $scores = read_scores($dataFile);
    // sort desc by score then timestamp
    usort($scores, function($a, $b) {
        if ($a['score'] === $b['score']) return $b['ts'] <=> $a['ts'];
        return $b['score'] <=> $a['score'];
    });
    $out = array_slice($scores, 0, $limit);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['status' => 'ok', 'count' => count($out), 'scores' => $out]);
    exit;
}

if ($method === 'POST') {
    $contentType = isset($_SERVER['CONTENT_TYPE']) ? strtolower($_SERVER['CONTENT_TYPE']) : '';
    $input = [];
    if (strpos($contentType, 'application/json') !== false) {
        $raw = file_get_contents('php://input');
        $input = json_decode($raw, true) ?: [];
    } else {
        // form-encoded fallback
        $input['name'] = $_POST['name'] ?? null;
        $input['score'] = isset($_POST['score']) ? $_POST['score'] : null;
    }

    // Basic validation & sanitization
    $name = isset($input['name']) ? trim((string)$input['name']) : '';
    $score = isset($input['score']) ? intval($input['score']) : null;

    if ($name === '' || $score === null || !is_numeric($score)) {
        http_response_code(400);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['status' => 'error', 'message' => 'Invalid payload. Expect {name, score}.']);
        exit;
    }

    // clamp name length
    $name = mb_substr($name, 0, 32);

    // Read, append, sort, trim
    $scores = read_scores($dataFile);
    $entry = [
        'name' => htmlspecialchars($name, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'),
        'score' => intval($score),
        'ts' => time()
    ];

    // If the player already exists, update only if new score is higher.
    $found = false;
    foreach ($scores as $idx => $s) {
        if (isset($s['name']) && $s['name'] === $entry['name']) {
            $found = true;
            if ($entry['score'] > intval($s['score'])) {
                $scores[$idx]['score'] = $entry['score'];
                $scores[$idx]['ts'] = $entry['ts'];
            }
            break;
        }
    }
    if (!$found) {
        $scores[] = $entry;
    }

    // sort and trim
    usort($scores, function($a, $b) {
        if ($a['score'] === $b['score']) return $b['ts'] <=> $a['ts'];
        return $b['score'] <=> $a['score'];
    });

    $scores = array_slice($scores, 0, 200);

    $ok = write_scores($dataFile, $scores);
    if (!$ok) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['status' => 'error', 'message' => 'Failed to write scores.']);
        exit;
    }

    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['status' => 'ok', 'message' => 'Score saved.', 'entry' => $entry]);
    exit;
}

// Unsupported method
http_response_code(405);
header('Allow: GET, POST, OPTIONS');
header('Content-Type: application/json; charset=utf-8');
echo json_encode(['status' => 'error', 'message' => 'Method not allowed.']);
exit;
?>
