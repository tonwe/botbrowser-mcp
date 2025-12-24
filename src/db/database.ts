/**
 * SQLite 数据库连接管理
 */
import Database from 'better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const DB_DIR = path.join(os.homedir(), '.botbrowser-mcp');
const DB_PATH = path.join(DB_DIR, 'botbrowser.db');

// 确保目录存在
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

export const db: BetterSqlite3.Database = new Database(DB_PATH);


// 启用外键约束
db.pragma('foreign_keys = ON');

export function initDatabase() {
  // 浏览器配置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS browser_profiles (
      alias TEXT PRIMARY KEY,
      executable_path TEXT NOT NULL,
      fingerprint_path TEXT,
      storage_state_path TEXT,
      description TEXT,
      proxy_server TEXT,
      proxy_username TEXT,
      proxy_password TEXT,
      proxy_bypass TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_used TEXT
    )
  `);

  // 账号表
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_alias TEXT NOT NULL,
      username TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (profile_alias) REFERENCES browser_profiles(alias) ON DELETE CASCADE
    )
  `);

  // 浏览器实例表
  db.exec(`
    CREATE TABLE IF NOT EXISTS browser_instances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_alias TEXT NOT NULL,
      account_id INTEGER,
      is_active INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_active TEXT,
      FOREIGN KEY (profile_alias) REFERENCES browser_profiles(alias) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
    )
  `);

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_accounts_profile ON accounts(profile_alias);
    CREATE INDEX IF NOT EXISTS idx_instances_profile ON browser_instances(profile_alias);
    CREATE INDEX IF NOT EXISTS idx_instances_active ON browser_instances(is_active);
  `);
}
