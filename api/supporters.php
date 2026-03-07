<?php
require_once __DIR__ . '/config.php';
setCorsHeaders();

$db = getDB();
const SUPPORT_UNLOCK_ADS = 50;

function ensureSupportStatsTable($db)
{
    $db->exec("
        CREATE TABLE IF NOT EXISTS user_support_stats (
            user_id INT PRIMARY KEY,
            ads_enabled TINYINT(1) NOT NULL DEFAULT 0,
            ads_watched INT NOT NULL DEFAULT 0,
            usage_seconds BIGINT NOT NULL DEFAULT 0,
            supporter_until DATETIME NULL,
            milestone_count INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_ads (ads_watched),
            INDEX idx_usage (usage_seconds),
            INDEX idx_supporter_until (supporter_until)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
}

function normalizeInt($value, $default = 0)
{
    $n = intval($value ?? $default);
    return $n < 0 ? 0 : $n;
}

function ensureUserExists($db, $userId)
{
    $stmt = $db->prepare("SELECT id FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    if (!$stmt->fetch()) {
        jsonError('Kullanıcı bulunamadı.', 404);
    }
}

function ensureSupportRow($db, $userId)
{
    $stmt = $db->prepare("INSERT IGNORE INTO user_support_stats (user_id) VALUES (?)");
    $stmt->execute([$userId]);

    $stmt = $db->prepare("SELECT * FROM user_support_stats WHERE user_id = ?");
    $stmt->execute([$userId]);
    return $stmt->fetch();
}

function enforceSuperAdminSupporter($db, $userId)
{
    if (!isSuperAdminUser($db, $userId)) return;

    $stmt = $db->prepare("
        INSERT INTO user_support_stats (user_id, supporter_until)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE supporter_until = VALUES(supporter_until)
    ");
    $stmt->execute([$userId, SUPER_ADMIN_SUPPORTER_UNTIL]);
}

function isSupporterActive($supporterUntil)
{
    if (!$supporterUntil) return false;
    return strtotime($supporterUntil) > time();
}

function buildStatsPayload($row)
{
    $adsWatched = normalizeInt($row['ads_watched'] ?? 0);
    $cycleAds = $adsWatched % SUPPORT_UNLOCK_ADS;
    $remainingToNext = $cycleAds === 0 ? SUPPORT_UNLOCK_ADS : (SUPPORT_UNLOCK_ADS - $cycleAds);
    $supporterUntil = $row['supporter_until'] ?? null;
    $isSupporter = isSupporterActive($supporterUntil);

    return [
        'ads_enabled' => (bool)intval($row['ads_enabled'] ?? 0),
        'ads_watched' => $adsWatched,
        'usage_seconds' => normalizeInt($row['usage_seconds'] ?? 0),
        'supporter_until' => $supporterUntil,
        'is_supporter' => $isSupporter,
        'membership_type' => $isSupporter ? 'supporter' : 'normal',
        'milestone_count' => normalizeInt($row['milestone_count'] ?? 0),
        'cycle_ads' => $cycleAds,
        'remaining_to_next_unlock' => $remainingToNext,
    ];
}

function extendSupporterIfNeeded($db, $userId)
{
    $row = ensureSupportRow($db, $userId);
    $adsWatched = normalizeInt($row['ads_watched'] ?? 0);
    $milestoneCount = normalizeInt($row['milestone_count'] ?? 0);
    $newMilestoneCount = intdiv($adsWatched, SUPPORT_UNLOCK_ADS);

    if ($newMilestoneCount <= $milestoneCount) {
        return ensureSupportRow($db, $userId);
    }

    $milestoneDelta = $newMilestoneCount - $milestoneCount;
    $currentUntil = $row['supporter_until'] ? strtotime($row['supporter_until']) : 0;
    $baseTs = $currentUntil > time() ? $currentUntil : time();
    $extendedTs = strtotime('+' . (30 * $milestoneDelta) . ' days', $baseTs);
    $newUntil = date('Y-m-d H:i:s', $extendedTs);

    $stmt = $db->prepare("
        UPDATE user_support_stats
        SET supporter_until = ?, milestone_count = ?
        WHERE user_id = ?
    ");
    $stmt->execute([$newUntil, $newMilestoneCount, $userId]);

    return ensureSupportRow($db, $userId);
}

ensureSupportStatsTable($db);

$action = $_GET['action'] ?? 'my';
$method = $_SERVER['REQUEST_METHOD'];

$body = [];
if ($method === 'POST') {
    $decoded = json_decode(file_get_contents('php://input'), true);
    $body = is_array($decoded) ? $decoded : [];
}

$userId = intval($_GET['user_id'] ?? ($body['user_id'] ?? 0));

if ($action === 'leaderboard' && $method === 'GET') {
    $sortBy = $_GET['by'] ?? 'ads';
    $limit = intval($_GET['limit'] ?? 50);
    if ($limit < 10) $limit = 10;
    if ($limit > 100) $limit = 100;

    $orderColumn = $sortBy === 'usage' ? 's.usage_seconds' : 's.ads_watched';
    $whereClause = $sortBy === 'usage'
        ? 's.usage_seconds > 0'
        : 's.ads_watched > 0';

    $sql = "
        SELECT
            u.id,
            u.full_name,
            u.profile_icon,
            s.ads_watched,
            s.usage_seconds,
            s.supporter_until
        FROM user_support_stats s
        INNER JOIN users u ON u.id = s.user_id
        WHERE $whereClause
        ORDER BY $orderColumn DESC, s.ads_watched DESC, u.id ASC
        LIMIT $limit
    ";
    $rows = $db->query($sql)->fetchAll();

    $ranked = array_map(function ($row, $index) {
        $supporterUntil = $row['supporter_until'] ?? null;
        return [
            'rank' => $index + 1,
            'user_id' => intval($row['id']),
            'full_name' => $row['full_name'],
            'profile_icon' => $row['profile_icon'],
            'ads_watched' => normalizeInt($row['ads_watched'] ?? 0),
            'usage_seconds' => normalizeInt($row['usage_seconds'] ?? 0),
            'supporter_until' => $supporterUntil,
            'is_supporter' => isSupporterActive($supporterUntil),
        ];
    }, $rows, array_keys($rows));

    jsonResponse(['success' => true, 'leaderboard' => $ranked]);
}

if ($action === 'contributors' && $method === 'GET') {
    $limit = intval($_GET['limit'] ?? 120);
    if ($limit < 20) $limit = 20;
    if ($limit > 300) $limit = 300;

    $sql = "
        SELECT
            u.id,
            u.full_name,
            u.profile_icon,
            s.supporter_until
        FROM user_support_stats s
        INNER JOIN users u ON u.id = s.user_id
        WHERE s.ads_watched > 0
          AND u.full_name IS NOT NULL
          AND TRIM(u.full_name) <> ''
          AND LOWER(TRIM(u.full_name)) <> LOWER(TRIM(u.username))
        ORDER BY s.updated_at DESC, u.id ASC
        LIMIT $limit
    ";
    $rows = $db->query($sql)->fetchAll();

    $contributors = array_map(function ($row) {
        $supporterUntil = $row['supporter_until'] ?? null;
        return [
            'user_id' => intval($row['id']),
            'full_name' => $row['full_name'],
            'profile_icon' => $row['profile_icon'],
            'supporter_until' => $supporterUntil,
            'is_supporter' => isSupporterActive($supporterUntil),
        ];
    }, $rows);

    jsonResponse(['success' => true, 'contributors' => $contributors]);
}

if ($userId < 1) {
    jsonError('Geçersiz kullanıcı.', 401);
}

ensureUserExists($db, $userId);
enforceSuperAdminSupporter($db, $userId);

if ($action === 'my' && $method === 'GET') {
    $row = ensureSupportRow($db, $userId);
    jsonResponse(['success' => true, 'stats' => buildStatsPayload($row)]);
}

if ($action === 'toggle_ads' && $method === 'POST') {
    $enabled = !empty($body['enabled']) ? 1 : 0;
    $stmt = $db->prepare("UPDATE user_support_stats SET ads_enabled = ? WHERE user_id = ?");
    $stmt->execute([$enabled, $userId]);
    $row = ensureSupportRow($db, $userId);
    jsonResponse(['success' => true, 'stats' => buildStatsPayload($row)]);
}

if ($action === 'watch_ad' && $method === 'POST') {
    $stmt = $db->prepare("
        UPDATE user_support_stats
        SET ads_watched = ads_watched + 1
        WHERE user_id = ?
    ");
    $stmt->execute([$userId]);

    $row = extendSupporterIfNeeded($db, $userId);
    jsonResponse(['success' => true, 'stats' => buildStatsPayload($row)]);
}

if ($action === 'sync_usage' && $method === 'POST') {
    $usageSeconds = normalizeInt($body['usage_seconds'] ?? 0);

    $stmt = $db->prepare("SELECT usage_seconds FROM user_support_stats WHERE user_id = ?");
    $stmt->execute([$userId]);
    $current = $stmt->fetch();
    $currentSeconds = normalizeInt($current['usage_seconds'] ?? 0);
    $nextSeconds = max($currentSeconds, $usageSeconds);

    $stmt = $db->prepare("UPDATE user_support_stats SET usage_seconds = ? WHERE user_id = ?");
    $stmt->execute([$nextSeconds, $userId]);
    $row = ensureSupportRow($db, $userId);

    jsonResponse(['success' => true, 'stats' => buildStatsPayload($row)]);
}

jsonError('Geçersiz istek.', 405);
