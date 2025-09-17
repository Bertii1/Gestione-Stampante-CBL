# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a thermal label printer management application (`gestione-stampante`) that communicates with thermal printers via Telnet to generate various types of barcodes and labels. The application provides a web interface for composing printer commands and sending them to thermal printers.

### Technology Stack
- **Backend**: Node.js with Express
- **Frontend**: HTML, CSS, JavaScript (vanilla)
- **Database**: MySQL 5.7
- **Environment**: Docker containerized application
- **Communication**: Telnet client for printer communication

## Architecture

### Backend Structure (`Router.js`)
The main server file handles all API endpoints and core functionality:
- **Authentication**: JWT-based user authentication with bcrypt password hashing
- **Database**: MySQL2 connection with promise-based queries for user management
- **Printer Communication**: Telnet client for sending commands to thermal printers
- **Static File Serving**: Serves frontend assets and configuration files

### Frontend Structure (`Frontend/`)
- **home/**: Main dashboard for label generation with dynamic form controls
- **login/**: User authentication interface  
- **admin/**: Administrative functions (currently minimal implementation)
- **style.css**: Shared styling across all pages

### Command System
Two JSON configuration files define printer commands:
- **`commands.json`**: UI-friendly command definitions with form controls for 1D/2D barcodes
- **`all_commands.json`**: Complete technical reference of all printer commands (T, V, B1, B2, B3, BD, etc.)

The frontend dynamically generates form controls based on command definitions, supporting:
- Value inputs with validation ranges
- Select dropdowns with predefined options
- Range sliders for numeric parameters
- Advanced/basic option categorization
- Context-sensitive options based on barcode type selection

### Database Schema
- **USERS table**: `id`, `username`, `password` (hashed), `role`

## Development Commands

### Running the Application
```powershell
# Start with Docker Compose (recommended)
docker-compose up --build

# Development mode (requires MySQL running separately)
node Router.js
```

### Package Management
```powershell
# Install dependencies
npm install

# Install specific packages (as defined in dockerfile)
npm install express mysql2 jsonwebtoken bcrypt telnet-client
```

### Database Management
```powershell
# Start MySQL container only
docker-compose up db

# Import database schema
docker exec -i <mysql_container_id> mysql -u root -p stampante < dump-stampante-202509151712.sql
```

### Docker Operations
```powershell
# Build and run containers
docker-compose up --build

# Run in background
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs app
docker-compose logs db
```

## Environment Configuration

### Docker Environment Variables (docker-compose.yaml)
- `DB_HOST`: MySQL host (set to 'db' service)
- `DB_USER`: Database user (app)
- `DB_PASSWORD`: Database password
- `DB_NAME`: Database name (stampante)
- `SALT`: bcrypt salt rounds (10)
- `TOKEN_SECRET`: JWT signing secret
- `TN_HOST`: Thermal printer IP address
- `TN_PORT`: Thermal printer Telnet port

### Ports
- **Application**: 3000
- **Database**: 3306

## Key Technical Details

### Printer Command Generation
The application builds printer commands dynamically based on user input:
1. User selects barcode type (1D/2D)
2. Frontend loads appropriate options from `commands.json`
3. Form controls are generated based on option types (value, select, range)
4. Commands are constructed using position-based parameters (p1, p2, etc.)
5. Final command sent via Telnet to printer

### Authentication Flow
1. Login via `/login` endpoint with username/password
2. Password verified using bcrypt comparison
3. JWT token generated and optionally stored in cookies
4. Token used for subsequent authenticated requests

### File Structure Context
- `Router.js`: Main application entry point
- `Frontend/home/home.js`: Complex UI generation logic for printer commands  
- `commands.json`: User-facing command definitions
- `all_commands.json`: Complete technical printer command reference
- `dockerfile`: Node.js 20 container configuration
- `docker-compose.yaml`: Multi-service application stack

## Development Notes

### Frontend Architecture
The home interface uses a sophisticated dynamic form generation system that:
- Parses JSON command definitions into HTML form controls
- Handles advanced/basic option visibility toggling
- Supports conditional options based on barcode type selection
- Generates printer commands in real-time as users modify parameters

### Database Connections
The application includes retry logic for MySQL connections to handle container startup timing issues.

### Telnet Communication
Direct Telnet socket communication with thermal printers using the `telnet-client` package. Commands are sent with proper line termination (`\r\n`) and print trigger (`P\r\n`).