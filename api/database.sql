-- Kullanıcı Playlistleri
CREATE TABLE IF NOT EXISTS user_playlists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  items_json TEXT NOT NULL, -- [{"type":"surah","id":36,"name":"Yasin"}, ...]
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Destekçi / Plus sistemi istatistikleri
CREATE TABLE IF NOT EXISTS user_support_stats (
  user_id INT PRIMARY KEY,
  ads_enabled TINYINT(1) NOT NULL DEFAULT 0,
  ads_watched INT NOT NULL DEFAULT 0,
  usage_seconds BIGINT NOT NULL DEFAULT 0,
  supporter_until DATETIME NULL,
  milestone_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_ads (ads_watched),
  INDEX idx_usage (usage_seconds),
  INDEX idx_supporter_until (supporter_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Kuran App Database Schema
-- MySQL

CREATE DATABASE IF NOT EXISTS kuran_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE kuran_db;

-- Sureler
CREATE TABLE IF NOT EXISTS surahs (
  id INT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  name_en VARCHAR(50),
  name_original VARCHAR(100),
  slug VARCHAR(50),
  verse_count INT NOT NULL,
  page_number INT DEFAULT 0,
  audio_mp3 VARCHAR(255),
  audio_duration INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ayetler
CREATE TABLE IF NOT EXISTS verses (
  id INT PRIMARY KEY,
  surah_id INT NOT NULL,
  verse_number INT NOT NULL,
  verse_text TEXT NOT NULL,
  verse_simplified TEXT,
  verse_without_vowel TEXT,
    transcription TEXT,
    transcription_en TEXT,
    audio_mp3 VARCHAR(255),
    audio_duration INT DEFAULT 0,
    page INT DEFAULT 0,
    juz_number INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_surah (surah_id),
  INDEX idx_surah_verse (surah_id, verse_number),
  INDEX idx_page (page),
  INDEX idx_juz (juz_number),
  FOREIGN KEY (surah_id) REFERENCES surahs(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tercüme yazarları
CREATE TABLE IF NOT EXISTS authors (
  id INT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  language VARCHAR(5) DEFAULT 'tr',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tercümeler
CREATE TABLE IF NOT EXISTS translations (
  id INT PRIMARY KEY,
  verse_id INT NOT NULL,
  author_id INT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_verse (verse_id),
  INDEX idx_author (author_id),
  INDEX idx_verse_author (verse_id, author_id),
  FULLTEXT idx_text (text),
  FOREIGN KEY (verse_id) REFERENCES verses(id),
  FOREIGN KEY (author_id) REFERENCES authors(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dipnotlar
CREATE TABLE IF NOT EXISTS footnotes (
  id INT PRIMARY KEY,
  translation_id INT NOT NULL,
  number INT DEFAULT 1,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_translation (translation_id),
  FOREIGN KEY (translation_id) REFERENCES translations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Kök kelimeler
CREATE TABLE IF NOT EXISTS roots (
  id INT PRIMARY KEY,
  latin VARCHAR(20),
  arabic VARCHAR(20),
  transcription VARCHAR(50),
  mean_tr TEXT,
  mean_en TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_latin (latin),
  INDEX idx_arabic (arabic)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Kelime kelime analiz
CREATE TABLE IF NOT EXISTS verse_words (
  id INT PRIMARY KEY,
  verse_id INT NOT NULL,
  sort_number INT DEFAULT 1,
  arabic VARCHAR(100),
  transcription_tr VARCHAR(100),
  transcription_en VARCHAR(100),
  translation_tr VARCHAR(255),
  translation_en VARCHAR(255),
  root_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_verse (verse_id),
  INDEX idx_root (root_id),
  FOREIGN KEY (verse_id) REFERENCES verses(id),
  FOREIGN KEY (root_id) REFERENCES roots(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- KULLANICI SİSTEMİ TABLOLARI --

-- Kullanıcılar
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  full_name VARCHAR(100),
  email VARCHAR(100) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  profile_icon VARCHAR(50) DEFAULT 'muessis',
  pro_expires_at DATETIME NULL,
  bio TEXT,
  hatim_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rewarded Ad callback kayıtları (Quick Pro)
CREATE TABLE IF NOT EXISTS rewarded_ad_callbacks (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  transaction_id VARCHAR(128) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  reward_item VARCHAR(128) DEFAULT 'quick_pro_hour',
  reward_amount INT NOT NULL DEFAULT 1,
  callback_payload TEXT,
  key_id VARCHAR(64) NULL,
  signature TEXT NULL,
  verified TINYINT(1) NOT NULL DEFAULT 0,
  source VARCHAR(32) NOT NULL DEFAULT 'google_ssv',
  consumed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reward_user_created (user_id, created_at),
  INDEX idx_reward_verified (verified),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Günlük reklam kullanım limiti (Quick Pro)
CREATE TABLE IF NOT EXISTS user_daily_pro_ad_usage (
  user_id INT NOT NULL,
  usage_date DATE NOT NULL,
  used_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, usage_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verilen Quick Pro süre logları
CREATE TABLE IF NOT EXISTS user_pro_access_grants (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  callback_id BIGINT NULL,
  transaction_id VARCHAR(128) NULL,
  previous_expires_at DATETIME NULL,
  new_expires_at DATETIME NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 60,
  source VARCHAR(32) NOT NULL DEFAULT 'rewarded_ad',
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_pro_grant_tx (transaction_id),
  INDEX idx_pro_grant_user (user_id, granted_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (callback_id) REFERENCES rewarded_ad_callbacks(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Kullanıcı Ayarları (JSON veya Key-Value)
CREATE TABLE IF NOT EXISTS user_settings (
    user_id INT PRIMARY KEY,
    settings_json TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Kullanıcı Ayraçları ve Favorileri
CREATE TABLE IF NOT EXISTS user_bookmarks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    item_id VARCHAR(50) NOT NULL, -- "surah-1" veya "1-1" (surah-verse) formatı
    item_type ENUM('surah', 'verse', 'last_read', 'string_bookmark') NOT NULL,
    surah_id INT,
    verse_number INT,
    metadata TEXT, -- JSON formatında ek bilgiler (surah name vb.)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY idx_user_item (user_id, item_id, item_type),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Kullanıcı Notları
CREATE TABLE IF NOT EXISTS user_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    verse_id INT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (verse_id) REFERENCES verses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
