import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { readDBFile, writeDBFile } from './fileSystem';

export interface Bookmark {
  id: string;
  created_at: string;
  full_text: string;
  favorite_count: number;
  retweet_count: number;
  reply_count: number;
  views_count: number;
  name: string;
  screen_name: string;
  profile_image_url: string;
  media?: string;
  category?: string;
  url?: string;
}

export interface Category {
  id: string;
  name: string;
  count: number;
}

class BookmarkDatabase {
  private SQL: any = null;
  private db: SqlJsDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    await this.initialize();
  }

  private async initialize(): Promise<void> {
    this.SQL = await initSqlJs({
      locateFile: (file) => `https://sql.js.org/dist/${file}`,
    });

    // Try to load existing database from IndexedDB
    const existingDB = await readDBFile();
    if (existingDB && existingDB.length > 0) {
      console.log('[Database] Loading existing database from storage:', {
        size: existingDB.length,
        sizeMB: (existingDB.length / 1024 / 1024).toFixed(2)
      });
      this.db = new this.SQL.Database(existingDB);
      this.ensureTables();
      console.log('[Database] Existing database loaded successfully');
    } else {
      console.log('[Database] No existing database found, creating new one');
      this.db = new this.SQL.Database();
      this.createTables();
      console.log('[Database] New database initialized');
    }
  }

  private ensureTables(): void {
    if (!this.db) return;
    // Ensure categories table exists for existing databases
    this.db.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  private createTables(): void {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        full_text TEXT NOT NULL,
        favorite_count INTEGER DEFAULT 0,
        retweet_count INTEGER DEFAULT 0,
        reply_count INTEGER DEFAULT 0,
        views_count INTEGER DEFAULT 0,
        name TEXT NOT NULL,
        screen_name TEXT NOT NULL,
        profile_image_url TEXT,
        media TEXT,
        category TEXT,
        url TEXT NOT NULL DEFAULT ''
      )
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_created_at ON bookmarks(created_at DESC)
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_category ON bookmarks(category)
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_screen_name ON bookmarks(screen_name)
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  async importDatabase(data: Uint8Array): Promise<boolean> {
    try {
      console.log('[Database] Import started:', {
        dataSize: data.length,
        sizeMB: (data.length / 1024 / 1024).toFixed(2)
      });

      if (!this.SQL) {
        this.SQL = await initSqlJs({
          locateFile: (file) => `https://sql.js.org/dist/${file}`,
        });
      }

      this.db = new this.SQL.Database(data);
      this.ensureTables();
      console.log('[Database] Database loaded successfully');

      const tables = this.db.exec("SELECT name FROM sqlite_master WHERE type='table'");
      console.log('[Database] Available tables:', tables);

      const bookmarkCount = this.db.exec('SELECT COUNT(*) as count FROM bookmarks');
      console.log('[Database] Bookmark count:', bookmarkCount);

      await this.saveToFile();
      console.log('[Database] Database saved to IndexedDB');

      return true;
    } catch (error) {
      console.error('[Database] Import error:', error);
      console.error('[Database] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      return false;
    }
  }

  async getBookmarks(limit: number = 10, offset: number = 0, category?: string): Promise<Bookmark[]> {
    if (!this.db) await this.init();
    if (!this.db) return [];

    try {
      let query = `
        SELECT * FROM bookmarks
        ${category ? 'WHERE category = ?' : ''}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;

      const params = category ? [category, limit, offset] : [limit, offset];
      const result = this.db.exec(query, params);

      if (result.length === 0) return [];

      const columns = result[0].columns;
      const values = result[0].values;

      return values.map((row: any[]) => {
        const bookmark: any = {};
        columns.forEach((col, idx) => {
          bookmark[col] = row[idx];
        });
        return bookmark as Bookmark;
      });
    } catch (error) {
      console.error('[Database] Error getting bookmarks:', error);
      return [];
    }
  }

  async getRandomBookmarks(limit: number = 10): Promise<Bookmark[]> {
    if (!this.db) await this.init();
    if (!this.db) return [];

    try {
      const query = `
        SELECT * FROM bookmarks
        ORDER BY RANDOM()
        LIMIT ?
      `;

      const result = this.db.exec(query, [limit]);

      if (result.length === 0) return [];

      const columns = result[0].columns;
      const values = result[0].values;

      return values.map((row: any[]) => {
        const bookmark: any = {};
        columns.forEach((col, idx) => {
          bookmark[col] = row[idx];
        });
        return bookmark as Bookmark;
      });
    } catch (error) {
      console.error('[Database] Error getting random bookmarks:', error);
      return [];
    }
  }

  async searchBookmarks(query: string, limit: number = 50): Promise<Bookmark[]> {
    if (!this.db) await this.init();
    if (!this.db) return [];

    try {
      const searchQuery = `%${query}%`;
      const sql = `
        SELECT * FROM bookmarks
        WHERE full_text LIKE ? OR name LIKE ? OR screen_name LIKE ?
        ORDER BY created_at DESC
        LIMIT ?
      `;

      const result = this.db.exec(sql, [searchQuery, searchQuery, searchQuery, limit]);

      if (result.length === 0) return [];

      const columns = result[0].columns;
      const values = result[0].values;

      return values.map((row: any[]) => {
        const bookmark: any = {};
        columns.forEach((col, idx) => {
          bookmark[col] = row[idx];
        });
        return bookmark as Bookmark;
      });
    } catch (error) {
      console.error('[Database] Error searching bookmarks:', error);
      return [];
    }
  }

  async getCategoriesWithCounts(): Promise<Category[]> {
    if (!this.db) await this.init();
    if (!this.db) return [];

    this.ensureTables();

    try {
      // Merge user-created categories, bookmark-derived categories, and uncategorized count
      const result = this.db.exec(`
        SELECT id, name, count FROM (
          SELECT c.id, c.name, COALESCE(b.cnt, 0) as count
          FROM categories c
          LEFT JOIN (
            SELECT category, COUNT(*) as cnt
            FROM bookmarks
            WHERE category IS NOT NULL AND category != '' AND category != 'Uncategorized'
            GROUP BY category
          ) b ON c.name = b.category

          UNION

          SELECT b.category as id, b.category as name, COUNT(*) as count
          FROM bookmarks b
          WHERE b.category IS NOT NULL AND b.category != '' AND b.category != 'Uncategorized'
            AND b.category NOT IN (SELECT name FROM categories)
          GROUP BY b.category

          UNION

          SELECT 'uncategorized' as id, 'Uncategorized' as name, COUNT(*) as count
          FROM bookmarks
          WHERE category IS NULL OR category = '' OR category = 'Uncategorized'
          HAVING count > 0
        )
        ORDER BY count DESC, name ASC
      `);

      if (result.length === 0) return [];

      return result[0].values.map((row: any[]) => ({
        id: row[0] as string,
        name: row[1] as string,
        count: row[2] as number,
      }));
    } catch (error) {
      console.error('[Database] Error getting categories:', error);
      return [];
    }
  }

  async getCategories(): Promise<Category[]> {
    return this.getCategoriesWithCounts();
  }

  async addBookmark(bookmark: Bookmark): Promise<boolean> {
    if (!this.db) await this.init();
    if (!this.db) return false;

    try {
      const columns = this.getTableColumns('bookmarks');
      const colNames = columns.map(c => c.name);
      const placeholders = colNames.map(() => '?').join(', ');
      const sql = `INSERT OR REPLACE INTO bookmarks (${colNames.join(', ')}) VALUES (${placeholders})`;
      const values = colNames.map(col => this.resolveBookmarkValue(col, bookmark));

      this.db.run(sql, values);

      await this.saveToFile();
      return true;
    } catch (error) {
      console.error('[Database] Error adding bookmark:', error, 'Bookmark ID:', bookmark.id);
      return false;
    }
  }

  private async saveToFile(): Promise<void> {
    if (!this.db) return;

    try {
      const data = this.db.export();
      await writeDBFile(data);
    } catch (error) {
      console.error('[Database] Error saving to file:', error);
    }
  }

  async exportDatabase(): Promise<Uint8Array | null> {
    if (!this.db) await this.init();
    if (!this.db) return null;

    try {
      return this.db.export();
    } catch (error) {
      console.error('[Database] Error exporting database:', error);
      return null;
    }
  }

  async wipeDatabase(): Promise<void> {
    if (!this.db) return;

    try {
      this.db.run('DELETE FROM bookmarks');
      this.db.run('DELETE FROM categories');
      await this.saveToFile();
    } catch (error) {
      console.error('[Database] Error wiping database:', error);
    }
  }

  async getBookmarkCount(): Promise<number> {
    if (!this.db) await this.init();
    if (!this.db) return 0;

    try {
      const result = this.db.exec('SELECT COUNT(*) as count FROM bookmarks');
      if (result.length > 0 && result[0].values.length > 0) {
        return result[0].values[0][0] as number;
      }
      return 0;
    } catch (error) {
      console.error('[Database] Error getting bookmark count:', error);
      return 0;
    }
  }

  getDatabaseSize(): number {
    if (!this.db) return 0;
    try {
      const data = this.db.export();
      return data.length;
    } catch (error) {
      console.error('[Database] Error getting database size:', error);
      return 0;
    }
  }

  async addCategory(name: string): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error('Database not initialized');

    this.ensureTables();

    // Check if category already exists
    const existing = this.db.exec('SELECT id FROM categories WHERE name = ?', [name]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      throw new Error(`Category "${name}" already exists`);
    }

    const id = crypto.randomUUID();
    this.db.run('INSERT INTO categories (id, name, created_at) VALUES (?, ?, ?)', [id, name, new Date().toISOString()]);
    await this.saveToFile();
    console.log('[Database] Category added:', name);
  }

  async deleteCategory(id: string): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;

    this.ensureTables();
    this.db.run('DELETE FROM categories WHERE id = ?', [id]);
    await this.saveToFile();
    console.log('[Database] Category deleted:', id);
  }

  async getUncategorizedBookmarks(): Promise<Bookmark[]> {
    if (!this.db) await this.init();
    if (!this.db) return [];

    try {
      const result = this.db.exec(`
        SELECT * FROM bookmarks
        WHERE category IS NULL OR category = '' OR category = 'Uncategorized'
        ORDER BY created_at DESC
      `);

      if (result.length === 0) return [];

      const columns = result[0].columns;
      const values = result[0].values;

      return values.map((row: any[]) => {
        const bookmark: any = {};
        columns.forEach((col, idx) => {
          bookmark[col] = row[idx];
        });
        return bookmark as Bookmark;
      });
    } catch (error) {
      console.error('[Database] Error getting uncategorized bookmarks:', error);
      return [];
    }
  }

  async getBookmarksByCategory(category: string): Promise<Bookmark[]> {
    if (!this.db) await this.init();
    if (!this.db) return [];

    try {
      const result = this.db.exec(
        `SELECT * FROM bookmarks WHERE category = ? ORDER BY created_at DESC`,
        [category]
      );

      if (result.length === 0) return [];

      const columns = result[0].columns;
      const values = result[0].values;

      return values.map((row: any[]) => {
        const bookmark: any = {};
        columns.forEach((col, idx) => {
          bookmark[col] = row[idx];
        });
        return bookmark as Bookmark;
      });
    } catch (error) {
      console.error('[Database] Error getting bookmarks by category:', error);
      return [];
    }
  }

  async getAllBookmarks(): Promise<Bookmark[]> {
    if (!this.db) await this.init();
    if (!this.db) return [];

    try {
      const result = this.db.exec(`SELECT * FROM bookmarks ORDER BY created_at DESC`);

      if (result.length === 0) return [];

      const columns = result[0].columns;
      const values = result[0].values;

      return values.map((row: any[]) => {
        const bookmark: any = {};
        columns.forEach((col, idx) => {
          bookmark[col] = row[idx];
        });
        return bookmark as Bookmark;
      });
    } catch (error) {
      console.error('[Database] Error getting all bookmarks:', error);
      return [];
    }
  }

  private serializeMedia(media: any): string | null {
    if (!media) return null;
    if (typeof media === 'string') return media;
    if (Array.isArray(media)) return media.length > 0 ? JSON.stringify(media) : null;
    return JSON.stringify(media);
  }

  private getTableColumns(table: string): { name: string; notnull: boolean; dflt_value: any }[] {
    if (!this.db) return [];
    const result = this.db.exec(`PRAGMA table_info(${table})`);
    if (result.length === 0) return [];
    return result[0].values.map((row: any[]) => ({
      name: row[1] as string,
      notnull: row[3] === 1,
      dflt_value: row[4],
    }));
  }

  private resolveBookmarkValue(column: string, bookmark: any): any {
    // Known fields with defaults for NOT NULL columns
    const defaults: Record<string, () => any> = {
      id: () => bookmark.id,
      created_at: () => bookmark.created_at || new Date().toISOString(),
      full_text: () => bookmark.full_text || 'N/A',
      name: () => bookmark.name || bookmark.screen_name || 'Unknown',
      screen_name: () => bookmark.screen_name || bookmark.name || 'unknown',
      favorite_count: () => bookmark.favorite_count || 0,
      retweet_count: () => bookmark.retweet_count || 0,
      reply_count: () => bookmark.reply_count || 0,
      views_count: () => bookmark.views_count || 0,
      profile_image_url: () => bookmark.profile_image_url || null,
      media: () => this.serializeMedia(bookmark.media),
      category: () => bookmark.category || null,
      url: () => bookmark.url || '',
      imported_at: () => bookmark.imported_at || new Date().toISOString(),
    };

    if (defaults[column]) return defaults[column]();

    // For any unknown column, use the bookmark field if it exists
    const value = bookmark[column];
    if (value !== undefined) {
      if (typeof value === 'object' && value !== null) return JSON.stringify(value);
      return value;
    }

    return null;
  }

  async insertBookmarksBatch(bookmarks: any[]): Promise<{ success: number; failed: number; errors: string[] }> {
    if (!this.db) await this.init();
    if (!this.db) return { success: 0, failed: bookmarks.length, errors: ['Database not initialized'] };

    // Read actual table schema so we fill all NOT NULL columns
    const columns = this.getTableColumns('bookmarks');
    const colNames = columns.map(c => c.name);
    const placeholders = colNames.map(() => '?').join(', ');
    const sql = `INSERT OR REPLACE INTO bookmarks (${colNames.join(', ')}) VALUES (${placeholders})`;

    console.log('[Database] Insert columns:', colNames);

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const bookmark of bookmarks) {
      try {
        const values = colNames.map(col => this.resolveBookmarkValue(col, bookmark));
        this.db.run(sql, values);
        success++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[Database] Failed to insert bookmark:', bookmark.id, error);
        if (errors.length < 3) {
          errors.push(`ID ${bookmark.id}: ${msg}`);
        }
        failed++;
      }
    }

    await this.saveToFile();
    return { success, failed, errors };
  }

  async updateBookmarkCategory(id: string, category: string): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;

    try {
      this.db.run('UPDATE bookmarks SET category = ? WHERE id = ?', [category, id]);
      await this.saveToFile();
    } catch (error) {
      console.error('[Database] Error updating bookmark category:', error);
    }
  }
}

export const db = new BookmarkDatabase();
