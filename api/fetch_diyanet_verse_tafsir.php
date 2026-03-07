<?php
/**
 * Diyanet Ayet Tefsirleri Çekme Scripti
 * Mushaf'ın 604 sayfasını tarar, her ayetin tefsirini yerel JSON'a kaydeder.
 * 
 * Çalıştır: php api/fetch_diyanet_verse_tafsir.php
 * Tahmini süre: 5-10 dakika
 */

set_time_limit(600);
ini_set('memory_limit', '256M');

$outputFile = __DIR__ . '/diyanet_verse_tafsir.json';
$data = []; // [surahId][verseNo] = htmlText

echo "Diyanet Ayet Tefsirleri Çekiliyor (604 sayfa)...\n";
$successPages = 0;
$totalVerses = 0;

for ($page = 0; $page <= 603; $page++) {
    $url = "https://kuran.diyanet.gov.tr/mushaf_v2/qurandm/pagedata?id={$page}&itf=1&iml=1&iqr=1&ml=5&ql=15&iar=0";

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$response) {
        echo "✗ Sayfa {$page} hata (HTTP {$httpCode})\n";
        usleep(300000); // hata durumunda biraz daha bekle
        continue;
    }

    $pageData = json_decode($response, true);

    if (!isset($pageData['TefsirList']) || empty($pageData['TefsirList'])) {
        // Boş sayfa (kapak vb.)
        continue;
    }

    $verseCount = 0;
    foreach ($pageData['TefsirList'] as $item) {
        $surahId = (int)($item['SureId'] ?? 0);
        $verseNo = (int)($item['AyetNumber'] ?? 0);
        $text    = $item['AyetText'] ?? '';

        if ($surahId > 0 && $verseNo > 0 && $text) {
            if (!isset($data[$surahId])) {
                $data[$surahId] = [];
            }
            $data[$surahId][$verseNo] = $text;
            $verseCount++;
            $totalVerses++;
        }
    }

    $successPages++;
    echo "✓ Sayfa {$page}/603 — {$verseCount} ayet, toplam: {$totalVerses}\n";

    // Rate limiting
    usleep(120000); // 120ms
}

// Sure ve ayet numaralarına göre sırala
ksort($data);
foreach ($data as $s => &$verses) {
    ksort($verses);
}
unset($verses);

file_put_contents($outputFile, json_encode($data, JSON_UNESCAPED_UNICODE));

echo "\n✅ Tamamlandı!\n";
echo "  Başarılı sayfa: {$successPages} / 604\n";
echo "  Toplam ayet: {$totalVerses}\n";
echo "  Dosya: {$outputFile}\n";
echo "  Boyut: " . round(filesize($outputFile) / 1024 / 1024, 2) . " MB\n";
