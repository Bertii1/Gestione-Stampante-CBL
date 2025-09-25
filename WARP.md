# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Repository: Gestione-Stampante-CBL (Node.js, Express 5, MySQL, Telnet printer service)

1) Common commands (pwsh on Windows)
- Install dependencies
```powershell path=null start=null
npm ci  # or: npm install
```

- Run the backend locally (ensure required env vars are set)
Required env vars (app will refuse to start if missing): DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, TOKEN_SECRET, TN_HOST
```powershell path=null start=null
$env:DB_HOST = "localhost"
$env:DB_USER = "app"
$env:DB_PASSWORD = "{{DB_PASSWORD}}"
$env:DB_NAME = "stampante"
$env:TOKEN_SECRET = "{{TOKEN_SECRET}}"
$env:TN_HOST = "10.2.12.244"
$env:TN_PORT = "100"
$env:PORT = "800"
node Router.js
```

- Health check (after start)
```powershell path=null start=null
curl http://localhost:800/health
```

- Docker (as documented in README)
```powershell path=null start=null
# Start all services in background
docker-compose up -d

# Show status and logs
docker-compose ps
docker-compose logs -f app
```

- Tests and linting
package.json defines only the default placeholder test script; no unit test framework or linter config is present. Running tests currently exits with an error placeholder.
```powershell path=null start=null
npm test  # prints: "Error: no test specified"
```

2) High-level architecture and structure
- Entry point: Router.js
  - Creates an Application class that initializes:
    - Configuration validation: validateConfig() from src/config/app.js ensures required env vars are present; in production it forbids default JWT secret.
    - Database: dbManager.initialize() from src/config/database.js (mysql2) with retry, health check, and a thin executeQuery() wrapper.
    - Middleware: JSON/urlencoded parsers, request logging, basic security headers, and a simple rateLimit() applied to /api/.
    - Static content: serves ./Frontend under /App and ./Media under /Media. Root (/) redirects to /App/home/home.html. Also exposes /commands.json from repo root if present.
    - Routes grouped by responsibility:
      - Authentication
        - POST /login authenticates via authService.authenticateUser() and returns a JWT access token (no refresh flow implemented server-side).
        - POST /api/verify-token validates JWT via authenticateToken middleware.
      - Users (/api/users)
        - Admin-protected CRUD: list, create, update, delete users using authService and dbManager.
      - History (/api/history)
        - Authenticated paginated history listing, create entries, and delete with ownership checks.
      - Templates (/api/templates)
        - Authenticated CRUD-like operations including export and a usage counter.
      - Printing
        - POST /print optionally authenticates; sends printer command and, if authenticated, records history.
        - GET /printer/test (admin-only) and GET /printer/status for diagnostics.
    - Error handling: global handleError() from src/utils/errors.js plus process-level handlers for unhandledRejection/uncaughtException.

- Configuration (src/config/app.js)
  - Central config object (server, database, jwt, security, printer, logging, api rate limits, static, session, app metadata).
  - validateConfig() enforces presence of DB_* vars, TOKEN_SECRET, TN_HOST and production JWT secret rules.

- Database manager (src/config/database.js)
  - Singleton dbManager managing a mysql2 connection, retrying connect, executeQuery(query, params) with structured logging, close(), healthCheck().

- Services
  - src/services/authService.js: bcrypt password hashing, JWT generation/verification, user CRUD helpers (find by id/username, getAllUsers, updateLastLogin). Uses custom error classes and dbManager.
  - src/services/printerService.js: manages Telnet connection (telnet-client), connect with retry, sendCommand(), printLabel(), testConnection(), getPrinterStatus().

- Middleware (src/middleware/auth.js)
  - authenticateToken, optionalAuth for JWT; requireAdmin/requireUser role checks; rateLimit() in-memory windowed limiter; requireOwnership(resourceUserField) helper.

- Utilities
  - src/utils/errors.js: ApiError hierarchy, handleError() Express middleware, asyncHandler() wrapper.
  - src/utils/logger.js: lightweight logger with levels, colored dev output, request/auth/print/perf/security helpers.

- Frontend (./Frontend)
  - Vanilla JS SPA served statically under /App. auth.js manages client-side auth state using localStorage/sessionStorage.

3) Project rules for agents (augmenting user’s rules)
- ES Modules: This project uses "type": "module"; prefer import ... from syntax and avoid require for route handling or any server modules.
- Token management preference (client): Do not store refresh tokens on the client. If implementing a refresh flow or “remember me”, use short-lived access tokens and an HTTP-only refresh token with a one-month lifetime stored server-side or as an HTTP-only cookie. Current code issues only access tokens; adding refresh should respect this.
- Environment handling: dotenv is installed but not auto-loaded; the server expects environment variables to be present in the execution environment. If you decide to use a .env file in future changes, explicitly load it (e.g., import 'dotenv/config') near process start.

4) Notes and gaps observed
- README documents Docker Compose, db/init scripts, and commands.json; ensure those files are present when running via Compose. Router.js serves /commands.json if the file exists at repo root.
- No ESLint/Prettier configuration files or npm scripts are currently present despite being mentioned in README’s Coding Standards. Add them before referencing lint/format commands here.
- No unit test framework is configured. Once tests are added (e.g., Jest/Mocha), add scripts to package.json and document how to run a single test.
