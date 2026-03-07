<?php
require_once __DIR__ . '/config.php';
setCorsHeaders();
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

$db = getDB();
$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $data = is_array($data) ? $data : [];

    if ($action === 'register') {
        $username = trim((string)($data['username'] ?? ''));
        $fullName = trim((string)($data['full_name'] ?? ''));
        $password = (string)($data['password'] ?? '');
        $emailInput = trim((string)($data['email'] ?? ''));
        $email = $emailInput !== '' ? $emailInput : null;
        $profileIcon = trim((string)($data['profile_icon'] ?? 'muessis')) ?: 'muessis';

        if ($username === '' || $password === '') {
            jsonError('Kullanıcı adı ve şifre gereklidir.');
        }

        if (!preg_match('/^[a-zA-Z0-9._-]{3,50}$/', $username)) {
            jsonError('Kullanıcı adı 3-50 karakter olmalı ve sadece harf/sayı/._- içermelidir.');
        }

        if (strlen($password) < 6) {
            jsonError('Şifre en az 6 karakter olmalıdır.');
        }

        if ($email !== null && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonError('Geçerli bir e-posta adresi girin.');
        }

        $stmt = $db->prepare('SELECT id FROM users WHERE username = ? LIMIT 1');
        $stmt->execute([$username]);
        if ($stmt->fetch()) {
            jsonError('Bu kullanıcı adı zaten alınmış.');
        }

        $passwordHash = password_hash($password, PASSWORD_DEFAULT);

        try {
            $stmt = $db->prepare('INSERT INTO users (username, full_name, password_hash, email, profile_icon) VALUES (?, ?, ?, ?, ?)');
            $stmt->execute([$username, $fullName !== '' ? $fullName : null, $passwordHash, $email, $profileIcon]);
            $userId = intval($db->lastInsertId());

            $stmt = $db->prepare('INSERT INTO user_settings (user_id, settings_json) VALUES (?, ?)');
            $stmt->execute([
                $userId,
                json_encode([
                    'userName' => $fullName !== '' ? $fullName : $username,
                    'profileIcon' => $profileIcon,
                ], JSON_UNESCAPED_UNICODE),
            ]);

            jsonResponse([
                'success' => true,
                'user' => [
                    'id' => $userId,
                    'username' => $username,
                    'full_name' => $fullName,
                    'profile_icon' => $profileIcon,
                    'is_super_admin' => isSuperAdminUser($db, $userId),
                ],
                'token' => issueAuthToken($userId, $username),
            ]);
        } catch (PDOException $e) {
            if (intval($e->errorInfo[1] ?? 0) === 1062) {
                jsonError('Bu kullanıcı adı veya e-posta zaten kullanımda.', 409);
            }
            jsonError('Kayıt sırasında bir hata oluştu.', 500);
        }
    }

    if ($action === 'login') {
        $username = trim((string)($data['username'] ?? ''));
        $password = (string)($data['password'] ?? '');

        if ($username === '' || $password === '') {
            jsonError('Kullanıcı adı ve şifre gereklidir.');
        }

        $stmt = $db->prepare('SELECT * FROM users WHERE username = ? LIMIT 1');
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            jsonError('Geçersiz kullanıcı adı veya şifre.', 401);
        }

        $stmt = $db->prepare('SELECT settings_json FROM user_settings WHERE user_id = ? LIMIT 1');
        $stmt->execute([$user['id']]);
        $settings = $stmt->fetch();

        jsonResponse([
            'success' => true,
            'user' => [
                'id' => intval($user['id']),
                'username' => $user['username'],
                'full_name' => $user['full_name'],
                'profile_icon' => $user['profile_icon'],
                'bio' => $user['bio'],
                'hatim_count' => intval($user['hatim_count'] ?? 0),
                'is_super_admin' => isSuperAdminUser($db, $user['id']),
            ],
            'settings' => $settings ? json_decode($settings['settings_json'], true) : [],
            'token' => issueAuthToken($user['id'], $user['username']),
        ]);
    }

    if ($action === 'change-password') {
        $authUser = requireAuthenticatedUser($db);
        $userId = intval($authUser['id']);
        $oldPassword = (string)($data['old_password'] ?? '');
        $newPassword = (string)($data['new_password'] ?? '');

        if ($oldPassword === '' || $newPassword === '') {
            jsonError('Tüm alanlar gereklidir.');
        }

        if (strlen($newPassword) < 6) {
            jsonError('Yeni şifre en az 6 karakter olmalıdır.');
        }

        $stmt = $db->prepare('SELECT password_hash FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$userId]);
        $row = $stmt->fetch();

        if (!$row || !password_verify($oldPassword, $row['password_hash'])) {
            jsonError('Mevcut şifre hatalı.', 401);
        }

        $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
        $stmt = $db->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        $stmt->execute([$newHash, $userId]);

        jsonResponse(['success' => true, 'message' => 'Şifreniz başarıyla güncellendi.']);
    }
}

jsonError('Geçersiz istek.', 405);