<?php
require_once __DIR__ . '/config.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Geçersiz istek.', 405);
}

$input = json_decode(file_get_contents('php://input'), true);
$input = is_array($input) ? $input : [];

$text = trim((string)($input['text'] ?? ''));
$rate = floatval($input['rate'] ?? 1);

if ($text === '') {
    jsonError('Metin boş olamaz.', 422);
}

if (mb_strlen($text, 'UTF-8') > 3500) {
    jsonError('Metin çok uzun. Lütfen daha kısa bir bölüm deneyin.', 422);
}

$rate = max(0.7, min(1.5, $rate));

if (!GOOGLE_TTS_API_KEY) {
    jsonError('Google TTS API anahtarı yapılandırılmamış.', 503);
}

function ttsCacheDir() {
    $dir = __DIR__ . '/cache/tts';
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    return $dir;
}

function outputMp3($binary) {
    header_remove('Content-Type');
    header('Content-Type: audio/mpeg');
    header('Cache-Control: public, max-age=31536000, immutable');
    header('X-TTS-Provider: google-cloud');
    echo $binary;
    exit;
}

$voices = [
    GOOGLE_TTS_DEFAULT_VOICE,
    'tr-TR-Neural2-B',
    'tr-TR-Wavenet-B',
    'tr-TR-Standard-B'
];

$voices = array_values(array_unique(array_filter($voices)));
$cleanText = preg_replace('/\s+/u', ' ', $text);
$cleanText = trim((string)$cleanText);

$cacheKey = hash('sha256', json_encode([
    't' => $cleanText,
    'r' => round($rate, 2),
    'v' => $voices[0] ?? 'tr-TR-Neural2-B'
], JSON_UNESCAPED_UNICODE));

$cacheFile = ttsCacheDir() . '/' . $cacheKey . '.mp3';
if (is_file($cacheFile)) {
    $binary = @file_get_contents($cacheFile);
    if ($binary !== false && strlen($binary) > 0) {
        outputMp3($binary);
    }
}

$endpoint = 'https://texttospeech.googleapis.com/v1/text:synthesize?key=' . urlencode(GOOGLE_TTS_API_KEY);
$lastError = 'Google TTS başarısız oldu.';

foreach ($voices as $voiceName) {
    $payload = [
        'input' => ['text' => $cleanText],
        'voice' => [
            'languageCode' => 'tr-TR',
            'name' => $voiceName,
            'ssmlGender' => 'MALE'
        ],
        'audioConfig' => [
            'audioEncoding' => 'MP3',
            'speakingRate' => $rate,
            'pitch' => 0
        ]
    ];

    $ch = curl_init($endpoint);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json; charset=utf-8']);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE));
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 6);
    curl_setopt($ch, CURLOPT_TIMEOUT, 14);
    $raw = curl_exec($ch);
    $curlError = curl_error($ch);
    $httpCode = intval(curl_getinfo($ch, CURLINFO_HTTP_CODE));
    curl_close($ch);

    if ($raw === false) {
        $lastError = 'Google TTS bağlantı hatası: ' . $curlError;
        continue;
    }

    $json = json_decode($raw, true);
    $audioBase64 = is_array($json) ? (string)($json['audioContent'] ?? '') : '';
    if ($httpCode >= 200 && $httpCode < 300 && $audioBase64 !== '') {
        $binary = base64_decode($audioBase64, true);
        if ($binary !== false && strlen($binary) > 0) {
            @file_put_contents($cacheFile, $binary);
            outputMp3($binary);
        }
    }

    if (is_array($json) && isset($json['error']['message'])) {
        $lastError = 'Google TTS hata: ' . $json['error']['message'];
    } else {
        $lastError = 'Google TTS hata kodu: ' . $httpCode;
    }
}

jsonError($lastError, 502);

