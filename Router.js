import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { Telnet } from "telnet-client";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log all requests
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.path} from ${req.ip}`);
  next();
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Static routes
app.use("/App", express.static(path.join(__dirname, "Frontend")));
app.use("/Media", express.static(path.join(__dirname, "Media")));

// Serve il file commands.json al frontend
app.get("/commands.json", (req, res) => {
  res.sendFile(path.join(__dirname, "commands.json"));
});

const env = process.env;
// Read DB connection from env (set by docker-compose)
const dbConfig = {
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  port: env.DB_PORT || 3306,
};
let db;
try {
  db = mysql.createConnection(dbConfig);
} catch (err) {
  console.error("MySQL connection error:", err);
}
const tn = new Telnet();

function connectWithRetry() {
  db.connect(function (err) {
    if (err) {
      console.error("MySQL connect error:", err.code, err.message);
      // Retry after a short delay to allow the DB to finish starting up
      setTimeout(connectWithRetry, 2000);
      return;
    }
    console.log("MySQL connected");
  });
}

setTimeout(connectWithRetry, 2000);

app.get("/", (req, res) => {
  res.redirect("/App/home/home.html");
});

app.post("/newUser", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ error: "Username e password richiesti" });
    }

    // Hash della password
    const hash = await bcrypt.hash(password, 10); // 10 = saltRounds

    // Query sicura con placeholder (mysql2 promise API)
    const [result] = await db
      .promise()
      .execute(
        "INSERT INTO USERS (username, password, role) VALUES (?, ?, ?)",
        [username, hash, role]
      );

    // Ottieni l’ID del nuovo utente
    const newUserId = result.insertId;

    res.status(201).json({ message: "Utente creato", id: newUserId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore durante la creazione utente" });
  }
});

app.post("/print", async (req, res) => {
  const { cmd, label_type, label_data, template_data } = req.body;
  console.log("[PRINT] Comando ricevuto:", cmd);
  console.log("[PRINT] Dati etichetta:", { label_type, label_data });

  let printStatus = 'success';
  let errorMessage = null;

  tn.on("data", function (data) {
    console.log("[PRINT] Risposta stampante:", data.toString());
  });

  tn.on("connect", function () {
    tn.write(`${cmd}\r\n`);
    setTimeout(() => {
      tn.write("P\r\n");
    }, 200);
  });

  try {
    await tn.connect({
      host: env.TN_HOST,
      port: env.TN_PORT,
    });
    console.log("[PRINT] Stampa completata con successo");
  } catch (err) {
    console.error("[PRINT] Errore connessione Telnet:", err);
    printStatus = 'failed';
    errorMessage = err.message;
  }

  // Save to history if we have the required data and authentication
  const authHeader = req.headers['authorization'];
  if (authHeader && label_type && label_data) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, env.TOKEN_SECRET);
      
      // Get user ID
      const [userResult] = await db.promise().execute(
        "SELECT id FROM USERS WHERE username = ?",
        [decoded.username]
      );
      
      if (userResult.length > 0) {
        const userId = userResult[0].id;
        
        await db.promise().execute(
          "INSERT INTO LABEL_HISTORY (user_id, username, label_type, label_data, command_generated, template_data, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [userId, decoded.username, label_type, label_data, cmd, JSON.stringify(template_data || {}), printStatus, errorMessage]
        );
        
        console.log("[PRINT] Etichetta salvata nello storico per utente:", decoded.username);
      }
    } catch (historyErr) {
      console.error("[PRINT] Errore nel salvare nello storico:", historyErr);
      // Non blocchiamo la stampa per errori di storico
    }
  }

  if (printStatus === 'success') {
    res.sendStatus(200);
  } else {
    res.status(500).json({ error: "Errore di stampa", details: errorMessage });
  }
});

app.post("/login", async (req, res) => {
  try {
    console.log("[LOGIN] Login request received:", req.body);
    const { username, password, needToken } = req.body ?? {};
    console.log(`[LOGIN] Processing login for username: ${username}, needToken: ${needToken}`);

    const user = await checkUser(username, password);
    if (!user) {
      console.log(`[LOGIN] Authentication failed for user: ${username}`);
      return res.json({
        stato: "password o nome utente sbagliato",
        token: null,
      });
    }

    console.log(`[LOGIN] User authenticated successfully: ${username}, role: ${user.role}`);

    // Update last login
    await db
      .promise()
      .execute("UPDATE USERS SET last_login = NOW() WHERE username = ?", [username]);

    const responseData = {
      stato: "login succesfull",
      role: user.role,
      username: user.username
    };

    if (needToken) {
      console.log(`[LOGIN] Generating token for user: ${username}`);
      responseData.token = generateToken(username, user.role);
    }

    console.log(`[LOGIN] Login successful, sending response:`, responseData);
    return res.status(200).json(responseData);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Errore durante il login" });
  }

  async function checkUser(username, password) {
    const [rows] = await db
      .promise()
      .execute("SELECT * FROM USERS WHERE username = ? LIMIT 1", [username]);

    if (rows.length === 0) return null; // utente non trovato

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);

    return match ? user : null; // return user object if password matches
  }
});

// JWT Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, env.TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Role-based access middleware
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Accesso negato. Privilegi di amministratore richiesti.' });
  }
}

function generateToken(username, role) {
  return jwt.sign({ username, role }, env.TOKEN_SECRET, { expiresIn: "24h" });
}

// User Management Endpoints

// Get all users (admin only)
app.get("/api/users", authenticateToken, requireAdmin, async (req, res) => {
  console.log("[API] GET /api/users called by user:", req.user);
  try {
    const [rows] = await db
      .promise()
      .execute("SELECT id, username, role, created_at, last_login FROM USERS ORDER BY created_at DESC");
    
    res.json({ users: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore nel recupero degli utenti" });
  }
});

// Create new user (admin only)
app.post("/api/users", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, password, role } = req.body;
    
    if (!username || !password || !role) {
      return res.status(400).json({ error: "Username, password e ruolo sono richiesti" });
    }
    
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: "Ruolo non valido. Deve essere 'user' o 'admin'" });
    }

    // Check if user already exists
    const [existingUser] = await db
      .promise()
      .execute("SELECT id FROM USERS WHERE username = ?", [username]);
    
    if (existingUser.length > 0) {
      return res.status(409).json({ error: "Username già esistente" });
    }

    // Hash password
    const hash = await bcrypt.hash(password, 10);

    // Insert new user
    const [result] = await db
      .promise()
      .execute(
        "INSERT INTO USERS (username, password, role, created_at) VALUES (?, ?, ?, NOW())",
        [username, hash, role]
      );

    res.status(201).json({ message: "Utente creato con successo", id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore durante la creazione dell'utente" });
  }
});

// Update user (admin only)
app.put("/api/users/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { username, password, role } = req.body;
    
    if (!username || !role) {
      return res.status(400).json({ error: "Username e ruolo sono richiesti" });
    }
    
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: "Ruolo non valido. Deve essere 'user' o 'admin'" });
    }

    // Check if username is already taken by another user
    const [existingUser] = await db
      .promise()
      .execute("SELECT id FROM USERS WHERE username = ? AND id != ?", [username, userId]);
    
    if (existingUser.length > 0) {
      return res.status(409).json({ error: "Username già in uso da un altro utente" });
    }

    let updateQuery = "UPDATE USERS SET username = ?, role = ? WHERE id = ?";
    let updateParams = [username, role, userId];

    // If password is provided, hash it and update
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      updateQuery = "UPDATE USERS SET username = ?, password = ?, role = ? WHERE id = ?";
      updateParams = [username, hash, role, userId];
    }

    const [result] = await db.promise().execute(updateQuery, updateParams);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Utente non trovato" });
    }

    res.json({ message: "Utente aggiornato con successo" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore durante l'aggiornamento dell'utente" });
  }
});

// Delete user (admin only)
app.delete("/api/users/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Don't allow deleting yourself
    const [currentUser] = await db
      .promise()
      .execute("SELECT id FROM USERS WHERE username = ?", [req.user.username]);
    
    if (currentUser.length > 0 && currentUser[0].id == userId) {
      return res.status(400).json({ error: "Non puoi eliminare il tuo stesso account" });
    }

    const [result] = await db
      .promise()
      .execute("DELETE FROM USERS WHERE id = ?", [userId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Utente non trovato" });
    }

    res.json({ message: "Utente eliminato con successo" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore durante l'eliminazione dell'utente" });
  }
});

// Verify token endpoint
app.post("/api/verify-token", authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// Label History Endpoints

// Get label history (paginated)
app.get("/api/history", authenticateToken, async (req, res) => {
  try {
    console.log("[API] GET /api/history called by user:", req.user);
    const { page = 1, limit = 20, type } = req.query;
    const offset = (page - 1) * limit;
    
    let query = "SELECT * FROM LABEL_HISTORY WHERE user_id = (SELECT id FROM USERS WHERE username = ?)";
    let queryParams = [req.user.username];
    
    if (type) {
      query += " AND label_type = ?";
      queryParams.push(type);
    }
    
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    queryParams.push(parseInt(limit), parseInt(offset));
    
    const [rows] = await db.promise().execute(query, queryParams);
    
    // Get total count
    let countQuery = "SELECT COUNT(*) as total FROM LABEL_HISTORY WHERE user_id = (SELECT id FROM USERS WHERE username = ?)";
    let countParams = [req.user.username];
    
    if (type) {
      countQuery += " AND label_type = ?";
      countParams.push(type);
    }
    
    const [countResult] = await db.promise().execute(countQuery, countParams);
    
    res.json({ 
      history: rows, 
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore nel recupero dello storico" });
  }
});

// Add to label history
app.post("/api/history", authenticateToken, async (req, res) => {
  try {
    console.log("[API] POST /api/history called by user:", req.user);
    const { label_type, label_data, command_generated, template_data, status = 'success', notes } = req.body;
    
    if (!label_type || !label_data || !command_generated) {
      return res.status(400).json({ error: "Dati etichetta richiesti" });
    }
    
    // Get user ID
    const [userResult] = await db.promise().execute(
      "SELECT id FROM USERS WHERE username = ?",
      [req.user.username]
    );
    
    if (userResult.length === 0) {
      return res.status(404).json({ error: "Utente non trovato" });
    }
    
    const userId = userResult[0].id;
    
    const [result] = await db.promise().execute(
      "INSERT INTO LABEL_HISTORY (user_id, username, label_type, label_data, command_generated, template_data, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [userId, req.user.username, label_type, label_data, command_generated, JSON.stringify(template_data), status, notes]
    );
    
    res.status(201).json({ message: "Etichetta aggiunta allo storico", id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore nell'aggiunta allo storico" });
  }
});

// Delete history entry
app.delete("/api/history/:id", authenticateToken, async (req, res) => {
  try {
    const historyId = req.params.id;
    
    // Check if entry belongs to user
    const [checkResult] = await db.promise().execute(
      "SELECT id FROM LABEL_HISTORY WHERE id = ? AND username = ?",
      [historyId, req.user.username]
    );
    
    if (checkResult.length === 0) {
      return res.status(404).json({ error: "Voce storico non trovata o non autorizzata" });
    }
    
    await db.promise().execute(
      "DELETE FROM LABEL_HISTORY WHERE id = ?",
      [historyId]
    );
    
    res.json({ message: "Voce storico eliminata" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore nell'eliminazione dallo storico" });
  }
});

// Template Endpoints

// Get all templates (public + user's private)
app.get("/api/templates", authenticateToken, async (req, res) => {
  try {
    console.log("[API] GET /api/templates called by user:", req.user);
    
    const [rows] = await db.promise().execute(
      "SELECT * FROM LABEL_TEMPLATES WHERE is_public = TRUE OR created_by_username = ? ORDER BY is_public DESC, name ASC",
      [req.user.username]
    );
    
    res.json({ templates: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore nel recupero dei template" });
  }
});

// Create new template
app.post("/api/templates", authenticateToken, async (req, res) => {
  try {
    console.log("[API] POST /api/templates called by user:", req.user);
    const { name, description, template_type, template_data, command_template, is_public = false } = req.body;
    
    if (!name || !template_type || !template_data || !command_template) {
      return res.status(400).json({ error: "Nome, tipo, dati template e comando sono richiesti" });
    }
    
    // Get user ID
    const [userResult] = await db.promise().execute(
      "SELECT id FROM USERS WHERE username = ?",
      [req.user.username]
    );
    
    if (userResult.length === 0) {
      return res.status(404).json({ error: "Utente non trovato" });
    }
    
    const userId = userResult[0].id;
    
    const [result] = await db.promise().execute(
      "INSERT INTO LABEL_TEMPLATES (name, description, template_type, template_data, command_template, created_by, created_by_username, is_public) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [name, description, template_type, JSON.stringify(template_data), command_template, userId, req.user.username, is_public]
    );
    
    res.status(201).json({ message: "Template creato con successo", id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore nella creazione del template" });
  }
});

// Update template usage count
app.post("/api/templates/:id/use", authenticateToken, async (req, res) => {
  try {
    const templateId = req.params.id;
    
    await db.promise().execute(
      "UPDATE LABEL_TEMPLATES SET usage_count = usage_count + 1 WHERE id = ?",
      [templateId]
    );
    
    res.json({ message: "Uso template registrato" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore nell'aggiornamento uso template" });
  }
});

// Export template
app.get("/api/templates/:id/export", authenticateToken, async (req, res) => {
  try {
    const templateId = req.params.id;
    
    const [rows] = await db.promise().execute(
      "SELECT * FROM LABEL_TEMPLATES WHERE id = ? AND (is_public = TRUE OR created_by_username = ?)",
      [templateId, req.user.username]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: "Template non trovato o non autorizzato" });
    }
    
    const template = rows[0];
    
    // Create export object
    const exportData = {
      name: template.name,
      description: template.description,
      template_type: template.template_type,
      template_data: JSON.parse(template.template_data),
      command_template: template.command_template,
      exported_at: new Date().toISOString(),
      exported_by: req.user.username
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="template_${template.name.replace(/[^a-zA-Z0-9]/g, '_')}.json"`);
    res.json(exportData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore nell'esportazione del template" });
  }
});

// Delete template (only own templates)
app.delete("/api/templates/:id", authenticateToken, async (req, res) => {
  try {
    const templateId = req.params.id;
    
    const [result] = await db.promise().execute(
      "DELETE FROM LABEL_TEMPLATES WHERE id = ? AND created_by_username = ?",
      [templateId, req.user.username]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Template non trovato o non autorizzato" });
    }
    
    res.json({ message: "Template eliminato con successo" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore nell'eliminazione del template" });
  }
});

const PORT = env.PORT || 800;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
