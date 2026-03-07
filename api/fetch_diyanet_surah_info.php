<?php
/**
 * Diyanet Sure Bilgileri Çekme Scripti
 * Bu script, kuran.diyanet.gov.tr/mushaf_v2/qurandm/GetSureInfoById?id={id}
 * adresinden tüm 114 sure için bilgileri çeker ve yerel JSON olarak kaydeder.
 * 
 * Çalıştırmak için: php api/fetch_diyanet_surah_info.php
 */

set_time_limit(300); // 5 dakika zaman aşımı

$outputFile = __DIR__ . '/diyanet_surah_info.json';
$allData = [];

echo "Diyanet Sure Bilgileri Çekiliyor...\n";

for ($i = 1; $i <= 114; $i++) {
    $url = "https://kuran.diyanet.gov.tr/mushaf_v2/qurandm/GetSureInfoById?id={$i}";
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $response) {
        $data = json_decode($response, true);

        if ($data && isset($data['NodeList'])) {
            // NodeList içindeki bölümleri birleştir
            $combinedText = '';
            foreach ($data['NodeList'] as $node) {
                $content = $node['Content'] ?? '';
                if ($content) {
                    $combinedText .= $content;
                }
            }

            $allData[$i] = [
                'surahId' => $i,
                'text' => $combinedText,
                'source' => "Diyanet İşleri Başkanlığı - Kur'an Yolu"
            ];
            echo "✓ Sure {$i} çekildi (" . strlen($combinedText) . " karakter)\n";
        } else {
            echo "✗ Sure {$i} parse hatası veya NodeList yok\n";
            $allData[$i] = null;
        }
    } else {
        echo "✗ Sure {$i} hata (HTTP {$httpCode})\n";
        $allData[$i] = null;
    }

    // Rate limiting - çok hızlı istek gönderme
    usleep(150000); // 150ms bekleme
}

// JSON dosyasına kaydet
$jsonOutput = json_encode($allData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
file_put_contents($outputFile, $jsonOutput);

echo "\n✅ Tamamlandı! {$outputFile} dosyasına kaydedildi.\n";
echo "Toplam: " . count(array_filter($allData)) . " / 114 sure başarılı\n";
