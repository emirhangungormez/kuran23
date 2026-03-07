<?php
require_once 'config.php';
setCorsHeaders();

$db = getDB();
$action = $_GET['action'] ?? '';
$userId = (int)($_GET['user_id'] ?? 0);

if (!$userId) {
    jsonError('Kullanıcı kimliği gerekli.');
}

if ($action === 'sync_settings' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $settingsJson = json_encode($data['settings'] ?? []);

    $stmt = $db->prepare("INSERT INTO user_settings (user_id, settings_json) VALUES (?, ?) 
                          ON DUPLICATE KEY UPDATE settings_json = VALUES(settings_json)");
    $stmt->execute([$userId, $settingsJson]);
    
    jsonResponse(['success' => true]);
}

if ($action === 'get_userdata') {
    // Get Settings
    $stmt = $db->prepare("SELECT settings_json FROM user_settings WHERE user_id = ?");
    $stmt->execute([$userId]);
    $settingsRow = $stmt->fetch();
    $settings = $settingsRow ? json_decode($settingsRow['settings_json'], true) : [];

    // Get Bookmarks
    $stmt = $db->prepare("SELECT item_id, item_type, surah_id, verse_number, metadata FROM user_bookmarks WHERE user_id = ?");
    $stmt->execute([$userId]);
    $bookmarksRows = $stmt->fetchAll();
    
    $bookmarks = [
        'surahs' => [],
        'verses' => [],
        'lastPage' => null,
        'stringBookmark' => null
    ];

    foreach ($bookmarksRows as $row) {
        $meta = json_decode($row['metadata'], true);
        if ($row['item_type'] === 'surah') {
            $bookmarks['surahs'][] = $meta;
        } elseif ($row['item_type'] === 'verse') {
            $bookmarks['verses'][] = $meta;
        } elseif ($row['item_type'] === 'last_read') {
            $bookmarks['lastPage'] = $meta;
        } elseif ($row['item_type'] === 'string_bookmark') {
            $bookmarks['stringBookmark'] = $meta;
        }
    }

    // Get Notes
    $stmt = $db->prepare("SELECT verse_id, content FROM user_notes WHERE user_id = ?");
    $stmt->execute([$userId]);
    $notes = $stmt->fetchAll();

    jsonResponse([
        'success' => true,
        'settings' => $settings,
        'bookmarks' => $bookmarks,
        'notes' => $notes
    ]);
}

if ($action === 'toggle_bookmark' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $itemId = $data['item_id'];
    $itemType = $data['item_type'];
    $metadata = json_encode($data['metadata'] ?? []);
    
    // Check if exists
    $stmt = $db->prepare("SELECT id FROM user_bookmarks WHERE user_id = ? AND item_id = ? AND item_type = ?");
    $stmt->execute([$userId, $itemId, $itemType]);
    $exists = $stmt->fetch();

    if ($exists) {
        $stmt = $db->prepare("DELETE FROM user_bookmarks WHERE id = ?");
        $stmt->execute([$exists['id']]);
        jsonResponse(['success' => true, 'status' => 'removed']);
    } else {
        $stmt = $db->prepare("INSERT INTO user_bookmarks (user_id, item_id, item_type, metadata) VALUES (?, ?, ?, ?)");
        $stmt->execute([$userId, $itemId, $itemType, $metadata]);
        jsonResponse(['success' => true, 'status' => 'added']);
    }
}

if ($action === 'save_note' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $verseId = (int)$data['verse_id'];
    $content = $data['content'];

    $stmt = $db->prepare("INSERT INTO user_notes (user_id, verse_id, content) VALUES (?, ?, ?) 
                          ON DUPLICATE KEY UPDATE content = VALUES(content)");
    $stmt->execute([$userId, $verseId, $content]);
    
    jsonResponse(['success' => true]);
}

jsonError('Geçersiz istek.');
