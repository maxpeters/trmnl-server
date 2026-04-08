import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "trmnl.db");

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mac_address TEXT UNIQUE NOT NULL,
    api_key TEXT NOT NULL,
    friendly_id TEXT NOT NULL,
    battery_voltage REAL,
    fw_version TEXT,
    rssi INTEGER,
    refresh_rate INTEGER DEFAULT 900,
    last_seen_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS screens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    html TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_mac TEXT,
    message TEXT,
    metadata TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Insert a default screen if none exist
const count = db.prepare("SELECT COUNT(*) as c FROM screens").get() as { c: number };
if (count.c === 0) {
  db.prepare(`
    INSERT INTO screens (name, html, sort_order) VALUES (?, ?, ?)
  `).run(
    "Welcome",
    `<div style="display:flex;align-items:center;justify-content:center;height:100%;width:100%;font-family:sans-serif;">
  <div style="text-align:center;">
    <h1 style="font-size:48px;margin:0;">TRMNL Server</h1>
    <p style="font-size:24px;color:#666;margin-top:16px;">Running on your MacBook</p>
  </div>
</div>`,
    0
  );
}

export default db;
