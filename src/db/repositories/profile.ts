/**
 * 浏览器配置数据访问层
 */
import { db } from '../database.js';

export interface BrowserProfile {
  alias: string;
  executable_path: string;
  fingerprint_path?: string;
  storage_state_path?: string;
  user_data_dir?: string;
  description?: string;
  proxy_server?: string;
  proxy_username?: string;
  proxy_password?: string;
  proxy_bypass?: string;
  created_at: string;
  last_used?: string;
}

export class ProfileRepository {
  getAll(): BrowserProfile[] {
    return db.prepare('SELECT * FROM browser_profiles').all() as BrowserProfile[];
  }

  getByAlias(alias: string): BrowserProfile | undefined {
    return db.prepare('SELECT * FROM browser_profiles WHERE alias = ?').get(alias) as BrowserProfile | undefined;
  }

  create(profile: Omit<BrowserProfile, 'created_at' | 'last_used'>): void {
    const stmt = db.prepare(`
      INSERT INTO browser_profiles (
        alias, executable_path, fingerprint_path, storage_state_path, user_data_dir,
        description, proxy_server, proxy_username, proxy_password, proxy_bypass
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      profile.alias,
      profile.executable_path,
      profile.fingerprint_path || null,
      profile.storage_state_path || null,
      profile.user_data_dir || null,
      profile.storage_state_path || null,
      profile.description || null,
      profile.proxy_server || null,
      profile.proxy_username || null,
      profile.proxy_password || null,
      profile.proxy_bypass || null
    );
  }

  update(alias: string, updates: Partial<BrowserProfile>): void {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'alias' && key !== 'created_at') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) return;

    values.push(alias);
    db.prepare(`UPDATE browser_profiles SET ${fields.join(', ')} WHERE alias = ?`).run(...values);
  }

  delete(alias: string): void {
    db.prepare('DELETE FROM browser_profiles WHERE alias = ?').run(alias);
  }

  updateLastUsed(alias: string): void {
    db.prepare("UPDATE browser_profiles SET last_used = datetime('now') WHERE alias = ?").run(alias);
  }

  updateUserDataDir(alias: string, userDataDir: string): void {
    db.prepare('UPDATE browser_profiles SET user_data_dir = ? WHERE alias = ?').run(userDataDir, alias);
  }
}
