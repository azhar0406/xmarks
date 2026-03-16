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
      console.log('[Database] Existing database loaded successfully');
    } else {
      console.log('[Database] No existing database found, creating new one');
      this.db = new this.SQL.Database();
      this.createTables();
      console.log('[Database] New database initialized');
    }
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
        category TEXT
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

    try {
      const result = this.db.exec(`
        SELECT category as name, COUNT(*) as count
        FROM bookmarks
        WHERE category IS NOT NULL AND category != ''
        GROUP BY category
        ORDER BY count DESC
      `);

      if (result.length === 0) return [];

      return result[0].values.map((row: any[]) => ({
        name: row[0],
        count: row[1],
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
      this.db.run(
        `INSERT OR REPLACE INTO bookmarks
        (id, created_at, full_text, favorite_count, retweet_count, reply_count, views_count, name, screen_name, profile_image_url, media, category)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          bookmark.id,
          bookmark.created_at,
          bookmark.full_text,
          bookmark.favorite_count,
          bookmark.retweet_count,
          bookmark.reply_count,
          bookmark.views_count,
          bookmark.name,
          bookmark.screen_name,
          bookmark.profile_image_url,
          bookmark.media,
          bookmark.category,
        ]
      );

      await this.saveToFile();
      return true;
    } catch (error) {
      console.error('[Database] Error adding bookmark:', error);
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
    // Categories are just used for filtering, no separate table needed
    return Promise.resolve();
  }

  async deleteCategory(id: string): Promise<void> {
    // Categories are just used for filtering, no separate table needed
    return Promise.resolve();
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

  async insertBookmarksBatch(bookmarks: any[]): Promise<{ success: number; failed: number }> {
    if (!this.db) await this.init();
    if (!this.db) return { success: 0, failed: bookmarks.length };

    let success = 0;
    let failed = 0;

    for (const bookmark of bookmarks) {
      try {
        const result = await this.addBookmark(bookmark);
        if (result) success++;
        else failed++;
      } catch (error) {
        failed++;
      }
    }

    return { success, failed };
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
