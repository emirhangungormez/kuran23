<?php
// GET api/surah.php?id=2 — Returns surah detail with all verses
require_once __DIR__ . '/config.php';
setCorsHeaders();

$surahId = intval($_GET['id'] ?? 0);
if ($surahId < 1 || $surahId > 114) {
    jsonError('Invalid surah ID. Must be between 1 and 114.');
}

$authorId = intval($_GET['author'] ?? DEFAULT_AUTHOR);

$db = getDB();

// Surah info
$stmt = $db->prepare('SELECT * FROM surahs WHERE id = ?');
$stmt->execute([$surahId]);
$surah = $stmt->fetch();

if (!$surah) {
    jsonError('Surah not found.', 404);
}

// Verses with translation
$stmt = $db->prepare('
    SELECT v.id, v.verse_number, v.verse_text, v.verse_simplified, v.transcription, v.transcription_en, v.page, v.juz_number,
           t.id AS translation_id, t.text AS translation_text, t.author_id
    FROM verses v
    LEFT JOIN translations t ON t.verse_id = v.id AND t.author_id = ?
    WHERE v.surah_id = ?
    ORDER BY v.verse_number
');
$stmt->execute([$authorId, $surahId]);
$rows = $stmt->fetchAll();

$verses = [];
foreach ($rows as $r) {
    $verses[] = [
        'id' => (int)$r['id'],
        'verse_number' => (int)$r['verse_number'],
        'verse' => $r['verse_text'],
        'verse_simplified' => $r['verse_simplified'],
        'transcription' => $r['transcription'],
        'transcription_en' => $r['transcription_en'],
        'page' => (int)$r['page'],
        'juz_number' => (int)$r['juz_number'],
        'translation' => $r['translation_id'] ? [
            'id' => (int)$r['translation_id'],
            'text' => $r['translation_text'],
            'author_id' => (int)$r['author_id'],
        ] : null,
    ];
}

$surah['verses'] = $verses;
jsonResponse(['data' => $surah]);
