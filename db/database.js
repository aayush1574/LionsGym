const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'royalgym.db');

let db;

async function initializeDatabase() {
  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      gender TEXT DEFAULT 'male',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS memberships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      plan_type TEXT NOT NULL,
      duration TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      amount REAL NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      payment_date DATE,
      notified INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date DATE NOT NULL,
      check_in_time TEXT DEFAULT (TIME('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, date)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date DATE NOT NULL,
      weight REAL,
      chest REAL,
      waist REAL,
      biceps REAL,
      thighs REAL,
      shoulders REAL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Seed default admin if not exists
  const adminCheck = db.exec("SELECT id FROM users WHERE email = 'admin@royalgym.com'");
  if (adminCheck.length === 0 || adminCheck[0].values.length === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.run(
      "INSERT INTO users (name, email, phone, password_hash, role, gender) VALUES (?, ?, ?, ?, 'admin', 'male')",
      ['Admin', 'admin@royalgym.com', '9981219521', hash]
    );
    console.log('✅ Default admin created: admin@royalgym.com / admin123');
  }

  saveDb();
  console.log('✅ Database initialized successfully');
}

// Persist to file
function saveDb() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// Helper: get one row as an object
function getOne(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    stmt.free();
    const obj = {};
    cols.forEach((c, i) => obj[c] = vals[i]);
    return obj;
  }
  stmt.free();
  return null;
}

// Helper: get all rows as array of objects
function getAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    const obj = {};
    cols.forEach((c, i) => obj[c] = vals[i]);
    rows.push(obj);
  }
  stmt.free();
  return rows;
}

// Helper: run query (INSERT/UPDATE/DELETE), returns { changes, lastId }
function runQuery(sql, params = []) {
  db.run(sql, params);
  const changes = db.getRowsModified();
  const lastIdResult = db.exec("SELECT last_insert_rowid()");
  const lastId = lastIdResult.length > 0 ? lastIdResult[0].values[0][0] : 0;
  saveDb();
  return { changes, lastId };
}

module.exports = { initializeDatabase, getOne, getAll, runQuery, getDb: () => db };
