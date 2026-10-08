const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database(path.join(__dirname, "database", "community.db"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS login_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  logged_in_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS problems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'Open' CHECK(status IN ('Open','In Progress','Resolved','Rejected')),
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  link TEXT,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
);
`);

const adminEmail = "admin@communityconnect.local";
const adminPassword = "Admin@123";
const existingAdmin = db.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail);
if (!existingAdmin) {
  const hash = bcrypt.hashSync(adminPassword, 12);
  db.prepare("INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)")
    .run("System Administrator", adminEmail, hash, "admin");
}

function clean(value, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

function currentUser(req) {
  const token = req.cookies.cc_session;
  if (!token) return null;
  const session = db.prepare(`
    SELECT s.token, s.expires_at, u.id, u.name, u.email, u.role
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token=?
  `).get(token);
  if (!session) return null;
  if (new Date(session.expires_at) <= new Date()) {
    db.prepare("DELETE FROM sessions WHERE token=?").run(token);
    return null;
  }
  return { id: session.id, name: session.name, email: session.email, role: session.role, token };
}

function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: "Please sign in first." });
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  const user = currentUser(req);
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Administrator access required." });
  req.user = user;
  next();
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/register", (req, res) => {
  const name = clean(req.body.name, 100);
  const email = clean(req.body.email, 150).toLowerCase();
  const password = String(req.body.password || "");

  if (name.length < 2) return res.status(400).json({ error: "Please enter your full name." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Please enter a valid email." });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });

  if (db.prepare("SELECT id FROM users WHERE email=?").get(email))
    return res.status(409).json({ error: "An account with this email already exists." });

  const hash = bcrypt.hashSync(password, 12);
  const result = db.prepare("INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)")
    .run(name, email, hash, "user");

  createSession(res, result.lastInsertRowid);
  res.json({ message: "Account created successfully." });
});

app.post("/api/login", (req, res) => {
  const email = clean(req.body.email, 150).toLowerCase();
  const password = String(req.body.password || "");
  const user = db.prepare("SELECT * FROM users WHERE email=?").get(email);

  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: "Incorrect email or password." });

  db.prepare("INSERT INTO login_logs (user_id,ip_address) VALUES (?,?)")
    .run(user.id, req.ip);

  createSession(res, user.id);
  res.json({ message: "Signed in successfully.", role: user.role });
});

function createSession(res, userId) {
  const token = uuidv4() + "-" + uuidv4();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare("INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)")
    .run(token, userId, expires);
  res.cookie("cc_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

app.post("/api/logout", (req, res) => {
  const token = req.cookies.cc_session;
  if (token) db.prepare("DELETE FROM sessions WHERE token=?").run(token);
  res.clearCookie("cc_session");
  res.json({ message: "Logged out." });
});

app.get("/api/me", (req, res) => {
  const user = currentUser(req);
  res.json({ user: user ? { id:user.id, name:user.name, email:user.email, role:user.role } : null });
});

app.get("/api/problems", (req, res) => {
  const rows = db.prepare(`
    SELECT p.id,p.title,p.description,p.category,p.location,p.status,p.created_at,
           u.name AS author
    FROM problems p JOIN users u ON u.id=p.created_by
    ORDER BY p.created_at DESC
  `).all();
  res.json(rows);
});

app.post("/api/problems", requireAuth, (req, res) => {
  const title = clean(req.body.title, 150);
  const description = clean(req.body.description, 3000);
  const category = clean(req.body.category, 80);
  const location = clean(req.body.location, 200);

  if (title.length < 5 || description.length < 15 || !category)
    return res.status(400).json({ error: "Please complete all required problem fields." });

  const result = db.prepare(`
    INSERT INTO problems (title,description,category,location,created_by)
    VALUES (?,?,?,?,?)
  `).run(title, description, category, location, req.user.id);

  res.status(201).json({ id: result.lastInsertRowid, message: "Problem reported successfully." });
});

app.get("/api/resources", (req, res) => {
  const rows = db.prepare(`
    SELECT r.id,r.title,r.description,r.category,r.link,r.created_at,u.name AS author
    FROM resources r JOIN users u ON u.id=r.created_by
    ORDER BY r.created_at DESC
  `).all();
  res.json(rows);
});

app.post("/api/resources", requireAuth, (req, res) => {
  const title = clean(req.body.title, 150);
  const description = clean(req.body.description, 3000);
  const category = clean(req.body.category, 80);
  const link = clean(req.body.link, 500);

  if (title.length < 3 || description.length < 10 || !category)
    return res.status(400).json({ error: "Please complete all required resource fields." });

  if (link && !/^https?:\/\//i.test(link))
    return res.status(400).json({ error: "Resource link must start with http:// or https://." });

  const result = db.prepare(`
    INSERT INTO resources (title,description,category,link,created_by)
    VALUES (?,?,?,?,?)
  `).run(title, description, category, link || null, req.user.id);

  res.status(201).json({ id: result.lastInsertRowid, message: "Resource shared successfully." });
});

app.get("/api/admin/overview", requireAdmin, (req, res) => {
  const users = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role='user'").get().count;
  const problems = db.prepare("SELECT COUNT(*) AS count FROM problems").get().count;
  const resolved = db.prepare("SELECT COUNT(*) AS count FROM problems WHERE status='Resolved'").get().count;
  const resources = db.prepare("SELECT COUNT(*) AS count FROM resources").get().count;
  res.json({ users, problems, resolved, resources });
});

app.get("/api/admin/users", requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT u.id,u.name,u.email,u.role,u.created_at,
      (SELECT MAX(logged_in_at) FROM login_logs l WHERE l.user_id=u.id) AS last_login
    FROM users u ORDER BY u.created_at DESC
  `).all();
  res.json(rows);
});

app.get("/api/admin/logins", requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT l.id,u.name,u.email,u.role,l.logged_in_at,l.ip_address
    FROM login_logs l JOIN users u ON u.id=l.user_id
    ORDER BY l.logged_in_at DESC LIMIT 100
  `).all();
  res.json(rows);
});

app.get("/api/admin/problems", requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT p.*,u.name AS author,u.email AS author_email
    FROM problems p JOIN users u ON u.id=p.created_by
    ORDER BY p.created_at DESC
  `).all();
  res.json(rows);
});

app.patch("/api/admin/problems/:id", requireAdmin, (req, res) => {
  const status = clean(req.body.status, 30);
  if (!["Open","In Progress","Resolved","Rejected"].includes(status))
    return res.status(400).json({ error: "Invalid status." });
  const result = db.prepare("UPDATE problems SET status=? WHERE id=?").run(status, req.params.id);
  if (!result.changes) return res.status(404).json({ error: "Problem not found." });
  res.json({ message: "Problem status updated." });
});

app.delete("/api/admin/problems/:id", requireAdmin, (req, res) => {
  const result = db.prepare("DELETE FROM problems WHERE id=?").run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: "Problem not found." });
  res.json({ message: "Problem deleted." });
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => {
  console.log(`CommunityConnect running at http://localhost:${PORT}`);
});
