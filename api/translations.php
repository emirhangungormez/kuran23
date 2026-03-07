<?php
// GET api/translations.php?surah=2&ayah=255 — Returns all translations of a verse
require_once __DIR__ . '/config.php';
setCorsHeaders();

$surahId = intval($_GET['surah'] ?? 0);
$ayahNo = intval($_GET['ayah'] ?? 0);

if ($surahId < 1 || $surahId > 114) jsonError('Invalid surah ID.');
if ($ayahNo < 1) jsonError('Invalid ayah number.');

$db = getDB();

// Get verse ID
$stmt = $db->prepare('SELECT id FROM verses WHERE surah_id = ? AND verse_number = ?');
$stmt->execute([$surahId, $ayahNo]);
$verse = $stmt->fetch();

if (!$verse) jsonError('Verse not found.', 404);

// Get all translations
$stmt = $db->prepare('
    SELECT t.id, t.text, a.id AS author_id, a.name AS author_name, a.description AS author_description, a.language
    FROM translations t
    JOIN authors a ON a.id = t.author_id
    WHERE t.verse_id = ?
    ORDER BY a.language, a.name
');
$stmt->execute([$verse['id']]);
$translations = $stmt->fetchAll();

// Attach footnotes
foreach ($translations as &$t) {
    $stmt = $db->prepare('SELECT id, number, text FROM footnotes WHERE translation_id = ? ORDER BY number');
    $stmt->execute([$t['id']]);
    $t['footnotes'] = $stmt->fetchAll();
    $t['author'] = [
        'id' => (int)$t['author_id'],
        'name' => $t['author_name'],
        'description' => $t['author_description'],
        'language' => $t['language'],
    ];
    unset($t['author_id'], $t['author_name'], $t['author_description'], $t['language']);
}

jsonResponse(['data' => $translations]);
