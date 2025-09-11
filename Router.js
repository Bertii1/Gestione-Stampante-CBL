import express from "express";
import mysql from "mysql2";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { Telnet } from 'telnet-client'

const app = express();
Telnet
app.use(express.json());

const env = process.env;
// Read DB connection from env (set by docker-compose)
const dbConfig = {
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  port: 3306,
};

const db = mysql.createConnection(dbConfig);
const tn = Telnet()

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

app.post("/newUser", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ error: "Username e password richiesti" });
    }

    // Hash della password
    const hash = await bcrypt.hash(password, 10); // 10 = saltRounds

    // Query sicura con placeholder (mysql2 promise API)
    const [result] = await db.promise().execute(
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

app.post("/print", async (req,res) =>{
  tn

  // these parameters are just examples and most probably won't work for your use-case.
  const params = {
    host: '127.0.0.1',
    port: 23,
    shellPrompt: '/ # ', // or negotiationMandatory: false
    timeout: 1500
  }

  try {
    await connection.connect(params)
  } catch (error) {
    // handle the throw (timeout)
  }

  const res = await connection.exec('uptime')
  console.log('async result:', res)
})

app.post("/login", async (req, res) => {
  try {
    const { username, password, needToken } = req.body ?? {};

    const ok = await checkUser(username, password);
    if (!ok) {
      return res.json({
        stato: "password o nome utente sbagliato",
        token: null,
      });
    }

    if (needToken) {
      return res.status(200).json({
        stato: "login succesfull",
        token: generateToken(username),
      });
    }

    return res.status(200).json({ stato: "login succesfull" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Errore durante il login" });
  }

  async function checkUser(username, password) {
    const [rows] = await db.promise().execute(
      "SELECT * FROM USERS WHERE username = ? LIMIT 1",
      [username]
    );

    if (rows.length === 0) return false; // utente non trovato

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);

    return match; // true se email esiste e password corretta
  }
});

function generateToken(username) {
  return jwt.sign({ username }, env.TOKEN_SECRET, { expiresIn: "24h" });
}

const PORT = env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
