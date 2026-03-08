<?php
// GET api/verse.php?surah=2&ayah=255&author=77&text_mode=uthmani
require_once __DIR__ . '/config.php';
setCorsHeaders();

$surahId = intval($_GET['surah'] ?? 0);
$ayahNo = intval($_GET['ayah'] ?? 0);
$authorId = intval($_GET['author'] ?? DEFAULT_AUTHOR);

if ($surahId < 1 || $surahId > 114) jsonError('Invalid surah ID.');
if ($ayahNo < 1) jsonError('Invalid ayah number.');

$db = getDB();

function hasColumn(PDO $db, string $table, string $column): bool {
    $stmt = $db->prepare("SHOW COLUMNS FROM `$table` LIKE ?");
    $stmt->execute([$column]);
    return (bool)$stmt->fetch();
}

function resolveBool($value, bool $fallback = false): bool {
    if (is_bool($value)) return $value;
    if ($value === null) return $fallback;
    if (is_numeric($value)) return intval($value) > 0;
    $normalized = strtolower(trim((string)$value));
    if ($normalized === '') return $fallback;
    return in_array($normalized, ['1', 'true', 'yes', 'on'], true);
}

$verseHas = [
    'verse_text_uthmani' => hasColumn($db, 'verses', 'verse_text_uthmani'),
    'verse_text_plain' => hasColumn($db, 'verses', 'verse_text_plain'),
    'verse_text_tajweed' => hasColumn($db, 'verses', 'verse_text_tajweed'),
    'text_source' => hasColumn($db, 'verses', 'text_source'),
    'text_is_fallback' => hasColumn($db, 'verses', 'text_is_fallback'),
];

$wordHas = [
    'source' => hasColumn($db, 'verse_words', 'source'),
    'is_fallback' => hasColumn($db, 'verse_words', 'is_fallback'),
    'grammar_pos' => hasColumn($db, 'verse_words', 'grammar_pos'),
    'grammar_pos_ar' => hasColumn($db, 'verse_words', 'grammar_pos_ar'),
    'grammar_lemma' => hasColumn($db, 'verse_words', 'grammar_lemma'),
    'grammar_lemma_ar' => hasColumn($db, 'verse_words', 'grammar_lemma_ar'),
    'grammar_stem' => hasColumn($db, 'verse_words', 'grammar_stem'),
    'grammar_root' => hasColumn($db, 'verse_words', 'grammar_root'),
    'grammar_pattern' => hasColumn($db, 'verse_words', 'grammar_pattern'),
    'grammar_case' => hasColumn($db, 'verse_words', 'grammar_case'),
    'grammar_mood' => hasColumn($db, 'verse_words', 'grammar_mood'),
    'grammar_person' => hasColumn($db, 'verse_words', 'grammar_person'),
    'grammar_gender' => hasColumn($db, 'verse_words', 'grammar_gender'),
    'grammar_number' => hasColumn($db, 'verse_words', 'grammar_number'),
    'grammar_voice' => hasColumn($db, 'verse_words', 'grammar_voice'),
    'grammar_aspect' => hasColumn($db, 'verse_words', 'grammar_aspect'),
    'grammar_state' => hasColumn($db, 'verse_words', 'grammar_state'),
    'grammar_form' => hasColumn($db, 'verse_words', 'grammar_form'),
    'grammar_i3rab' => hasColumn($db, 'verse_words', 'grammar_i3rab'),
    'grammar_details' => hasColumn($db, 'verse_words', 'grammar_details'),
];

$verseSelect = [
    'v.id',
    'v.surah_id',
    'v.verse_number',
    'v.verse_text',
    'v.verse_simplified',
    'v.verse_without_vowel',
    'v.transcription',
    'v.transcription_en',
    'v.audio_mp3',
    'v.audio_duration',
    'v.page',
    'v.juz_number',
    's.name AS surah_name',
    's.name_en AS surah_name_en',
    's.name_original AS surah_name_original',
    's.slug AS surah_slug'
];

if ($verseHas['verse_text_uthmani']) $verseSelect[] = 'v.verse_text_uthmani';
if ($verseHas['verse_text_plain']) $verseSelect[] = 'v.verse_text_plain';
if ($verseHas['verse_text_tajweed']) $verseSelect[] = 'v.verse_text_tajweed';
if ($verseHas['text_source']) $verseSelect[] = 'v.text_source';
if ($verseHas['text_is_fallback']) $verseSelect[] = 'v.text_is_fallback';

$verseSql = 'SELECT ' . implode(', ', $verseSelect) . ' FROM verses v JOIN surahs s ON s.id = v.surah_id WHERE v.surah_id = ? AND v.verse_number = ? LIMIT 1';
$stmt = $db->prepare($verseSql);
$stmt->execute([$surahId, $ayahNo]);
$verse = $stmt->fetch();

if (!$verse) jsonError('Verse not found.', 404);

$stmt = $db->prepare('SELECT t.id, t.text, a.id AS author_id, a.name AS author_name, a.description AS author_description FROM translations t JOIN authors a ON a.id = t.author_id WHERE t.verse_id = ? AND t.author_id = ? LIMIT 1');
$stmt->execute([$verse['id'], $authorId]);
$translation = $stmt->fetch();

$footnotes = [];
if ($translation) {
    $stmt = $db->prepare('SELECT id, number, text FROM footnotes WHERE translation_id = ? ORDER BY number');
    $stmt->execute([$translation['id']]);
    $footnotes = $stmt->fetchAll();
}

