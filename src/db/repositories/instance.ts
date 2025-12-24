/**
 * 浏览器实例数据访问层
 */
import { db } from '../database.js';

export interface BrowserInstance {
  id: number;
  profile_alias: string;
  account_id?: number;
  is_active: number;
  created_at: string;
  last_active?: string;
}

export class InstanceRepository {
  getAll(): BrowserInstance[] {
    return db.prepare('SELECT * FROM browser_instances ORDER BY last_active DESC').all() as BrowserInstance[];
  }

  getActive(): BrowserInstance | undefined {
    return db.prepare('SELECT * FROM browser_instances WHERE is_active = 1').get() as BrowserInstance | undefined;
  }

  getById(id: number): BrowserInstance | undefined {
    return db.prepare('SELECT * FROM browser_instances WHERE id = ?').get(id) as BrowserInstance | undefined;
  }

  create(instance: Omit<BrowserInstance, 'id' | 'created_at' | 'last_active'>): number {
    const stmt = db.prepare(`
      INSERT INTO browser_instances (profile_alias, account_id, is_active)
      VALUES (?, ?, ?)
    `);
    
    const result = stmt.run(
      instance.profile_alias,
      instance.account_id || null,
      instance.is_active
    );

    return result.lastInsertRowid as number;
  }

  setActive(id: number): void {
    const setInactive = db.prepare('UPDATE browser_instances SET is_active = 0');
    const setActiveStmt = db.prepare(`
      UPDATE browser_instances 
      SET is_active = 1, last_active = datetime('now') 
      WHERE id = ?
    `);

    db.transaction(() => {
      setInactive.run();
      setActiveStmt.run(id);
    })();
  }

  updateLastActive(id: number): void {
    db.prepare("UPDATE browser_instances SET last_active = datetime('now') WHERE id = ?").run(id);
  }

  delete(id: number): void {
    db.prepare('DELETE FROM browser_instances WHERE id = ?').run(id);
  }

  deleteAll(): void {
    db.prepare('DELETE FROM browser_instances').run();
  }
}
