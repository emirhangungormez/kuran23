<?php
// GET api/root.php?latin=Hmd OR api/root.php?id=3 — Root word detail
require_once __DIR__ . '/config.php';
setCorsHeaders();

$db = getDB();

$rootId = intval($_GET['id'] ?? 0);
$latin = trim($_GET['latin'] ?? '');

if ($rootId > 0) {
    $stmt = $db->prepare('SELECT * FROM roots WHERE id = ?');
    $stmt->execute([$rootId]);
} elseif ($latin !== '') {
    $stmt = $db->prepare('SELECT * FROM roots WHERE latin = ?');
    $stmt->execute([$latin]);
} else {
    jsonError('Provide either ?id= or ?latin= parameter.');
}

$root = $stmt->fetch();
if (!$root) jsonError('Root not found.', 404);

// Count usages
$stmt = $db->prepare('SELECT COUNT(*) as count FROM verse_words WHERE root_id = ?');
$stmt->execute([$root['id']]);
$usage = $stmt->fetch();

// Sample verses using this root
$stmt = $db->prepare('
    SELECT DISTINCT v.surah_id, v.verse_number, v.verse_text, s.name AS surah_name, w.arabic, w.translation_tr
    FROM verse_words w
    JOIN verses v ON v.id = w.verse_id
    JOIN surahs s ON s.id = v.surah_id
    WHERE w.root_id = ?
    ORDER BY v.surah_id, v.verse_number
    LIMIT 10
');
$stmt->execute([$root['id']]);
$sampleVerses = $stmt->fetchAll();

jsonResponse([
    'data' => [
        'id' => (int)$root['id'],
        'latin' => $root['latin'],
        'arabic' => $root['arabic'],
        'transcription' => $root['transcription'],
        'mean_tr' => $root['mean_tr'],
        'mean_en' => $root['mean_en'],
        'usage_count' => (int)$usage['count'],
        'sample_verses' => $sampleVerses,
    ]
]);
