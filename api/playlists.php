<?php
// Playlist API: Kullanıcı playlistlerini yönetir
require_once __DIR__ . '/config.php';
setCorsHeaders();

$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];
$userId = isset($_GET['user_id']) ? intval($_GET['user_id']) : 0;

if ($userId < 1) {
    jsonError('Geçersiz kullanıcı.', 401);
}

function isSupporterForPlaylists($db, $userId) {
    if (isSuperAdminUser($db, $userId)) return true;

    try {
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
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    } catch (Throwable $e) {
        return false;
    }

    $stmt = $db->prepare('SELECT supporter_until FROM user_support_stats WHERE user_id = ? LIMIT 1');
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    if (!$row || empty($row['supporter_until'])) return false;
    return strtotime($row['supporter_until']) > time();
}

switch ($method) {
    case 'GET':
        // Tüm playlistleri getir
        $stmt = $db->prepare('SELECT * FROM user_playlists WHERE user_id = ? ORDER BY created_at DESC');
        $stmt->execute([$userId]);
        $playlists = $stmt->fetchAll();
        foreach ($playlists as &$pl) {
            $pl['items'] = json_decode($pl['items_json'], true) ?: [];
            unset($pl['items_json']);
        }
        jsonResponse(['playlists' => $playlists]);
        break;
    case 'POST':
        // Playlist oluştur veya güncelle
        $data = json_decode(file_get_contents('php://input'), true);
        $name = trim($data['name'] ?? '');
        $items = $data['items'] ?? [];
        $playlistId = isset($data['id']) ? intval($data['id']) : 0;
        if (!$name) jsonError('İsim gerekli.');
        $itemsJson = json_encode($items);
        if ($playlistId) {
            // Güncelle
            $stmt = $db->prepare('UPDATE user_playlists SET name = ?, items_json = ? WHERE id = ? AND user_id = ?');
            $stmt->execute([$name, $itemsJson, $playlistId, $userId]);
        } else {
            // Oluştur
            $isSupporter = isSupporterForPlaylists($db, $userId);
            if (!$isSupporter) {
                $countStmt = $db->prepare('SELECT COUNT(*) AS total FROM user_playlists WHERE user_id = ?');
                $countStmt->execute([$userId]);
                $countRow = $countStmt->fetch();
                $playlistCount = intval($countRow['total'] ?? 0);

                if ($playlistCount >= 1) {
                    jsonError('Normal üyeler en fazla 1 oynatma listesi oluşturabilir. Destekçi üyelik ile limit kalkar.', 403);
                }
            }

            $stmt = $db->prepare('INSERT INTO user_playlists (user_id, name, items_json) VALUES (?, ?, ?)');
            $stmt->execute([$userId, $name, $itemsJson]);
        }
        jsonResponse(['success' => true]);
        break;
    case 'DELETE':
        // Playlist sil
        $playlistId = isset($_GET['id']) ? intval($_GET['id']) : 0;
        if (!$playlistId) jsonError('Playlist ID gerekli.');
        $stmt = $db->prepare('DELETE FROM user_playlists WHERE id = ? AND user_id = ?');
        $stmt->execute([$playlistId, $userId]);
        jsonResponse(['success' => true]);
        break;
    default:
        jsonError('Geçersiz istek.', 405);
}
