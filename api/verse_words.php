<?php
// GET api/verse_words.php?surah=2&ayah=255 — Word-by-word analysis
require_once __DIR__ . '/config.php';
setCorsHeaders();

$surahId = intval($_GET['surah'] ?? 0);
$ayahNo = intval($_GET['ayah'] ?? 0);

if ($surahId < 1 || $surahId > 114) jsonError('Invalid surah ID.');
if ($ayahNo < 1) jsonError('Invalid ayah number.');

$db = getDB();

// Get verse
$stmt = $db->prepare('SELECT id, verse_text FROM verses WHERE surah_id = ? AND verse_number = ?');
$stmt->execute([$surahId, $ayahNo]);
$verse = $stmt->fetch();

if (!$verse) jsonError('Verse not found.', 404);

// Get words with roots
$stmt = $db->prepare('
    SELECT w.id, w.sort_number, w.arabic, w.transcription_tr, w.transcription_en, 
           w.translation_tr, w.translation_en,
           r.id AS root_id, r.latin AS root_latin, r.arabic AS root_arabic, 
           r.transcription AS root_transcription, r.mean_tr AS root_mean_tr, r.mean_en AS root_mean_en
    FROM verse_words w
    LEFT JOIN roots r ON r.id = w.root_id
    WHERE w.verse_id = ?
    ORDER BY w.sort_number
');
$stmt->execute([$verse['id']]);
$words = $stmt->fetchAll();

$result = array_map(function($w) {
    return [
        'id' => (int)$w['id'],
        'sort_number' => (int)$w['sort_number'],
        'arabic' => $w['arabic'],
        'transcription_tr' => $w['transcription_tr'],
        'transcription_en' => $w['transcription_en'],
        'translation_tr' => $w['translation_tr'],
        'translation_en' => $w['translation_en'],
        'root' => $w['root_id'] ? [
            'id' => (int)$w['root_id'],
            'latin' => $w['root_latin'],
            'arabic' => $w['root_arabic'],
            'transcription' => $w['root_transcription'],
            'mean_tr' => $w['root_mean_tr'],
            'mean_en' => $w['root_mean_en'],
        ] : null,
    ];
}, $words);

jsonResponse(['data' => $result]);