$wordSelect = [
    'w.id',
    'w.sort_number',
    'w.arabic',
    'w.transcription_tr',
    'w.transcription_en',
    'w.translation_tr',
    'w.translation_en',
    'r.id AS root_id',
    'r.latin AS root_latin',
    'r.arabic AS root_arabic',
    'r.transcription AS root_transcription',
    'r.mean_tr AS root_mean_tr',
    'r.mean_en AS root_mean_en'
];

foreach ($wordHas as $column => $exists) {
    if ($exists) {
        $wordSelect[] = "w.$column";
    }
}

$wordSql = 'SELECT ' . implode(', ', $wordSelect) . ' FROM verse_words w LEFT JOIN roots r ON r.id = w.root_id WHERE w.verse_id = ? ORDER BY w.sort_number';
$stmt = $db->prepare($wordSql);
$stmt->execute([$verse['id']]);
$words = $stmt->fetchAll();

$source = trim((string)($verse['text_source'] ?? 'legacy'));
if ($source === '') $source = 'legacy';
$isFallback = resolveBool($verse['text_is_fallback'] ?? null, $source !== 'qul');

$textModes = [
    'uthmani' => $verse['verse_text_uthmani'] ?? $verse['verse_text'] ?? '',
    'plain' => $verse['verse_text_plain'] ?? $verse['verse_without_vowel'] ?? $verse['verse_simplified'] ?? $verse['verse_text'] ?? '',
    'tajweed' => $verse['verse_text_tajweed'] ?? $verse['verse_text'] ?? ''
];

$response = [
    'id' => (int)$verse['id'],
    'surah' => [
        'id' => (int)$verse['surah_id'],
        'name' => $verse['surah_name'],
        'name_en' => $verse['surah_name_en'],
        'name_original' => $verse['surah_name_original'],
        'slug' => $verse['surah_slug']
    ],
    'verse_number' => (int)$verse['verse_number'],
    'source' => $source,
    'isFallback' => $isFallback,
    'verse' => $verse['verse_text'],
    'verse_simplified' => $verse['verse_simplified'],
    'verse_without_vowel' => $verse['verse_without_vowel'],
    'text_modes' => $textModes,
    'transcription' => $verse['transcription'],
    'transcription_en' => $verse['transcription_en'],
    'audio_mp3' => $verse['audio_mp3'],
    'audio_duration' => (int)($verse['audio_duration'] ?? 0),
    'page' => (int)$verse['page'],
    'juz_number' => (int)$verse['juz_number'],
    'translation' => $translation ? [
        'id' => (int)$translation['id'],
        'text' => $translation['text'],
        'author' => [
            'id' => (int)$translation['author_id'],
            'name' => $translation['author_name'],
            'description' => $translation['author_description']
        ],
        'footnotes' => array_map(static function ($f) {
            return [
                'id' => (int)$f['id'],
                'number' => (int)$f['number'],
                'text' => $f['text']
            ];
        }, $footnotes)
    ] : null,
    'words' => array_map(static function ($w) {
        $wordSource = trim((string)($w['source'] ?? 'legacy'));
        if ($wordSource === '') $wordSource = 'legacy';
        $wordFallback = resolveBool($w['is_fallback'] ?? null, $wordSource !== 'qul');
        $detailsRaw = $w['grammar_details'] ?? null;
        $details = null;
        if (is_string($detailsRaw) && $detailsRaw !== '') {
            $decoded = json_decode($detailsRaw, true);
            $details = json_last_error() === JSON_ERROR_NONE ? $decoded : $detailsRaw;
        } elseif (is_array($detailsRaw)) {
            $details = $detailsRaw;
        }

        return [
            'id' => (int)$w['id'],
            'sort_number' => (int)$w['sort_number'],
            'arabic' => $w['arabic'],
            'transcription_tr' => $w['transcription_tr'],
            'transcription_en' => $w['transcription_en'],
            'translation_tr' => $w['translation_tr'],
            'translation_en' => $w['translation_en'],
            'source' => $wordSource,
            'isFallback' => $wordFallback,
            'root' => $w['root_id'] ? [
                'id' => (int)$w['root_id'],
                'latin' => $w['root_latin'],
                'arabic' => $w['root_arabic'],
                'transcription' => $w['root_transcription'],
                'mean_tr' => $w['root_mean_tr'],
                'mean_en' => $w['root_mean_en']
            ] : null,
            'morphology' => [
                'pos' => $w['grammar_pos'] ?? '',
                'pos_ar' => $w['grammar_pos_ar'] ?? '',
                'lemma' => $w['grammar_lemma'] ?? '',
                'lemma_ar' => $w['grammar_lemma_ar'] ?? '',
                'stem' => $w['grammar_stem'] ?? '',
                'root' => $w['grammar_root'] ?? '',
                'pattern' => $w['grammar_pattern'] ?? '',
                'case' => $w['grammar_case'] ?? '',
                'mood' => $w['grammar_mood'] ?? '',
                'person' => $w['grammar_person'] ?? '',
                'gender' => $w['grammar_gender'] ?? '',
                'number' => $w['grammar_number'] ?? '',
                'voice' => $w['grammar_voice'] ?? '',
                'aspect' => $w['grammar_aspect'] ?? '',
                'state' => $w['grammar_state'] ?? '',
                'form' => $w['grammar_form'] ?? '',
                'i3rab' => $w['grammar_i3rab'] ?? '',
                'details' => $details
            ]
        ];
    }, $words)
];

jsonResponse($response);
