<?php
// GET api/search.php?q=rahman
require_once __DIR__ . '/config.php';
setCorsHeaders();

function normalizeArabic($text) {
    // Remove common Arabic diacritics and tatweel
    $text = preg_replace('/[\x{064B}-\x{065F}\x{0670}\x{06D6}-\x{06ED}\x{0640}]/u', '', $text);
    // Normalize alef variants
    $text = preg_replace('/[أإآٱ]/u', 'ا', $text);
    // Normalize ta marbuta and alif maqsura
    $text = preg_replace('/ة/u', 'ه', $text);
    $text = preg_replace('/ى/u', 'ي', $text);
    return trim($text);
}

function isArabic($text) {
    return preg_match('/\p{Arabic}/u', $text);
}

$query = trim($_GET['q'] ?? '');
$isArabicQuery = isArabic($query);
$primaryAuthorId = intval($_GET['primary_author_id'] ?? DEFAULT_AUTHOR);
if ($primaryAuthorId <= 0) $primaryAuthorId = DEFAULT_AUTHOR;

if (!$isArabicQuery && mb_strlen($query) < 2) {
    jsonError('Search query must be at least 2 characters.');
} elseif ($isArabicQuery && mb_strlen($query) < 1) {
    jsonError('Search query cannot be empty.');
}

$normalizedQuery = $isArabicQuery ? normalizeArabic($query) : $query;
$limit = intval($_GET['limit'] ?? 20);
if ($limit > 80) $limit = 80;

$db = getDB();
$searchParam = '%' . $query . '%';
$numParam = is_numeric($query) ? intval($query) : 0;

// 1) Search surahs by name/id
$stmt = $db->prepare('
    SELECT id, name, name_en, name_original, slug, verse_count, page_number
    FROM surahs
    WHERE name_original LIKE ? OR name LIKE ? OR name_en LIKE ? OR id = ?
    ORDER BY
        CASE
            WHEN name_original = ? THEN 1
            WHEN name_original LIKE ? THEN 2
            WHEN name LIKE ? THEN 3
            ELSE 4
        END, id
    LIMIT 10
');
$stmt->execute([$searchParam, $searchParam, $searchParam, $numParam, $query, $query . '%', $query . '%']);
$surahs = $stmt->fetchAll();

// 2) Search verses
$verses = [];

if ($isArabicQuery) {
    // Arabic query: search Arabic text columns, keep one translation preview (primary author)
    $arabicSearchParam = '%' . $normalizedQuery . '%';
    $stmt = $db->prepare('
        SELECT
            v.id,
            v.surah_id,
            v.verse_number,
            v.verse_text,
            v.transcription,
            v.page,
            v.juz_number,
            s.name AS surah_name,
            s.name_original AS surah_name_original,
            s.slug AS surah_slug,
            t.text AS translation_text,
            a.language AS translation_language,
            a.name AS translation_author
        FROM verses v
        JOIN surahs s ON s.id = v.surah_id
        LEFT JOIN translations t ON t.verse_id = v.id AND t.author_id = ?
        LEFT JOIN authors a ON a.id = t.author_id
        WHERE v.verse_text LIKE ?
           OR v.verse_simplified LIKE ?
           OR v.verse_without_vowel LIKE ?
        ORDER BY v.surah_id, v.verse_number
        LIMIT ?
    ');
    $stmt->execute([$primaryAuthorId, '%' . $query . '%', $arabicSearchParam, $arabicSearchParam, $limit]);
    $verses = $stmt->fetchAll();
} else {
    // Non-Arabic query: search Turkish + English translations together
    try {
        $stmt = $db->prepare("
            SELECT
                v.id,
                v.surah_id,
                v.verse_number,
                v.verse_text,
                v.transcription,
                v.page,
                v.juz_number,
                s.name AS surah_name,
                s.name_original AS surah_name_original,
                s.slug AS surah_slug,
                t.text AS translation_text,
                a.language AS translation_language,
                a.name AS translation_author
            FROM translations t
            JOIN authors a ON a.id = t.author_id
            JOIN verses v ON v.id = t.verse_id
            JOIN surahs s ON s.id = v.surah_id
            WHERE a.language IN ('tr', 'en')
              AND MATCH(t.text) AGAINST(? IN BOOLEAN MODE)
            ORDER BY v.surah_id, v.verse_number, a.language
            LIMIT ?
        ");
        $stmt->execute([$query . '*', $limit]);
        $verses = $stmt->fetchAll();
    } catch (Exception $e) {
        $stmt = $db->prepare("
            SELECT
                v.id,
                v.surah_id,
                v.verse_number,
                v.verse_text,
                v.transcription,
                v.page,
                v.juz_number,
                s.name AS surah_name,
                s.name_original AS surah_name_original,
                s.slug AS surah_slug,
                t.text AS translation_text,
                a.language AS translation_language,
                a.name AS translation_author
            FROM translations t
            JOIN authors a ON a.id = t.author_id
            JOIN verses v ON v.id = t.verse_id
            JOIN surahs s ON s.id = v.surah_id
            WHERE a.language IN ('tr', 'en')
              AND t.text LIKE ?
            ORDER BY v.surah_id, v.verse_number, a.language
            LIMIT ?
        ");
        $stmt->execute([$searchParam, $limit]);
        $verses = $stmt->fetchAll();
    }
}

jsonResponse([
    'data' => [
        'query' => $query,
        'is_arabic' => $isArabicQuery,
        'surahs' => $surahs,
        'verses' => $verses,
        'total' => count($surahs) + count($verses),
    ]
]);
