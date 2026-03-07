<?php
// GET api/surahs.php — Returns all surahs
require_once __DIR__ . '/config.php';
setCorsHeaders();

$db = getDB();
$surahs = $db->query('
    SELECT id, name, name_en, name_original, slug, verse_count, page_number, audio_mp3, audio_duration
    FROM surahs 
    ORDER BY id
')->fetchAll();

jsonResponse(['data' => $surahs]);
