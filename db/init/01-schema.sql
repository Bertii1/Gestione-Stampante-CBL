-- Schema inizializzazione database per Docker
-- Questo script viene eseguito automaticamente all'avvio del container MySQL

-- Crea database se non esiste
CREATE DATABASE IF NOT EXISTS stampante CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Crea utente per l'applicazione
CREATE USER IF NOT EXISTS 'app'@'%' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON stampante.* TO 'app'@'%';
FLUSH PRIVILEGES;

-- Usa il database stampante
USE stampante;

-- Crea la tabella USERS con schema completo
CREATE TABLE IF NOT EXISTS USERS (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    INDEX idx_username (username),
    INDEX idx_role (role),
    INDEX idx_created_at (created_at),
    INDEX idx_last_login (last_login)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Log di inizializzazione
SELECT 'Database schema initialized successfully' as status;