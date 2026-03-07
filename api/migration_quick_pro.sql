-- Kuran23 Quick Pro (Watch-to-Access) migration
-- MySQL 8+

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pro_expires_at DATETIME NULL AFTER profile_icon;

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
  INDEX idx_user_created (user_id, created_at),
  INDEX idx_verified (verified),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_daily_pro_ad_usage (
  user_id INT NOT NULL,
  usage_date DATE NOT NULL,
  used_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, usage_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  UNIQUE KEY uniq_transaction_id (transaction_id),
  INDEX idx_user_granted (user_id, granted_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (callback_id) REFERENCES rewarded_ad_callbacks(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
