<?php
// api/auth_middleware.php

/**
 * Güvenlik ve CORS Katmanı
 * Bu dosya tüm /api/*.php dosyalarının en başında çağrılmalıdır.
 */

// 1. CORS Koruması (Origin Whitelist)
// Tarayıcıdan gelen isteklerin (Cross-Origin) sadece belirli domainlerden gelmesine izin verilir.
$allowedOrigins = [
    'http://localhost:5173', // Local Development (Vite)
    'http://localhost',      // Local Development (XAMPP default)
    'https://kuran.emirhangungormez.com.tr', // Production Web
    'http://kuran.emirhangungormez.com.tr'   // Production Web (Fallback)
];

$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';

if (in_array($origin, $allowedOrigins)) {
    header("Access-Control-Allow-Origin: " . $origin);
} else {
    // Mobil uygulamalar gibi Origin başlığı göndermeyen veya whitelist dışı istekler için
    // geçici olarak izin veriyoruz ancak ileride API Key veya Token tabanlı doğrulama eklenebilir.
    // Şimdilik strict bir politika izlemiyoruz, proje geliştiğinde bu kısım sıkılaştırılabilir.
    // header("Access-Control-Allow-Origin: *"); KESİNLİKLE KULLANILMAMALI!
}

header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

// Preflight (OPTIONS) istekleri için yanıt dönüp işlemi sonlandırıyoruz.
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 2. Güvenlik İçin Temel HTTP Başlıkları (Security Headers)
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");

// Content Security Policy (Minimal ve Koruyucu)
header("Content-Security-Policy: default-src 'self'; img-src 'self' https: data:; media-src https:; font-src 'self' data: https:;");

// 3. Caching (Sunucu Yükünü Hafifletmek İçin)
// API yanıtlarının genel (public) olduğunu ve 1 saat (3600 sn) boyunca tarayıcı/CDN tarafından önbelleklenebileceğini belirtir.
// Eğer kullanıcı spesifik (private) bir veri dönülecekse bu başlık ilgili endpoint'te "Cache-Control: no-cache, must-revalidate" olarak ezilmelidir.
header("Cache-Control: public, max-age=3600");

/* 
 * 4. Token / Authorization Altyapısı (Public Olmayan Uç Noktalar İçin)
 * İleride Bookmark, Profil güncelleme vb. POST/PUT işlemlerini dışarıdan (bot/scraper) 
 * korumak için kullanılabilecek örnek bir doğrula fonksiyonudur.
 * Endpoint içinde en üste requireAuth(); yazılarak API kilitlenebilir.
 */
function requireAuth() {
    $headers = apache_request_headers();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';
    
    // Basit bir API Key / Token mantığı (Gerçek senaryoda JWT veya DB doğrulama gerekir)
    $validTokens = ['YOUR_SECRET_API_KEY_HERE']; 
    
    if (empty($authHeader) || !preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Unauthorized: Token missing']);
        exit();
    }
    
    $token = $matches[1];
    if (!in_array($token, $validTokens)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Forbidden: Invalid token']);
        exit();
    }
}

// Sanitize Fonksiyonları (Eğer JSON çıktısında dışarıdan veri dönülecekse kullanılır)
function escapeJsonStrings($data) {
    if (is_array($data)) {
        foreach ($data as $key => $value) {
            $data[$key] = escapeJsonStrings($value);
        }
    } elseif (is_string($data)) {
        // Temel XSS koruması (veritabanından gelen veya dışarıdan alınan zararlı js taglarını zararsız hale getirir)
        return htmlspecialchars($data, ENT_QUOTES, 'UTF-8');
    }
    return $data;
}
?>
