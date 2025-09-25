// Script di inizializzazione Docker per l'applicazione
// Questo script si assicura che il database sia pronto prima di avviare l'app

import mysql from 'mysql2';
import { spawn } from 'child_process';

const env = process.env;

const dbConfig = {
  host: env.DB_HOST || 'db',
  user: env.DB_USER || 'app', 
  password: env.DB_PASSWORD || 'password',
  database: env.DB_NAME || 'stampante',
  port: 3306,
};

// Colori per i log
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.cyan) {
  console.log(`${color}[DOCKER-INIT]${colors.reset} ${message}`);
}

// Funzione per attendere che il database sia pronto
async function waitForDatabase(maxRetries = 30) {
  log('🚀 Avvio inizializzazione Docker...');
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log(`📡 Tentativo di connessione al database (${attempt}/${maxRetries})...`, colors.yellow);
      
      const connection = mysql.createConnection(dbConfig);
      
      await new Promise((resolve, reject) => {
        connection.connect((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      
      // Test query per verificare che la tabella USERS esista
      await new Promise((resolve, reject) => {
        connection.query('SELECT COUNT(*) as count FROM USERS', (err, results) => {
          if (err) {
            reject(err);
          } else {
            resolve(results);
          }
        });
      });
      
      connection.end();
      
      log('✅ Database pronto e funzionante!', colors.green);
      return true;
      
    } catch (error) {
      log(`❌ Connessione fallita: ${error.code || error.message}`, colors.red);
      
      if (attempt === maxRetries) {
        log('🔥 Numero massimo di tentativi raggiunto!', colors.red);
        process.exit(1);
      }
      
      // Attendi prima del prossimo tentativo
      log(`⏳ Attesa 2 secondi prima del prossimo tentativo...`, colors.yellow);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// Funzione per verificare gli utenti di default
async function verifyDefaultUsers() {
  try {
    log('👥 Verifica utenti di default...', colors.blue);
    
    const connection = mysql.createConnection(dbConfig);
    
    await new Promise((resolve, reject) => {
      connection.connect((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    const users = await new Promise((resolve, reject) => {
      connection.query('SELECT username, role FROM USERS ORDER BY created_at', (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    connection.end();
    
    if (users.length === 0) {
      log('⚠️  Nessun utente trovato nel database!', colors.yellow);
    } else {
      log(`✅ Trovati ${users.length} utenti nel database:`, colors.green);
      users.forEach(user => {
        log(`   - ${user.username} (${user.role})`, colors.green);
      });
    }
    
    return users.length > 0;
    
  } catch (error) {
    log(`❌ Errore nella verifica utenti: ${error.message}`, colors.red);
    return false;
  }
}

// Funzione per avviare l'applicazione principale
function startApplication() {
  log('🚀 Avvio applicazione principale...', colors.green);
  
  const app = spawn('node', ['Router.js'], {
    stdio: 'inherit',
    env: process.env
  });
  
  app.on('error', (error) => {
    log(`❌ Errore nell'avvio dell'applicazione: ${error.message}`, colors.red);
    process.exit(1);
  });
  
  app.on('exit', (code) => {
    log(`🔄 Applicazione terminata con codice ${code}`, colors.yellow);
    process.exit(code);
  });
  
  // Gestione graceful shutdown
  process.on('SIGTERM', () => {
    log('🛑 Ricevuto SIGTERM, terminazione applicazione...', colors.yellow);
    app.kill('SIGTERM');
  });
  
  process.on('SIGINT', () => {
    log('🛑 Ricevuto SIGINT, terminazione applicazione...', colors.yellow);
    app.kill('SIGINT');
  });
}

// Funzione principale
async function main() {
  try {
    log('🐳 === INIZIALIZZAZIONE DOCKER LABELGEN ===', colors.magenta);
    log(`📊 Configurazione database: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    
    // Aspetta che il database sia pronto
    await waitForDatabase();
    
    // Verifica utenti di default
    await verifyDefaultUsers();
    
    log('✅ Inizializzazione completata con successo!', colors.green);
    log('🚀 Avvio applicazione...', colors.cyan);
    
    // Avvia l'applicazione principale
    startApplication();
    
  } catch (error) {
    log(`💥 Errore critico durante l'inizializzazione: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  }
}

// Avvia il processo
main().catch(error => {
  log(`💥 Errore non gestito: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
