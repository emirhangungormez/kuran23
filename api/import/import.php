<?php
/**
 * Import script — Pulls all data from acikkuran-api into local MySQL
 * Run once: php import.php
 * 
 * Steps:
 * 1. Authors
 * 2. Surahs
 * 3. Verses + default translation per surah
 * 4. All translations per verse
 * 5. Verse words (verseparts) per verse
 */

require_once __DIR__ . '/../config.php';

// Rate limiting
define('REQUEST_DELAY_MS', 200);

// Fetch URL with retry
function fetchApi($url, $retries = 3) {
    for ($i = 0; $i < $retries; $i++) {
        $ctx = stream_context_create([
            'http' => [
                'timeout' => 30,
                'header' => "Accept: application/json\r\n"
            ]
        ]);
        $response = @file_get_contents($url, false, $ctx);
        if ($response !== false) {
            $data = json_decode($response, true);
            if ($data !== null) return $data;
        }
        echo "  Retry $url ($i)\n";
        usleep(500000); // 500ms retry wait
    }
    echo "  FAILED: $url\n";
    return null;
}

function wait() {
    usleep(REQUEST_DELAY_MS * 1000);
}

// ==================
// START IMPORT
// ==================

$db = getDB();
echo "=== Kuran Data Import ===\n\n";

// 1. Authors
echo "[1/5] Importing authors...\n";
$authorsData = fetchApi(ACIKKURAN_API . '/authors');

// Hariç tutulan yazarlar (Ehl-i Sünnet çizgisinden ayrılanlar + eski/problemli tercümeler)
$excludedAuthors = [
    // Türkçe
    3, 6, 8, 13, 18, 22, 25, 27, 30, 38, 50, 104, 105, 107, 115,
    // İngilizce
    7, 9, 12, 16, 17, 20, 28, 29, 31, 33, 34, 101, 102, 103
];

if ($authorsData && isset($authorsData['data'])) {
    $stmt = $db->prepare('INSERT IGNORE INTO authors (id, name, description, language) VALUES (?, ?, ?, ?)');
    $imported = 0;
    foreach ($authorsData['data'] as $a) {
        if (in_array($a['id'], $excludedAuthors)) {
            echo "  ⊗ Skipped: {$a['name']} (ID: {$a['id']})\n";
            continue;
        }
        $stmt->execute([$a['id'], $a['name'], $a['description'] ?? '', $a['language'] ?? 'tr']);
        $imported++;
    }
    echo "  ✓ $imported authors imported (excluded: " . count($excludedAuthors) . ")\n";
}
wait();

// 2. Surahs
echo "\n[2/5] Importing surahs...\n";
$surahsData = fetchApi(ACIKKURAN_API . '/surahs');
if ($surahsData && isset($surahsData['data'])) {
    $stmt = $db->prepare('INSERT IGNORE INTO surahs (id, name, name_en, name_original, slug, verse_count, page_number, audio_mp3, audio_duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    foreach ($surahsData['data'] as $s) {
        $stmt->execute([
            $s['id'], $s['name'], $s['name_en'], $s['name_original'], $s['slug'],
            $s['verse_count'], $s['page_number'],
            $s['audio']['mp3'] ?? null, $s['audio']['duration'] ?? 0
        ]);
    }
    echo "  ✓ " . count($surahsData['data']) . " surahs\n";
}
wait();

