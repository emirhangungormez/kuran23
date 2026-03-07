<?php
// Güvenlik katmanını başlat
require_once __DIR__ . '/auth_middleware.php';

// Veritabanı bağlantı bilgileriation
// Update these values for your DirectAdmin hosting (guzel.net)

define('DB_HOST', 'localhost');
define('DB_NAME', 'kuran_db');
define('DB_USER', 'root');          // DirectAdmin'de DB kullanıcı adınız
define('DB_PASS', '');              // DirectAdmin'de DB şifreniz
define('DB_CHARSET', 'utf8mb4');

// Diyanet API configuration
define('DIYANET_API_URL', 'https://acikkaynakkuran-dev.diyanet.gov.tr/api/v1');
define('DIYANET_API_KEY', '599|AMe8IvJ6tiFTZnC9epxvkZAVLwvjL3xLpaMzV1ec0fec7362');

// Açık Kuran API base URL
define('ACIKKURAN_API', 'https://api.acikkuran.com');

// Default author ID (Diyanet İşleri - Kur'an-ı Kerim Türkçe Meali)
define('DEFAULT_AUTHOR', 11);
define('SUPER_ADMIN_USERNAMES', ['emirhangungormez', 'emirhangungormezpro']);
define('SUPER_ADMIN_SUPPORTER_UNTIL', '2099-12-31 23:59:59');
define('AUTH_TOKEN_SECRET', getenv('AUTH_TOKEN_SECRET') ?: 'kuran23_super_secret_change_me_2026');
define('AUTH_TOKEN_TTL', 60 * 60 * 24 * 14); // 14 gun

// CORS headers for React dev
function setCorsHeaders() {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}

// Get PDO connection
function getDB() {
    static $pdo = null;
    if ($pdo === null) {
        try {
            $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
            exit;
        }
    }
    return $pdo;
}

function isSuperAdminUser($db, $userId) {
    $id = intval($userId);
    if ($id < 1) return false;

    $stmt = $db->prepare("SELECT username FROM users WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) return false;

    $username = strtolower(trim($row['username'] ?? ''));
    foreach (SUPER_ADMIN_USERNAMES as $allowed) {
        if ($username === strtolower(trim($allowed))) {
            return true;
        }
    }
    return false;
}

function base64UrlEncode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64UrlDecode($data) {
    $padding = strlen($data) % 4;
    if ($padding > 0) {
        $data .= str_repeat('=', 4 - $padding);
    }
    return base64_decode(strtr($data, '-_', '+/'));
}

function issueAuthToken($userId, $username, $ttl = AUTH_TOKEN_TTL) {
    $now = time();
    $payload = [
        'uid' => intval($userId),
        'usr' => strtolower(trim((string)$username)),
        'iat' => $now,
        'exp' => $now + max(300, intval($ttl)),
        'rnd' => bin2hex(random_bytes(8))
    ];

    $payloadJson = json_encode($payload, JSON_UNESCAPED_UNICODE);
    $payloadB64 = base64UrlEncode($payloadJson);
    $sig = hash_hmac('sha256', $payloadB64, AUTH_TOKEN_SECRET, true);
    $sigB64 = base64UrlEncode($sig);

    return $payloadB64 . '.' . $sigB64;
}

function parseAuthToken($token) {
    if (!$token || !is_string($token) || strpos($token, '.') === false) {
        return null;
    }

    [$payloadB64, $sigB64] = explode('.', $token, 2);
    if (!$payloadB64 || !$sigB64) return null;

    $expectedSig = base64UrlEncode(hash_hmac('sha256', $payloadB64, AUTH_TOKEN_SECRET, true));
    if (!hash_equals($expectedSig, $sigB64)) {
        return null;
    }

    $payloadJson = base64UrlDecode($payloadB64);
    $payload = json_decode($payloadJson, true);
    if (!is_array($payload)) return null;
    if (!isset($payload['uid'], $payload['usr'], $payload['exp'])) return null;
    if (intval($payload['exp']) < time()) return null;

    return $payload;
}

function getAuthorizationTokenFromHeaders() {
    $headers = function_exists('apache_request_headers') ? apache_request_headers() : [];
    $authHeader = '';
    if (isset($headers['Authorization'])) {
        $authHeader = $headers['Authorization'];
    } elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    }

    if (!preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
        return null;
    }
    return $matches[1];
}

function getAuthenticatedUser($db) {
    $token = getAuthorizationTokenFromHeaders();
    $payload = parseAuthToken($token);
    if (!$payload) return null;

    $uid = intval($payload['uid']);
    if ($uid < 1) return null;

    $stmt = $db->prepare("SELECT id, username, full_name, email, profile_icon FROM users WHERE id = ? LIMIT 1");
    $stmt->execute([$uid]);
    $user = $stmt->fetch();
    if (!$user) return null;

    $dbUsername = strtolower(trim($user['username'] ?? ''));
    if ($dbUsername !== strtolower(trim((string)$payload['usr']))) {
        return null;
    }

    $user['id'] = intval($user['id']);
    return $user;
}

function requireAuthenticatedUser($db) {
    $user = getAuthenticatedUser($db);
    if (!$user) {
        jsonError('Yetkisiz istek.', 401);
    }
    return $user;
}

function requireSuperAdminUser($db) {
    $user = requireAuthenticatedUser($db);
    if (!isSuperAdminUser($db, $user['id'])) {
        jsonError('Bu islem icin super admin yetkisi gerekir.', 403);
    }
    return $user;
}

// Send JSON response
function jsonResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

// Send error
function jsonError($message, $code = 400) {
    jsonResponse(['error' => $message], $code);
}
