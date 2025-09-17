-- Inserimento utenti di default per Docker
-- Password hashate con bcrypt (salt rounds = 10)

USE stampante;

-- Inserisci utente admin di default se non esiste
-- Username: admin, Password: admin123
INSERT IGNORE INTO USERS (username, password, role, created_at) VALUES 
('admin', '$2b$10$z9FRASo3uk.QL5MkwIEF8eGJkfFnWJ5j1/Qw1pM9rpWrf/Zwjj0XW', 'admin', NOW());

-- Inserisci utente operatore di default se non esiste  
-- Username: operatore, Password: test123
INSERT IGNORE INTO USERS (username, password, role, created_at) VALUES 
('operatore', '$2b$10$nGmBNA9r9lxnwqjj/b0i1O/RVuhs0I.UVhwh5bxtwBkhEeQCHRvhi', 'user', NOW());

-- Verifica utenti creati
SELECT 'Default users created' as status;
SELECT username, role, created_at FROM USERS ORDER BY created_at;