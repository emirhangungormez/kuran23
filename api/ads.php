<?php
require_once __DIR__ . '/config.php';
setCorsHeaders();

$db = getDB();

const DAILY_REWARDED_LIMIT = 3;
const QUICK_PRO_MINUTES = 60;
const GOOGLE_SSV_KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';
const GOOGLE_KEYS_CACHE_TTL_SECONDS = 3600;

function isDevMockRewardAllowed()
{
    $host = strtolower($_SERVER['HTTP_HOST'] ?? '');
    $remote = $_SERVER['REMOTE_ADDR'] ?? '';
    return strpos($host, 'localhost') !== false
        || strpos($host, '127.0.0.1') !== false
        || $remote === '127.0.0.1'
        || $remote === '::1';
}

function ensureAdsSchema($db)
{
    $stmt = $db->query("SHOW COLUMNS FROM users LIKE 'pro_expires_at'");
    if (!$stmt->fetch()) {
        $db->exec("ALTER TABLE users ADD COLUMN pro_expires_at DATETIME NULL AFTER profile_icon");
    }

    $db->exec("
        CREATE TABLE IF NOT EXISTS rewarded_ad_callbacks (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            transaction_id VARCHAR(128) NOT NULL UNIQUE,
            user_id INT NOT NULL,
            reward_item VARCHAR(128) DEFAULT 'quick_pro_hour',
            reward_amount INT NOT NULL DEFAULT 1,
            callback_payload TEXT,
            key_id VARCHAR(64) NULL,
            signature TEXT NULL,
            verified TINYINT(1) NOT NULL DEFAULT 0,
            source VARCHAR(32) NOT NULL DEFAULT 'google_ssv',
            consumed_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user_created (user_id, created_at),
            INDEX idx_verified (verified),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $db->exec("
        CREATE TABLE IF NOT EXISTS user_daily_pro_ad_usage (
            user_id INT NOT NULL,
            usage_date DATE NOT NULL,
            used_count INT NOT NULL DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, usage_date),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $db->exec("
        CREATE TABLE IF NOT EXISTS user_pro_access_grants (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            callback_id BIGINT NULL,
            transaction_id VARCHAR(128) NULL,
            previous_expires_at DATETIME NULL,
            new_expires_at DATETIME NOT NULL,
            duration_minutes INT NOT NULL DEFAULT 60,
            source VARCHAR(32) NOT NULL DEFAULT 'rewarded_ad',
            granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_transaction_id (transaction_id),
            INDEX idx_user_granted (user_id, granted_at),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (callback_id) REFERENCES rewarded_ad_callbacks(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
}

function ensureUserExists($db, $userId)
{
    $stmt = $db->prepare("SELECT id FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    if (!$stmt->fetch()) {
        jsonError('Kullanıcı bulunamadı.', 404);
    }
}

function isSupporterActive($supporterUntil)
{
    if (!$supporterUntil) return false;
    return strtotime($supporterUntil) > time();
}

function getSupporterUntil($db, $userId)
{
    if (isSuperAdminUser($db, $userId)) {
        return SUPER_ADMIN_SUPPORTER_UNTIL;
    }

    $stmt = $db->prepare("SELECT supporter_until FROM user_support_stats WHERE user_id = ? LIMIT 1");
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    return $row['supporter_until'] ?? null;
}

function getDailyUsedCount($db, $userId, $date)
{
    $stmt = $db->prepare("SELECT used_count FROM user_daily_pro_ad_usage WHERE user_id = ? AND usage_date = ? LIMIT 1");
    $stmt->execute([$userId, $date]);
    $row = $stmt->fetch();
    return intval($row['used_count'] ?? 0);
}

function buildProStatusPayload($db, $userId)
{
    $stmt = $db->prepare("SELECT pro_expires_at FROM users WHERE id = ? LIMIT 1");
    $stmt->execute([$userId]);
    $row = $stmt->fetch();

    $proExpiresAt = $row['pro_expires_at'] ?? null;
    $proExpiresTs = $proExpiresAt ? strtotime($proExpiresAt) : 0;
    $now = time();
    $supporterUntil = getSupporterUntil($db, $userId);
    $supporterActive = isSupporterActive($supporterUntil);

    $quickProActive = !$supporterActive && $proExpiresTs > $now;
    $remainingSeconds = $quickProActive ? max(0, $proExpiresTs - $now) : 0;

    $today = date('Y-m-d');
    $usedToday = getDailyUsedCount($db, $userId, $today);
    $remainingToday = max(0, DAILY_REWARDED_LIMIT - $usedToday);

    return [
        'pro_expires_at' => $proExpiresAt,
        'is_quick_pro_active' => $quickProActive,
        'quick_pro_remaining_seconds' => $remainingSeconds,
        'daily_quick_pro_limit' => DAILY_REWARDED_LIMIT,
        'daily_quick_pro_used' => $usedToday,
        'daily_quick_pro_remaining' => $remainingToday,
        'is_supporter' => $supporterActive,
        'can_watch_for_quick_pro' => !$supporterActive && $remainingToday > 0,
    ];
}

function getRequestBody()
{
    $decoded = json_decode(file_get_contents('php://input'), true);
    return is_array($decoded) ? $decoded : [];
}

function base64UrlDecode($input)
{
    $remainder = strlen($input) % 4;
    if ($remainder > 0) {
        $input .= str_repeat('=', 4 - $remainder);
    }
    return base64_decode(strtr($input, '-_', '+/'));
}

function stripQueryParams($query, $keysToStrip)
{
    if (!$query) return '';
    $filtered = [];
    $parts = explode('&', $query);
    foreach ($parts as $part) {
        if ($part === '') continue;
        $eqPos = strpos($part, '=');
        $name = $eqPos === false ? $part : substr($part, 0, $eqPos);
        if (in_array($name, $keysToStrip, true)) {
            continue;
        }
        $filtered[] = $part;
    }
    return implode('&', $filtered);
}

function getCachedGoogleSsvKeys()
{
    $cacheFile = __DIR__ . '/import/admob_verifier_keys_cache.json';
    $fresh = false;

    if (file_exists($cacheFile)) {
        $age = time() - filemtime($cacheFile);
        if ($age <= GOOGLE_KEYS_CACHE_TTL_SECONDS) {
            $fresh = true;
        }
    }

    if ($fresh) {
        $cached = json_decode(file_get_contents($cacheFile), true);
        if (is_array($cached) && !empty($cached['keys'])) {
            return $cached;
        }
    }

    $ctx = stream_context_create([
        'http' => [
            'timeout' => 8,
            'ignore_errors' => true,
        ],
    ]);
    $raw = @file_get_contents(GOOGLE_SSV_KEYS_URL, false, $ctx);
    if (!$raw) {
        if (file_exists($cacheFile)) {
            $cached = json_decode(file_get_contents($cacheFile), true);
            if (is_array($cached) && !empty($cached['keys'])) {
                return $cached;
            }
        }
        return null;
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded) || empty($decoded['keys'])) {
        return null;
    }

    @file_put_contents($cacheFile, json_encode($decoded, JSON_UNESCAPED_UNICODE));
    return $decoded;
}

function findGooglePublicKeyPem($keyId)
{
    $payload = getCachedGoogleSsvKeys();
    if (!$payload || empty($payload['keys'])) return null;
    foreach ($payload['keys'] as $key) {
        if ((string)($key['keyId'] ?? '') === (string)$keyId) {
            return $key['pem'] ?? null;
        }
    }
    return null;
}

function verifyGoogleRewardedSsvSignature($rawQuery, $signature, $keyId)
{
    $message = stripQueryParams($rawQuery, ['signature', 'key_id']);
    if ($message === '') return false;

    $pem = findGooglePublicKeyPem($keyId);
    if (!$pem) return false;

    $decodedSignature = base64UrlDecode($signature);
    if (!$decodedSignature) return false;

    $ok = openssl_verify($message, $decodedSignature, $pem, OPENSSL_ALGO_SHA256);
    return $ok === 1;
}

function parseUserIdFromCallback($params)
{
    $direct = intval($params['user_id'] ?? 0);
    if ($direct > 0) return $direct;

    $customData = $params['custom_data'] ?? '';
    if (!$customData) return 0;

    $decodedJson = json_decode($customData, true);
    if (is_array($decodedJson) && intval($decodedJson['user_id'] ?? 0) > 0) {
        return intval($decodedJson['user_id']);
    }

    if (preg_match('/(?:^|[|;,])uid:(\d+)/', $customData, $matches)) {
        return intval($matches[1]);
    }

    return 0;
}

ensureAdsSchema($db);

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];
$body = getRequestBody();

if ($action === 'status' && $method === 'GET') {
    $userId = intval($_GET['user_id'] ?? 0);
    if ($userId < 1) jsonError('Geçersiz kullanıcı.', 401);
    ensureUserExists($db, $userId);

    $status = buildProStatusPayload($db, $userId);
    jsonResponse(['success' => true, 'status' => $status]);
}

if ($action === 'rewarded_callback' && $method === 'GET') {
    $signature = $_GET['signature'] ?? '';
    $keyId = $_GET['key_id'] ?? '';
    $transactionId = trim($_GET['transaction_id'] ?? '');
    $rewardItem = trim($_GET['reward_item'] ?? 'quick_pro_hour');
    $rewardAmount = intval($_GET['reward_amount'] ?? 1);
    $userId = parseUserIdFromCallback($_GET);

    if ($userId < 1) jsonError('Callback user_id bulunamadı.', 400);
    if ($transactionId === '') jsonError('transaction_id zorunludur.', 400);
    if ($rewardAmount < 1) $rewardAmount = 1;

    ensureUserExists($db, $userId);

    $rawQuery = $_SERVER['QUERY_STRING'] ?? '';
    $isVerified = verifyGoogleRewardedSsvSignature($rawQuery, $signature, $keyId);
    if (!$isVerified) {
        jsonError('SSV imza doğrulaması başarısız.', 403);
    }

    $payloadJson = json_encode($_GET, JSON_UNESCAPED_UNICODE);
    $stmt = $db->prepare("
        INSERT INTO rewarded_ad_callbacks (
            transaction_id, user_id, reward_item, reward_amount, callback_payload, key_id, signature, verified, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'google_ssv')
        ON DUPLICATE KEY UPDATE
            callback_payload = VALUES(callback_payload),
            key_id = VALUES(key_id),
            signature = VALUES(signature),
            verified = VALUES(verified)
    ");
    $stmt->execute([$transactionId, $userId, $rewardItem, $rewardAmount, $payloadJson, $keyId, $signature]);

    jsonResponse(['success' => true, 'message' => 'Reward callback doğrulandı.']);
}

if ($action === 'mock_reward' && $method === 'POST') {
    if (!isDevMockRewardAllowed()) {
        jsonError('Mock reward kapalı.', 403);
    }

    $userId = intval($_GET['user_id'] ?? ($body['user_id'] ?? 0));
    if ($userId < 1) jsonError('Geçersiz kullanıcı.', 401);
    ensureUserExists($db, $userId);

    $transactionId = 'mock_' . bin2hex(random_bytes(10));
    $payloadJson = json_encode(['user_id' => $userId, 'mode' => 'mock'], JSON_UNESCAPED_UNICODE);
    $stmt = $db->prepare("
        INSERT INTO rewarded_ad_callbacks (
            transaction_id, user_id, reward_item, reward_amount, callback_payload, verified, source
        ) VALUES (?, ?, 'quick_pro_hour', 1, ?, 1, 'mock')
    ");
    $stmt->execute([$transactionId, $userId, $payloadJson]);

    jsonResponse([
        'success' => true,
        'transaction_id' => $transactionId,
        'message' => 'Mock reward kaydı oluşturuldu.'
    ]);
}

if ($action === 'grant_hourly_access' && $method === 'POST') {
    $userId = intval($_GET['user_id'] ?? ($body['user_id'] ?? 0));
    $transactionId = trim($body['transaction_id'] ?? '');
    if ($userId < 1) jsonError('Geçersiz kullanıcı.', 401);
    if ($transactionId === '') jsonError('transaction_id zorunludur.', 400);
    ensureUserExists($db, $userId);

    try {
        $db->beginTransaction();

        $userStmt = $db->prepare("SELECT id, pro_expires_at FROM users WHERE id = ? LIMIT 1 FOR UPDATE");
        $userStmt->execute([$userId]);
        $userRow = $userStmt->fetch();
        if (!$userRow) {
            $db->rollBack();
            jsonError('Kullanıcı bulunamadı.', 404);
        }

        $supportStmt = $db->prepare("SELECT supporter_until FROM user_support_stats WHERE user_id = ? LIMIT 1 FOR UPDATE");
        $supportStmt->execute([$userId]);
        $supportRow = $supportStmt->fetch();
        $supporterUntil = $supportRow['supporter_until'] ?? null;
        if (isSupporterActive($supporterUntil)) {
            $db->rollBack();
            jsonError('Kalıcı Pro/Destekçi üyelerde reklamla saatlik erişim kullanılmaz.', 409);
        }

        $today = date('Y-m-d');
        $insertDaily = $db->prepare("INSERT IGNORE INTO user_daily_pro_ad_usage (user_id, usage_date, used_count) VALUES (?, ?, 0)");
        $insertDaily->execute([$userId, $today]);

        $dailyStmt = $db->prepare("SELECT used_count FROM user_daily_pro_ad_usage WHERE user_id = ? AND usage_date = ? LIMIT 1 FOR UPDATE");
        $dailyStmt->execute([$userId, $today]);
        $dailyRow = $dailyStmt->fetch();
        $usedCount = intval($dailyRow['used_count'] ?? 0);

        if ($usedCount >= DAILY_REWARDED_LIMIT) {
            $db->rollBack();
            jsonError('Günlük reklam limiti doldu (3/3).', 429);
        }

        $callbackStmt = $db->prepare("
            SELECT id, verified, consumed_at, reward_item
            FROM rewarded_ad_callbacks
            WHERE transaction_id = ? AND user_id = ?
            LIMIT 1
            FOR UPDATE
        ");
        $callbackStmt->execute([$transactionId, $userId]);
        $callback = $callbackStmt->fetch();

        if (!$callback || intval($callback['verified']) !== 1) {
            $db->rollBack();
            jsonError('Doğrulanmış reklam ödülü bulunamadı.', 403);
        }
        if (!empty($callback['consumed_at'])) {
            $db->rollBack();
            jsonError('Bu reklam ödülü daha önce kullanılmış.', 409);
        }

        $nowTs = time();
        $currentExpiresAt = $userRow['pro_expires_at'] ?? null;
        $currentTs = $currentExpiresAt ? strtotime($currentExpiresAt) : 0;
        $baseTs = ($currentTs > $nowTs) ? $currentTs : $nowTs;
        $newTs = $baseTs + (QUICK_PRO_MINUTES * 60);
        $newExpiresAt = date('Y-m-d H:i:s', $newTs);

        $updateUser = $db->prepare("UPDATE users SET pro_expires_at = ? WHERE id = ?");
        $updateUser->execute([$newExpiresAt, $userId]);

        $consumeCallback = $db->prepare("UPDATE rewarded_ad_callbacks SET consumed_at = NOW() WHERE id = ?");
        $consumeCallback->execute([$callback['id']]);

        $updateDaily = $db->prepare("UPDATE user_daily_pro_ad_usage SET used_count = used_count + 1 WHERE user_id = ? AND usage_date = ?");
        $updateDaily->execute([$userId, $today]);

        $insertGrant = $db->prepare("
            INSERT INTO user_pro_access_grants (
                user_id, callback_id, transaction_id, previous_expires_at, new_expires_at, duration_minutes, source
            ) VALUES (?, ?, ?, ?, ?, ?, 'rewarded_ad')
        ");
        $insertGrant->execute([$userId, $callback['id'], $transactionId, $currentExpiresAt, $newExpiresAt, QUICK_PRO_MINUTES]);

        $db->commit();

        $status = buildProStatusPayload($db, $userId);
        jsonResponse([
            'success' => true,
            'message' => 'Teşekkürler, 1 saatlik Pro süreniz başladı!',
            'status' => $status
        ]);
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        jsonError('Saatlik erişim verilemedi: ' . $e->getMessage(), 500);
    }
}

jsonError('Geçersiz istek.', 405);
