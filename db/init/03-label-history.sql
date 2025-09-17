-- Tabella per lo storico delle etichette
USE stampante;

-- Crea la tabella LABEL_HISTORY
CREATE TABLE IF NOT EXISTS LABEL_HISTORY (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    username VARCHAR(50) NOT NULL,
    label_type VARCHAR(100) NOT NULL,
    label_data TEXT NOT NULL,
    command_generated TEXT NOT NULL,
    template_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    printed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('success', 'failed', 'pending') DEFAULT 'success',
    notes TEXT,
    
    INDEX idx_user_id (user_id),
    INDEX idx_username (username),
    INDEX idx_label_type (label_type),
    INDEX idx_created_at (created_at),
    INDEX idx_status (status),
    
    FOREIGN KEY (user_id) REFERENCES USERS(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Crea la tabella LABEL_TEMPLATES per i template salvati
CREATE TABLE IF NOT EXISTS LABEL_TEMPLATES (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    template_type VARCHAR(100) NOT NULL,
    template_data JSON NOT NULL,
    command_template TEXT NOT NULL,
    created_by INT NOT NULL,
    created_by_username VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_public BOOLEAN DEFAULT FALSE,
    usage_count INT DEFAULT 0,
    
    INDEX idx_name (name),
    INDEX idx_template_type (template_type),
    INDEX idx_created_by (created_by),
    INDEX idx_created_at (created_at),
    INDEX idx_is_public (is_public),
    
    FOREIGN KEY (created_by) REFERENCES USERS(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Inserisci alcuni template di esempio
INSERT IGNORE INTO LABEL_TEMPLATES (name, description, template_type, template_data, command_template, created_by, created_by_username, is_public) VALUES
('Template QR Base', 'Template base per codici QR semplici', 'QR_CODE', 
 '{"type": "QR", "size": {"width": 50, "height": 50}, "position": {"x": 10, "y": 10}, "options": {"error_correction": "M"}}', 
 'QR{x},{y},{size},"[DATA]"', 
 1, 'admin', TRUE),
('Template Barcode EAN13', 'Template per codici a barre EAN13', 'BARCODE', 
 '{"type": "BARCODE", "format": "EAN13", "size": {"width": 80, "height": 20}, "position": {"x": 10, "y": 10}}', 
 'B{x},{y},{width},{height},"[DATA]"', 
 1, 'admin', TRUE);

SELECT 'Label history and templates tables created successfully' as status;