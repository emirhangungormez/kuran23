<?php
require_once 'config.php';

// Ensure endpoint always returns clean JSON payloads
ini_set('display_errors', '0');
error_reporting(E_ALL);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$action = $_GET['action'] ?? '';

function fetchUrl($url, $isJson = true, $retries = 2) {
    for ($attempt = 0; $attempt <= $retries; $attempt++) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200 && $response) {
            return $isJson ? json_decode($response, true) : $response;
        }

        usleep(180000);
    }
    return null;
}

function findVerseTafsirOnPage($pageId, $surahId, $ayahNo) {
    if ($pageId < 0) return null;

    $diyanetUrl = "https://kuran.diyanet.gov.tr/mushaf_v2/qurandm/pagedata?id={$pageId}&itf=1&iml=1&iqr=1&ml=5&ql=15&iar=0";
    $dData = fetchUrl($diyanetUrl);
    if (!isset($dData['TefsirList']) || !is_array($dData['TefsirList'])) {
        return null;
    }

    foreach ($dData['TefsirList'] as $t) {
        if ((int)($t['SureId'] ?? 0) === $surahId && (int)($t['AyetNumber'] ?? 0) === $ayahNo) {
            return $t['AyetText'] ?? null;
        }
    }

    return null;
}

switch ($action) {
    case 'tafsir':
        $surahId = (int)($_GET['surahId'] ?? 1);
        $ayahNo  = (int)($_GET['ayahNo'] ?? 1);

        // 1) Local JSON first (fast)
        $localVerseFile = __DIR__ . '/diyanet_verse_tafsir.json';
        if (file_exists($localVerseFile)) {
            static $verseData = null;
            if ($verseData === null) {
                $verseData = json_decode(file_get_contents($localVerseFile), true);
            }
            $text = $verseData[$surahId][$ayahNo] ?? null;
            if ($text) {
                echo json_encode([
                    'data' => [
                        'text'   => $text,
                        'surah'  => $surahId,
                        'ayah'   => $ayahNo,
                        'source' => "Diyanet İşleri Başkanlığı — Kur'an Yolu Tefsiri",
                        'from'   => 'local_json'
                    ]
                ], JSON_UNESCAPED_UNICODE);
                break;
            }
        }

        // 2) Dynamic fallback from Diyanet page data
        $page = null;

        // 2.a Quran.com page resolver
        $vData = fetchUrl("https://api.quran.com/api/v4/verses/by_key/{$surahId}:{$ayahNo}");
        if (isset($vData['verse']['page_number'])) {
            $page = (int)$vData['verse']['page_number'];
        }

        // 2.b Fallback resolver via AçıkKuran
        if (!$page) {
            $vData2 = fetchUrl("https://api.acikkuran.com/surah/{$surahId}/verse/{$ayahNo}");
            if (isset($vData2['data']['page'])) {
                // acikkuran page is 0-indexed in this endpoint
                $page = (int)$vData2['data']['page'] + 1;
            }
        }

        if ($page) {
            $basePageId = $page - 1;
            // Try page + neighbors to handle numbering drifts
            $candidates = [$basePageId, $basePageId - 1, $basePageId + 1, $basePageId - 2, $basePageId + 2];
            $text = null;
            foreach ($candidates as $pid) {
                $text = findVerseTafsirOnPage($pid, $surahId, $ayahNo);
                if ($text) break;
            }

            if ($text) {
                echo json_encode([
                    'data' => [
                        'text'   => $text,
                        'surah'  => $surahId,
                        'ayah'   => $ayahNo,
                        'source' => "Diyanet İşleri Başkanlığı — Kur'an Yolu Tefsiri",
                        'from'   => 'diyanet_live'
                    ]
                ], JSON_UNESCAPED_UNICODE);
                break;
            }
        }

        echo json_encode([
            'error' => 'Tafsir not found',
            'surah' => $surahId,
            'ayah'  => $ayahNo
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'surah_info':
        $surahId = (int)($_GET['surahId'] ?? 1);

        // Serve from local pre-fetched JSON (all 114 surahs from Diyanet)
        $localFile = __DIR__ . '/diyanet_surah_info.json';
        if (file_exists($localFile)) {
            $allInfo = json_decode(file_get_contents($localFile), true);
            if (isset($allInfo[$surahId]) && $allInfo[$surahId]) {
                echo json_encode([
                    'chapter_info' => [
                        'text' => $allInfo[$surahId]['text'],
                        'short_text' => mb_substr(strip_tags($allInfo[$surahId]['text']), 0, 300) . '...',
                        'source' => $allInfo[$surahId]['source']
                    ]
                ], JSON_UNESCAPED_UNICODE);
            } else {
                echo json_encode(['error' => 'Surah not found', 'surahId' => $surahId], JSON_UNESCAPED_UNICODE);
            }
        } else {
            echo json_encode(['error' => 'Local surah info file not found'], JSON_UNESCAPED_UNICODE);
        }
        break;

    default:
        echo json_encode(['error' => 'Invalid action'], JSON_UNESCAPED_UNICODE);
        break;
}
