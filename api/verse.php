<?php
// GET api/verse.php?surah=2&ayah=255 — Returns verse detail with translation + words
require_once __DIR__ . '/config.php';
setCorsHeaders();

$surahId = intval($_GET['surah'] ?? 0);
$ayahNo = intval($_GET['ayah'] ?? 0);
$authorId = intval($_GET['author'] ?? DEFAULT_AUTHOR);

if ($surahId < 1 || $surahId > 114) jsonError('Invalid surah ID.');
if ($ayahNo < 1) jsonError('Invalid ayah number.');

$db = getDB();

// Verse
$stmt = $db->prepare('
    SELECT v.*, s.name AS surah_name, s.name_en AS surah_name_en, s.name_original AS surah_name_original, s.slug AS surah_slug
    FROM verses v
    JOIN surahs s ON s.id = v.surah_id
    WHERE v.surah_id = ? AND v.verse_number = ?
');
$stmt->execute([$surahId, $ayahNo]);
$verse = $stmt->fetch();

if (!$verse) jsonError('Verse not found.', 404);

// Translation (default author)
$stmt = $db->prepare('
    SELECT t.id, t.text, a.id AS author_id, a.name AS author_name, a.description AS author_description
    FROM translations t
    JOIN authors a ON a.id = t.author_id
    WHERE t.verse_id = ? AND t.author_id = ?
');
$stmt->execute([$verse['id'], $authorId]);
$translation = $stmt->fetch();

// Footnotes
$footnotes = [];
if ($translation) {
    $stmt = $db->prepare('SELECT id, number, text FROM footnotes WHERE translation_id = ? ORDER BY number');
    $stmt->execute([$translation['id']]);
    $footnotes = $stmt->fetchAll();
}

// Words
$stmt = $db->prepare('
    SELECT w.id, w.sort_number, w.arabic, w.transcription_tr, w.transcription_en, w.translation_tr, w.translation_en,
           r.id AS root_id, r.latin AS root_latin, r.arabic AS root_arabic
    FROM verse_words w
    LEFT JOIN roots r ON r.id = w.root_id
    WHERE w.verse_id = ?
    ORDER BY w.sort_number
');
$stmt->execute([$verse['id']]);
$words = $stmt->fetchAll();

// Build response
$response = [
    'id' => (int)$verse['id'],
    'surah' => [
        'id' => (int)$verse['surah_id'],
        'name' => $verse['surah_name'],
        'name_en' => $verse['surah_name_en'],
        'name_original' => $verse['surah_name_original'],
        'slug' => $verse['surah_slug'],
    ],
    'verse_number' => (int)$verse['verse_number'],
    'verse' => $verse['verse_text'],
    'verse_simplified' => $verse['verse_simplified'],
    'verse_without_vowel' => $verse['verse_without_vowel'],
    'transcription' => $verse['transcription'],
    'transcription_en' => $verse['transcription_en'],
    'page' => (int)$verse['page'],
    'juz_number' => (int)$verse['juz_number'],
    'translation' => $translation ? [
        'id' => (int)$translation['id'],
        'text' => $translation['text'],
        'author' => [
            'id' => (int)$translation['author_id'],
            'name' => $translation['author_name'],
            'description' => $translation['author_description'],
        ],
        'footnotes' => $footnotes,
    ] : null,
    'words' => array_map(function($w) {
        return [
            'id' => (int)$verse['id'],
            'surah' => [
                'id' => (int)$verse['surah_id'],
                'name' => $verse['surah_name'],
                'name_en' => $verse['surah_name_en'],
                'name_original' => $verse['surah_name_original'],
                'slug' => $verse['surah_slug'],
            ],
            'verse_number' => (int)$verse['verse_number'],
            'verse' => $verse['verse_text'],
            'verse_simplified' => $verse['verse_simplified'],
            'verse_without_vowel' => $verse['verse_without_vowel'],
            'transcription' => $verse['transcription'],
            'transcription_en' => $verse['transcription_en'],
            'audio_mp3' => $verse['audio_mp3'],
            'audio_duration' => (int)$verse['audio_duration'],
            'page' => (int)$verse['page'],
            'juz_number' => (int)$verse['juz_number'],
jsonResponse(['data' => $response]);
