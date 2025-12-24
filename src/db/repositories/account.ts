/**
 * 账号数据访问层
 */
import { db } from '../database.js';

export interface Account {
  id: number;
  profile_alias: string;
  username: string;
  metadata?: string;
  created_at: string;
}

export class AccountRepository {
  getAll(): Account[] {
    return db.prepare('SELECT * FROM accounts ORDER BY created_at DESC').all() as Account[];
  }

  getByProfile(profileAlias: string): Account[] {
    return db.prepare('SELECT * FROM accounts WHERE profile_alias = ? ORDER BY created_at DESC')
      .all(profileAlias) as Account[];
  }

  findByUsername(profileAlias: string, username: string): Account | undefined {
    return db.prepare('SELECT * FROM accounts WHERE profile_alias = ? AND username = ?')
      .get(profileAlias, username) as Account | undefined;
  }

  getById(id: number): Account | undefined {
    return db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as Account | undefined;
  }

  create(account: Omit<Account, 'id' | 'created_at'>): number {
    const stmt = db.prepare(`
      INSERT INTO accounts (profile_alias, username, metadata)
      VALUES (?, ?, ?)
    `);
    
    const result = stmt.run(
      account.profile_alias,
      account.username,
      account.metadata || null
    );

    return result.lastInsertRowid as number;
  }

  update(id: number, updates: Partial<Omit<Account, 'id' | 'created_at'>>): void {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }

    if (fields.length === 0) return;

    values.push(id);
    db.prepare(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  delete(id: number): void {
    db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  }
}
