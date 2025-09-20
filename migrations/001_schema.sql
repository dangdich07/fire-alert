CREATE DATABASE IF NOT EXISTS fire_alert_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fire_alert_db;

CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS devices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(64) NOT NULL UNIQUE,        -- Mã thiết bị (in trên mạch)
  name VARCHAR(150) NOT NULL,
  location VARCHAR(200),
  owner_user_id INT NULL,
  status ENUM('ok','alarm','safe','offline') NOT NULL DEFAULT 'ok',
  last_seen TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS alerts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  device_id INT NOT NULL,
  type ENUM('smoke','fire') NOT NULL,
  level TINYINT UNSIGNED DEFAULT 0,        -- 0..100 (tuỳ cảm biến)
  message VARCHAR(300),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ack_by_user_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  FOREIGN KEY (ack_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_alert_active (is_active, created_at)
);

-- Additional helpful indexes
CREATE INDEX idx_devices_owner ON devices(owner_user_id);
CREATE INDEX idx_devices_last_seen ON devices(last_seen);
CREATE INDEX idx_alerts_device ON alerts(device_id);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);

-- Videos table for escape guidance videos
CREATE TABLE IF NOT EXISTS videos (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT,
  mime_type VARCHAR(100),
  duration_seconds INT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Add video_url to alerts table
ALTER TABLE alerts ADD COLUMN video_url VARCHAR(500) NULL AFTER message;

-- FCM tokens for push notifications
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  token VARCHAR(500) NOT NULL,
  device_type ENUM('android', 'ios', 'web') DEFAULT 'android',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_token (user_id, token)
);

CREATE INDEX idx_fcm_tokens_user ON fcm_tokens(user_id);
CREATE INDEX idx_fcm_tokens_active ON fcm_tokens(is_active);