// 3. Verses + default translation (per surah)
echo "\n[3/5] Importing verses (surah by surah)...\n";
$verseStmt = $db->prepare('INSERT IGNORE INTO verses (id, surah_id, verse_number, verse_text, verse_simplified, verse_without_vowel, transcription, transcription_en, page, juz_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
$transStmt = $db->prepare('INSERT IGNORE INTO translations (id, verse_id, author_id, text) VALUES (?, ?, ?, ?)');
$footStmt = $db->prepare('INSERT IGNORE INTO footnotes (id, translation_id, number, text) VALUES (?, ?, ?, ?)');

$totalVerses = 0;
for ($surahId = 1; $surahId <= 114; $surahId++) {
    echo "  Sure $surahId/114... ";
    $surahData = fetchApi(ACIKKURAN_API . "/surah/$surahId?author=" . DEFAULT_AUTHOR);
    
    if (!$surahData || !isset($surahData['data']['verses'])) {
        echo "SKIP\n";
        wait();
        continue;
    }
    
    $verses = $surahData['data']['verses'];
    foreach ($verses as $v) {
        // Insert verse
        $verseStmt->execute([
            $v['id'], $surahId, $v['verse_number'],
            $v['verse'] ?? '', $v['verse_simplified'] ?? '', '',
            $v['transcription'] ?? '', $v['transcription_en'] ?? '',
            $v['page'] ?? 0, $v['juz_number'] ?? 1
        ]);
        
        // Insert default translation
        if (isset($v['translation'])) {
            $t = $v['translation'];
            $transStmt->execute([$t['id'], $v['id'], $t['author']['id'] ?? DEFAULT_AUTHOR, $t['text'] ?? '']);
            
            // Insert footnotes
            if (!empty($t['footnotes'])) {
                foreach ($t['footnotes'] as $fn) {
                    $footStmt->execute([$fn['id'], $t['id'], $fn['number'] ?? 1, $fn['text'] ?? '']);
                }
            }
        }
        
        $totalVerses++;
    }
    
    echo count($verses) . " verses ✓\n";
    wait();
}
echo "  Total: $totalVerses verses\n";

// 4. All translations per verse
echo "\n[4/5] Importing all translations...\n";
$allVerses = $db->query('SELECT id, surah_id, verse_number FROM verses ORDER BY surah_id, verse_number')->fetchAll();
$transCount = 0;

foreach ($allVerses as $i => $v) {
    if (($i + 1) % 500 === 0 || $i === 0) {
        echo "  Verse " . ($i + 1) . "/" . count($allVerses) . "...\n";
    }
    
    $transData = fetchApi(ACIKKURAN_API . "/surah/{$v['surah_id']}/verse/{$v['verse_number']}/translations");
    
    if ($transData && isset($transData['data'])) {
        foreach ($transData['data'] as $t) {
            $authorId = $t['author']['id'] ?? 0;
            
            // Skip excluded authors
            if (in_array($authorId, $excludedAuthors)) {
                continue;
            }
            
            $transStmt->execute([$t['id'], $v['id'], $authorId, $t['text'] ?? '']);
            
            if (!empty($t['footnotes'])) {
                foreach ($t['footnotes'] as $fn) {
                    $footStmt->execute([$fn['id'], $t['id'], $fn['number'] ?? 1, $fn['text'] ?? '']);
                }
            }
            $transCount++;
        }
    }
    wait();
}
echo "  ✓ $transCount translations\n";

// 5. Verse words (verseparts)
echo "\n[5/5] Importing verse words...\n";
$wordStmt = $db->prepare('INSERT IGNORE INTO verse_words (id, verse_id, sort_number, arabic, transcription_tr, transcription_en, translation_tr, translation_en, root_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
$rootStmt = $db->prepare('INSERT IGNORE INTO roots (id, latin, arabic) VALUES (?, ?, ?)');
$wordCount = 0;

foreach ($allVerses as $i => $v) {
    if (($i + 1) % 500 === 0 || $i === 0) {
        echo "  Verse " . ($i + 1) . "/" . count($allVerses) . "...\n";
    }
    
    $wpData = fetchApi(ACIKKURAN_API . "/surah/{$v['surah_id']}/verse/{$v['verse_number']}/verseparts");
    
    if ($wpData && isset($wpData['data'])) {
        foreach ($wpData['data'] as $w) {
            // Insert root if exists
            $rootId = null;
            if (!empty($w['root'])) {
                $rootId = $w['root']['id'];
                $rootStmt->execute([$rootId, $w['root']['latin'] ?? '', $w['root']['arabic'] ?? '']);
            }
            
            $wordStmt->execute([
                $w['id'], $v['id'], $w['sort_number'] ?? 1,
                $w['arabic'] ?? '', $w['transcription_tr'] ?? '', $w['transcription_en'] ?? '',
                $w['translation_tr'] ?? '', $w['translation_en'] ?? '',
                $rootId
            ]);
            $wordCount++;
        }
    }
    wait();
}
echo "  ✓ $wordCount words\n";

// Update roots with full details
echo "\nUpdating root details...\n";
$roots = $db->query('SELECT id, latin FROM roots')->fetchAll();
$rootUpdateStmt = $db->prepare('UPDATE roots SET transcription = ?, mean_tr = ?, mean_en = ? WHERE id = ?');

foreach ($roots as $i => $r) {
    if (($i + 1) % 50 === 0 || $i === 0) {
        echo "  Root " . ($i + 1) . "/" . count($roots) . "...\n";
    }
    
    $rootData = fetchApi(ACIKKURAN_API . "/root/{$r['id']}");
    if ($rootData && isset($rootData['data'])) {
        $rd = $rootData['data'];
        $rootUpdateStmt->execute([
            $rd['transcription'] ?? '', $rd['mean'] ?? '', $rd['mean_en'] ?? '', $r['id']
        ]);
    }
    wait();
}

echo "\n=== Import Complete ===\n";
echo "Surahs: 114\n";
echo "Verses: $totalVerses\n";
echo "Translations: $transCount\n";
echo "Words: $wordCount\n";
echo "Roots: " . count($roots) . "\n";
