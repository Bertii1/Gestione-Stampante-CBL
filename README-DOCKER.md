# Gestione Stampante - Docker Setup

Questo documento descrive come utilizzare Docker per avviare e gestire l'applicazione "Gestione Stampante".

## 📋 Prerequisiti

- **Docker** (versione 20.10+)
- **Docker Compose** (versione 2.0+)
- **PowerShell** (per Windows) o **Bash** (per Linux/macOS)

## 🚀 Avvio Rapido

### 1. Configurazione Ambiente

Copia il file di esempio delle variabili d'ambiente:

```powershell
Copy-Item .env.example .env
```

Modifica il file `.env` secondo le tue necessità:

```bash
# Configurazione Database
DB_ROOT_PASSWORD=your_secure_password
DB_USER=app
DB_PASSWORD=your_app_password
DB_NAME=stampante

# Configurazione Applicazione
APP_PORT=800
TOKEN_SECRET=your_secret_token

# Configurazione Stampante
TN_HOST=your_printer_ip
TN_PORT=100
```

### 2. Avvio con Script PowerShell

Per utilizzare gli script di gestione Docker:

```powershell
# Build dei container
.\docker-scripts.ps1 build

# Avvio dell'applicazione
.\docker-scripts.ps1 start

# Visualizzazione dei logs
.\docker-scripts.ps1 logs

# Stop dell'applicazione
.\docker-scripts.ps1 stop
```

### 3. Avvio Manuale

Alternativamente, puoi usare i comandi Docker Compose direttamente:

```powershell
# Build e avvio
docker-compose up -d --build

# Solo avvio
docker-compose up -d

# Stop
docker-compose down
```

## 🛠️ Comandi Disponibili

Lo script `docker-scripts.ps1` supporta i seguenti comandi:

| Comando | Descrizione |
|---------|-------------|
| `build` | Costruisce le immagini Docker |
| `start` | Avvia i container in background |
| `stop` | Ferma tutti i container |
| `restart` | Riavvia i container |
| `logs` | Mostra i logs in tempo reale |
| `status` | Mostra lo stato dei container |
| `shell` | Accede alla shell del container app |
| `cleanup` | Rimuove container, immagini e volumi unused |
| `dev` | Avvia in modalità sviluppo con live-reload |

## 📊 Servizi

### Applicazione Web
- **URL**: http://localhost:800
- **Container**: `gestione-stampante_app`
- **Health Check**: http://localhost:800/health

### Database MySQL
- **Host**: localhost
- **Porta**: 3500
- **Database**: stampante
- **Container**: `gestione-stampante_db`

## 🔧 Modalità Sviluppo

Per lo sviluppo con live-reload:

```powershell
.\docker-scripts.ps1 dev
```

Questo comando:
- Monta il codice sorgente nel container
- Abilita il watch mode di Node.js
- Riavvia automaticamente l'app quando i file cambiano

## 📁 Struttura File Docker

```
├── dockerfile                 # Definizione immagine app
├── docker-compose.yaml        # Configurazione servizi
├── docker-compose.dev.yaml    # Override per sviluppo (auto-generato)
├── .dockerignore              # File esclusi dal build
├── .env.example               # Esempio variabili ambiente
├── .env                       # Variabili ambiente (da creare)
└── docker-scripts.ps1         # Script di gestione
```

## 🔍 Troubleshooting

### Container non si avviano

1. Verifica che Docker sia in esecuzione:
   ```powershell
   docker version
   ```

2. Controlla i logs:
   ```powershell
   .\docker-scripts.ps1 logs
   ```

3. Verifica lo stato dei container:
   ```powershell
   .\docker-scripts.ps1 status
   ```

### Problemi di connessione al database

1. Verifica che il container del database sia healthy:
   ```powershell
   docker-compose ps
   ```

2. Controlla i logs del database:
   ```powershell
   docker-compose logs db
   ```

3. Il database potrebbe impiegare alcuni minuti per inizializzarsi completamente

### Reset completo

Per resettare completamente l'ambiente:

```powershell
.\docker-scripts.ps1 cleanup
docker volume rm gestione-stampante_mysql_data
.\docker-scripts.ps1 build
.\docker-scripts.ps1 start
```

## 🔒 Sicurezza

### Raccomandazioni di Sicurezza

1. **Cambia le password predefinite** nel file `.env`
2. **Genera un nuovo TOKEN_SECRET** per la produzione
3. **Non committare mai il file `.env`** nel repository
4. **Usa reti Docker isolate** (già configurato)
5. **L'app gira con utente non-root** (già configurato)

### Health Checks

I container includono health check automatici:

- **Database**: Verifica connessione MySQL
- **App**: Controlla endpoint `/health`

Puoi verificare lo stato:

```powershell
docker-compose ps
```

## 📈 Performance

### Ottimizzazioni incluse

- **Immagine Alpine**: Riduce dimensioni dell'immagine
- **Multi-stage build**: Ottimizza cache Docker
- **Volume caching**: Migliora performance I/O
- **Health checks**: Rileva problemi automaticamente

### Monitoraggio

Per monitorare l'uso delle risorse:

```powershell
docker stats
```

## 📝 Note Aggiuntive

- I dati del database sono persistiti nel volume `mysql_data`
- L'applicazione supporta hot-reload in modalità sviluppo
- I logs sono disponibili tramite `docker-compose logs`
- La configurazione è centralizzata nel file `.env`

Per supporto aggiuntivo, consulta la documentazione principale o i log dell'applicazione.