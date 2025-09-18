# Script PowerShell per la gestione Docker - Gestione Stampante
# Uso: .\docker-scripts.ps1 [comando]
# Comandi disponibili: build, start, stop, restart, logs, cleanup, status, shell

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("build", "start", "stop", "restart", "logs", "cleanup", "status", "shell", "dev")]
    [string]$Command
)

$projectName = "gestione-stampante"
$composeFile = "docker-compose.yaml"

function Write-ColoredOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Show-Header {
    param([string]$Title)
    Write-Host ""
    Write-ColoredOutput "=" * 60 -Color "Cyan"
    Write-ColoredOutput "  $Title" -Color "Yellow"
    Write-ColoredOutput "=" * 60 -Color "Cyan"
    Write-Host ""
}

switch ($Command) {
    "build" {
        Show-Header "🔨 BUILD CONTAINERS"
        Write-ColoredOutput "Building containers..." -Color "Green"
        docker-compose -f $composeFile build --no-cache
        if ($LASTEXITCODE -eq 0) {
            Write-ColoredOutput "✅ Build completato con successo!" -Color "Green"
        } else {
            Write-ColoredOutput "❌ Build fallito!" -Color "Red"
            exit 1
        }
    }

    "start" {
        Show-Header "🚀 START CONTAINERS"
        Write-ColoredOutput "Starting containers..." -Color "Green"
        docker-compose -f $composeFile up -d
        if ($LASTEXITCODE -eq 0) {
            Write-ColoredOutput "✅ Containers avviati con successo!" -Color "Green"
            Write-ColoredOutput "📱 Applicazione disponibile su: http://localhost:800" -Color "Cyan"
            Write-ColoredOutput "🗄️  Database disponibile su: localhost:3500" -Color "Cyan"
        } else {
            Write-ColoredOutput "❌ Avvio fallito!" -Color "Red"
            exit 1
        }
    }

    "stop" {
        Show-Header "🛑 STOP CONTAINERS"
        Write-ColoredOutput "Stopping containers..." -Color "Yellow"
        docker-compose -f $composeFile down
        if ($LASTEXITCODE -eq 0) {
            Write-ColoredOutput "✅ Containers fermati con successo!" -Color "Green"
        }
    }

    "restart" {
        Show-Header "🔄 RESTART CONTAINERS"
        Write-ColoredOutput "Restarting containers..." -Color "Yellow"
        docker-compose -f $composeFile restart
        if ($LASTEXITCODE -eq 0) {
            Write-ColoredOutput "✅ Containers riavviati con successo!" -Color "Green"
        }
    }

    "logs" {
        Show-Header "📋 CONTAINER LOGS"
        Write-ColoredOutput "Showing logs (Ctrl+C per uscire)..." -Color "Green"
        docker-compose -f $composeFile logs -f --tail=100
    }

    "status" {
        Show-Header "📊 CONTAINER STATUS"
        docker-compose -f $composeFile ps
        Write-Host ""
        Write-ColoredOutput "Informazioni di rete:" -Color "Cyan"
        docker network ls | Where-Object { $_ -match $projectName }
        Write-Host ""
        Write-ColoredOutput "Volumi:" -Color "Cyan"
        docker volume ls | Where-Object { $_ -match $projectName }
    }

    "shell" {
        Show-Header "🐚 CONTAINER SHELL"
        Write-ColoredOutput "Accesso shell al container dell'app..." -Color "Green"
        docker-compose -f $composeFile exec app sh
    }

    "cleanup" {
        Show-Header "🧹 CLEANUP"
        Write-ColoredOutput "Fermando containers..." -Color "Yellow"
        docker-compose -f $composeFile down

        Write-ColoredOutput "Rimuovendo immagini unused..." -Color "Yellow"
        docker image prune -f

        Write-ColoredOutput "Rimuovendo volumi unused..." -Color "Yellow"
        docker volume prune -f

        Write-ColoredOutput "Rimuovendo reti unused..." -Color "Yellow"
        docker network prune -f

        Write-ColoredOutput "✅ Cleanup completato!" -Color "Green"
    }

    "dev" {
        Show-Header "🔧 DEVELOPMENT MODE"
        Write-ColoredOutput "Avvio in modalità sviluppo con live-reload..." -Color "Green"
        
        # Crea docker-compose.dev.yaml se non esiste
        if (-not (Test-Path "docker-compose.dev.yaml")) {
            Write-ColoredOutput "Creando docker-compose.dev.yaml..." -Color "Yellow"
            $devCompose = @"
version: '3.8'

services:
  app:
    volumes:
      - .:/usr/src/app:cached
      - /usr/src/app/node_modules
    environment:
      NODE_ENV: development
    command: node --watch docker-init.js
"@
            $devCompose | Out-File -FilePath "docker-compose.dev.yaml" -Encoding UTF8
        }
        
        docker-compose -f $composeFile -f docker-compose.dev.yaml up -d
        if ($LASTEXITCODE -eq 0) {
            Write-ColoredOutput "✅ Modalità sviluppo attivata!" -Color "Green"
            Write-ColoredOutput "📝 I file vengono sincronizzati automaticamente" -Color "Cyan"
        }
    }
}

Write-Host ""
Write-ColoredOutput "Operazione completata!" -Color "Green"
Write-Host ""