<?php
// Lightweight proxy for external Quran font files.
// This keeps font loading on same-origin and avoids third-party CORS issues.
ini_set('display_errors', '0');
error_reporting(E_ALL);

$font = $_GET['font'] ?? '';

$fonts = [
    'DiyanetKuran' => [
        // Try official Diyanet API first, then official Diyanet mushaf_v2 static font.
        'urls' => [
            'https://t061.diyanet.gov.tr/apigateway/acikkaynakkuran/api/v1/fonts/173/download',
            'https://kuran.diyanet.gov.tr/mushaf_v2/Content/fonts/shaikh_hamdullah_mushaf.ttf'
        ],
        'content_type' => 'font/ttf'
    ],
    'QuranFoundationHafs' => [
        'urls' => [
            'https://verses.quran.foundation/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2',
            'https://static-cdn.tarteel.ai/qul/fonts/UthmanicHafs1Ver18.woff2'
        ],
        'content_type' => 'font/woff2'
    ],
    'KFGQPCUthmanTN' => [
        'urls' => [
            'https://fonts.qurancomplex.gov.sa/wp-content/uploads/2024/08/UthmanTN_v2-0.ttf',
            'https://verses.quran.foundation/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.ttf'
        ],
        'content_type' => 'font/ttf'
    ],
    'KFGQPCUthmanTNBold' => [
        'url' => 'https://fonts.qurancomplex.gov.sa/wp-content/uploads/2024/08/UthmanTNB_v2-0.ttf',
        'content_type' => 'font/ttf'
    ],
    'KFGQPCDotNaskh' => [
        'url' => 'https://fonts.qurancomplex.gov.sa/wp-content/uploads/2024/08/KFGQPCDotFont.otf',
        'content_type' => 'font/otf'
    ],
    'KFGQPCKufi' => [
        'url' => 'https://fonts.qurancomplex.gov.sa/wp-content/uploads/2024/08/KFGQPC-KufiStyV14.ttf',
        'content_type' => 'font/ttf'
    ],
    'KFGQPCKufiExtended' => [
        'url' => 'https://fonts.qurancomplex.gov.sa/wp-content/uploads/2024/08/KFGQPC-KufiExtV14.ttf',
        'content_type' => 'font/ttf'
    ],
    'KFGQPCAnRegular' => [
        'url' => 'https://fonts.qurancomplex.gov.sa/wp-content/uploads/2024/08/KFGQPCAnRegular.ttf',
        'content_type' => 'font/ttf'
    ],
    'KFGQPCAnBold' => [
        'url' => 'https://fonts.qurancomplex.gov.sa/wp-content/uploads/2024/08/KFGQPCAnBold.ttf',
        'content_type' => 'font/ttf'
    ],
    'KFGQPCKSARegular' => [
        'url' => 'https://fonts.qurancomplex.gov.sa/wp-content/uploads/2024/08/KFGQPCKSARegular.ttf',
        'content_type' => 'font/ttf'
    ],
    'KFGQPCKingdom2' => [
        'url' => 'https://fonts.qurancomplex.gov.sa/wp-content/uploads/2024/08/KFGQPC-Kingdom2.otf',
        'content_type' => 'font/otf'
    ]
];

if (!isset($fonts[$font])) {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Invalid font key'], JSON_UNESCAPED_UNICODE);
    exit;
}

$fontConfig = $fonts[$font];
$candidateUrls = isset($fontConfig['urls']) && is_array($fontConfig['urls'])
    ? $fontConfig['urls']
    : [$fontConfig['url']];

$data = null;
$status = 0;
$detectedType = '';
$curlError = '';

foreach ($candidateUrls as $candidateUrl) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $candidateUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    // Some Diyanet endpoints require same-origin-like headers.
    if (strpos($candidateUrl, 'diyanet.gov.tr') !== false) {
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Accept: */*',
            'Origin: https://kuran.diyanet.gov.tr',
            'Referer: https://kuran.diyanet.gov.tr/'
        ]);
    }

    $tryData = curl_exec($ch);
    $tryStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $tryDetectedType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE) ?: '';
    $tryError = curl_error($ch);
    curl_close($ch);

    $isHtml = false;
    $tryPrefix = ltrim(substr((string)$tryData, 0, 256));
    if ($tryPrefix !== '' && preg_match('/^<(?:!DOCTYPE\\s+html|html|head|body)\\b/i', $tryPrefix)) {
        $isHtml = true;
    }
    if (strpos(strtolower($tryDetectedType), 'text/html') !== false) {
        $isHtml = true;
    }

    if ($tryStatus === 200 && $tryData && !$isHtml) {
        $data = $tryData;
        $status = $tryStatus;
        $detectedType = $tryDetectedType;
        $curlError = '';
        break;
    }

    $status = $tryStatus;
    $detectedType = $tryDetectedType;
    $curlError = $tryError;
}

if ($status !== 200 || !$data) {
    http_response_code(502);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'error' => 'Font fetch failed',
        'font' => $font,
        'status' => $status,
        'detail' => $curlError
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$contentType = $detectedType ?: $fontConfig['content_type'];

header('Access-Control-Allow-Origin: *');
header('Content-Type: ' . $contentType);
header('Cache-Control: public, max-age=2592000, immutable');
echo $data;
