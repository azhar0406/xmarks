import { useState, useEffect } from 'react';
import { db, Category } from '../lib/database';
import { Plus, Trash2, Upload, Download, Loader2, Zap, XCircle } from 'lucide-react';
import LogConsole from '../components/LogConsole';
import { OpenRouter } from '@openrouter/sdk';

interface LogEntry {
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
}

interface SettingsProps {
  onDatabaseWipe?: () => void;
  onDatabaseImport?: () => void;
}

export default function Settings({ onDatabaseWipe, onDatabaseImport }: SettingsProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [categorizing, setCategorizing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [storageInfo, setStorageInfo] = useState({ used: 0, limit: 0 });
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [autoCategorize, setAutoCategorize] = useState(false);
  const [recategorizeSource, setRecategorizeSource] = useState<string>('__uncategorized__');

  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  const mediaPath = import.meta.env.VITE_MEDIA_PATH;
  const defaultCategories = import.meta.env.VITE_DEFAULT_CATEGORIES;

  const checkStorageUsage = () => {
    try {
      const bytes = db.getDatabaseSize();
      const usedMB = bytes / 1024 / 1024;
      setStorageInfo({ used: usedMB, limit: 0 });
    } catch (error) {
      console.error('Error checking storage:', error);
    }
  };

  const handleExportDatabase = () => {
    console.log('[Settings] Export button clicked');
    try {
      const data = db.exportDatabase();
      console.log('[Settings] Export data retrieved:', data ? `${data.length} bytes` : 'null');

      if (!data) {
        setMessage('No database to export');
        addLog('warning', 'No database data to export');
        return;
      }

      console.log('[Settings] Creating blob and download link...');
      const blob = new Blob([data], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bookmarks-${new Date().toISOString().split('T')[0]}.db`;
      document.body.appendChild(a);
      console.log('[Settings] Triggering download...');
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log('[Settings] Download triggered successfully');

      addLog('success', `Database exported: ${(data.length / 1024 / 1024).toFixed(2)} MB`);
      setMessage('Database downloaded successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('[Settings] Export error:', error);
      addLog('error', `Export failed: ${error}`);
      setMessage('Failed to export database');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleImportDatabase = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      console.log('[Settings] No file selected');
      return;
    }

    console.log('[Settings] Starting database import...', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

    try {
      addLog('info', `Importing database file: ${file.name}`);

      const { importDBFile } = await import('../lib/fileSystem');
      console.log('[Settings] importDBFile function loaded');

      const importedData = await importDBFile(file);
      console.log('[Settings] importDBFile returned:', importedData ? 'data' : 'null');

      if (!importedData) {
        throw new Error('Failed to import database file - importDBFile returned null');
      }

      addLog('info', `Loading database file: ${(importedData.length / 1024 / 1024).toFixed(2)} MB`);
      console.log('[Settings] Calling db.importDatabase...');

      await db.importDatabase(importedData);
      console.log('[Settings] db.importDatabase completed');

      const categories = await db.getCategories();
      const bookmarkCount = await db.getBookmarkCount();
      console.log('[Settings] Database stats:', { bookmarkCount, categoriesCount: categories.length });

      addLog('success', `Database imported: ${(importedData.length / 1024 / 1024).toFixed(2)} MB`);
      addLog('info', `Loaded: ${bookmarkCount} bookmarks, ${categories.length} categories`);

      setMessage('Database imported successfully! Reloading...');

      setTimeout(() => {
        onDatabaseImport?.();
      }, 1000);
    } catch (error) {
      console.error('[Settings] Import error:', error);
      console.error('[Settings] Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('[Settings] Error message:', error instanceof Error ? error.message : String(error));
      console.error('[Settings] Error stack:', error instanceof Error ? error.stack : 'No stack trace');

      const errorMsg = error instanceof Error ? error.message : String(error);
      addLog('error', `Import failed: ${errorMsg}`);
      setMessage(`Failed to import database file: ${errorMsg}`);
      setTimeout(() => setMessage(''), 5000);
    }

    e.target.value = '';
  };

  const addLog = (type: LogEntry['type'], message: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    setLogs(prev => [...prev, { timestamp, type, message }]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    await seedDefaultCategories();
    await loadCategories();
    checkStorageUsage();
  };

  const seedDefaultCategories = async () => {
    try {
      const existingCategories = await db.getCategories();

      if (existingCategories.length === 0 && defaultCategories) {
        const categoryNames = defaultCategories.split(',').map(cat => cat.trim()).filter(cat => cat);
        let addedCount = 0;

        for (const name of categoryNames) {
          try {
            await db.addCategory(name);
            addedCount++;
          } catch (error) {
            // Silently ignore duplicate category errors
          }
        }

        if (addedCount > 0) {
          addLog('success', `Initialized ${addedCount} default categories from .env`);
        }
      }
    } catch (error) {
      console.error('Error seeding default categories:', error);
    }
  };

  const loadCategories = async () => {
    const data = await db.getCategories();
    setCategories(data);
  };

  const addCategory = async () => {
    if (!newCategory.trim()) return;

    try {
      await db.addCategory(newCategory.trim());
      setNewCategory('');
      loadCategories();
      setMessage('Category added successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Settings] Error adding category:', error);
      setMessage(`Error adding category: ${errorMsg}`);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      await db.deleteCategory(id);
      loadCategories();
      setMessage('Category deleted successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Error deleting category');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleWipeData = async () => {
    if (!confirm('Are you sure you want to wipe ALL data? This will delete the .db file! This cannot be undone!')) {
      return;
    }

    if (!confirm('This will delete all bookmarks, categories, and settings. Are you absolutely sure?')) {
      return;
    }

    try {
      addLog('warning', 'Wiping database and removing file...');
      await db.wipeDatabase();
      setCategories([]);
      checkStorageUsage();
      addLog('success', 'Database wiped and file removed');
      setMessage('All data wiped successfully! Starting fresh...');
      onDatabaseWipe?.();
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addLog('error', `Failed to wipe data: ${errorMsg}`);
      setMessage('Error wiping data');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const categorizeBookmark = async (bookmark: any, categoryList: string, apiKey: string): Promise<string> => {
    const openrouter = new OpenRouter({
      apiKey: apiKey
    });

    const completion = await openrouter.chat.send({
      model: 'x-ai/grok-4-fast',
      messages: [
        {
          role: 'system',
          content: `You are a tweet categorization assistant. Analyze the tweet content and assign it to ONE of these categories ONLY: ${categoryList}. You MUST respond with ONLY the exact category name from the list provided, nothing else. If it doesn't clearly fit any category, respond with "Uncategorized".`,
        },
        {
          role: 'user',
          content: `Categorize this tweet into one of the categories: ${categoryList}\n\nTweet: ${bookmark.full_text}`,
        },
      ],
    });

    let category: string | undefined;

    if (completion && typeof completion === 'object') {
      if ('choices' in completion && Array.isArray(completion.choices) && completion.choices[0]?.message?.content) {
        category = completion.choices[0].message.content.trim();
      } else if ('content' in completion && typeof completion.content === 'string') {
        category = completion.content.trim();
      } else if ('message' in completion && typeof (completion as any).message === 'object' && 'content' in (completion as any).message) {
        category = (completion as any).message.content.trim();
      }
    }

    return category || 'Uncategorized';
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (autoCategorize && !apiKey) {
      setMessage('Please set OpenRouter API key first to use auto-categorization!');
      setTimeout(() => setMessage(''), 3000);
      e.target.value = '';
      return;
    }

    setImporting(true);
    setMessage('');
    setImportProgress({ current: 0, total: 0 });

    addLog('info', `Starting file upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    try {
      addLog('info', 'Reading file contents...');
      const text = await file.text();
      let bookmarks;

      if (file.name.endsWith('.json')) {
        addLog('info', 'Parsing JSON data...');
        bookmarks = JSON.parse(text);
      } else if (file.name.endsWith('.csv')) {
        addLog('info', 'Parsing CSV data...');
        const lines = text.split('\n');
        const headers = lines[0].split(',');
        bookmarks = lines.slice(1).map((line) => {
          const values = line.split(',');
          const obj: any = {};
          headers.forEach((header, i) => {
            obj[header.trim()] = values[i]?.trim();
          });
          return obj;
        });
      }

      if (!Array.isArray(bookmarks)) {
        bookmarks = [bookmarks];
      }

      const validBookmarks = bookmarks.filter(b => b && b.id);
      addLog('info', `Found ${validBookmarks.length} valid bookmarks to import`);

      if (autoCategorize) {
        addLog('info', 'Auto-categorization is enabled. Processing bookmarks with AI...');
      }

      const batchSize = 100;
      let totalImported = 0;
      let totalCategorized = 0;

      setImportProgress({ current: 0, total: validBookmarks.length });

      const categoryList = categories.map((c) => c.name).join(', ');

      for (let i = 0; i < validBookmarks.length; i += batchSize) {
        const batch = validBookmarks.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(validBookmarks.length / batchSize);

        addLog('info', `Processing batch ${batchNum}/${totalBatches} (${batch.length} bookmarks)...`);

        try {
          const result = await db.insertBookmarksBatch(batch);
          totalImported += result.success;

          if (result.failed > 0) {
            addLog('warning', `Batch ${batchNum}: ${result.success} succeeded, ${result.failed} failed`);
            if (result.errors && result.errors.length > 0) {
              result.errors.forEach((err: string) => addLog('error', err));
            }
          } else {
            addLog('success', `Batch ${batchNum}: ${result.success} bookmarks imported successfully`);
          }

          if (autoCategorize && result.success > 0) {
            addLog('info', `Categorizing batch ${batchNum} with AI...`);

            for (let j = 0; j < batch.length; j++) {
              const bookmark = batch[j];
              try {
                const category = await categorizeBookmark(bookmark, categoryList, apiKey);

                if (categories.some((c) => c.name === category)) {
                  await db.updateBookmarkCategory(bookmark.id, category);
                  addLog('success', `[${j + 1}/${batch.length}] Categorized as: ${category}`);
                } else {
                  await db.updateBookmarkCategory(bookmark.id, 'Uncategorized');
                  addLog('warning', `[${j + 1}/${batch.length}] Set to: Uncategorized (AI returned: ${category})`);
                }
                totalCategorized++;

                await new Promise((resolve) => setTimeout(resolve, 500));
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                addLog('error', `Failed to categorize bookmark: ${errorMsg}`);
              }
            }

            addLog('success', `Batch ${batchNum} categorization complete`);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          if (errorMsg.includes('quota')) {
            addLog('error', `Storage limit reached at batch ${batchNum}. Cannot import more bookmarks.`);
            addLog('error', `Total imported: ${totalImported}/${validBookmarks.length}`);
            break;
          }
          throw error;
        }

        setImportProgress({
          current: Math.min(i + batchSize, validBookmarks.length),
          total: validBookmarks.length
        });

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (autoCategorize) {
        addLog('success', `Import & categorization complete! ${totalImported} imported, ${totalCategorized} categorized`);
        setMessage(`Successfully imported ${totalImported} and categorized ${totalCategorized} bookmarks!`);
      } else {
        addLog('success', `Import complete! ${totalImported} of ${validBookmarks.length} bookmarks imported`);
        setMessage(`Successfully imported ${totalImported} of ${validBookmarks.length} bookmarks!`);
      }

      setImportProgress({ current: 0, total: 0 });
      checkStorageUsage();
      onDatabaseImport?.();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addLog('error', `Import failed: ${errorMsg}`);
      setMessage('Error importing file. Please check the format.');
      console.error('Import error:', error);
      setImportProgress({ current: 0, total: 0 });
    }

    setImporting(false);
    e.target.value = '';
  };

  const stopCategorization = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      addLog('warning', 'Categorization stopped by user');
      setMessage('Categorization stopped');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const categorizeWithAI = async () => {
    if (!apiKey) {
      setMessage('Please set OpenRouter API key first!');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const controller = new AbortController();
    setAbortController(controller);
    setCategorizing(true);
    setMessage('');

    const sourceLabel =
      recategorizeSource === '__uncategorized__'
        ? 'Uncategorized'
        : recategorizeSource === '__all__'
          ? 'All'
          : recategorizeSource;

    addLog('info', `Starting AI categorization process (source: ${sourceLabel})...`);

    try {
      addLog('info', `Fetching bookmarks from: ${sourceLabel}`);
      let bookmarks;
      if (recategorizeSource === '__uncategorized__') {
        bookmarks = await db.getUncategorizedBookmarks();
      } else if (recategorizeSource === '__all__') {
        bookmarks = await db.getAllBookmarks();
      } else {
        bookmarks = await db.getBookmarksByCategory(recategorizeSource);
      }

      if (!bookmarks || bookmarks.length === 0) {
        addLog('warning', `No bookmarks found in: ${sourceLabel}`);
        setMessage(`No bookmarks found in: ${sourceLabel}`);
        setCategorizing(false);
        setAbortController(null);
        setTimeout(() => setMessage(''), 3000);
        return;
      }

      addLog('info', `Found ${bookmarks.length} bookmarks to categorize`);
      const categoryList = categories.map((c) => c.name).join(', ');
      addLog('info', `Using categories: ${categoryList}`);
      let categorized = 0;
      let failed = 0;

      for (let i = 0; i < bookmarks.length; i++) {
        if (controller.signal.aborted) {
          addLog('warning', `Stopped at ${i}/${bookmarks.length}. Progress: ${categorized} succeeded, ${failed} failed`);
          break;
        }

        const bookmark = bookmarks[i];
        addLog('info', `[${i + 1}/${bookmarks.length}] Categorizing: "${bookmark.full_text.substring(0, 50)}..."`);

        try {
          const openrouter = new OpenRouter({
            apiKey: apiKey
          });

          const completion = await openrouter.chat.send({
            model: 'x-ai/grok-4-fast',
            messages: [
              {
                role: 'system',
                content: `You are a tweet categorization assistant. Analyze the tweet content and assign it to ONE of these categories ONLY: ${categoryList}. You MUST respond with ONLY the exact category name from the list provided, nothing else. If it doesn't clearly fit any category, respond with "Uncategorized".`,
              },
              {
                role: 'user',
                content: `Categorize this tweet into one of the categories: ${categoryList}\n\nTweet: ${bookmark.full_text}`,
              },
            ],
          });

          let category: string | undefined;

          if (completion && typeof completion === 'object') {
            if ('choices' in completion && Array.isArray(completion.choices) && completion.choices[0]?.message?.content) {
              category = completion.choices[0].message.content.trim();
            } else if ('content' in completion && typeof completion.content === 'string') {
              category = completion.content.trim();
            } else if ('message' in completion && typeof (completion as any).message === 'object' && 'content' in (completion as any).message) {
              category = (completion as any).message.content.trim();
            }
          }

          if (category && categories.some((c) => c.name === category)) {
            await db.updateBookmarkCategory(bookmark.id, category);
            addLog('success', `Categorized as: ${category}`);
            categorized++;
          } else {
            await db.updateBookmarkCategory(bookmark.id, 'Uncategorized');
            addLog('warning', `No valid category match, set to: Uncategorized (AI returned: ${category || 'no response'})`);
          }

          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            break;
          }
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          addLog('error', `Failed to categorize: ${errorMsg}`);
          console.error('Categorization error details:', error);
          failed++;
        }
      }

      if (!controller.signal.aborted) {
        addLog('success', `Categorization complete! ${categorized} succeeded, ${failed} failed out of ${bookmarks.length}`);
        setMessage(`Successfully categorized ${categorized} of ${bookmarks.length} bookmarks!`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addLog('error', `Categorization process failed: ${errorMsg}`);
      setMessage('Error during categorization. Please try again.');
      console.error('Categorization error:', error);
    }

    setCategorizing(false);
    setAbortController(null);
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="border-b border-gray-800 sticky top-0 bg-black/80 backdrop-blur-sm z-10">
        <div className="p-4">
          <h2 className="text-xl font-bold text-white">Settings</h2>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-6 space-y-8">
        {storageInfo.used > 0 && (
          <div className="bg-blue-500/20 border border-blue-500 text-blue-400 px-4 py-3 rounded-lg">
            <p className="font-semibold mb-1">Database Size</p>
            <p className="text-sm">
              Current database: {storageInfo.used.toFixed(2)} MB
            </p>
            <p className="text-xs mt-1 text-blue-300">
              Use the Database Management section to export your data.
            </p>
          </div>
        )}

        {message && (
          <div className="bg-blue-500/20 border border-blue-500 text-blue-400 px-4 py-3 rounded-lg">
            {message}
          </div>
        )}

        {(!apiKey || apiKey === 'your-openrouter-api-key-here') && (
          <div className="bg-yellow-500/20 border border-yellow-500 text-yellow-400 px-4 py-3 rounded-lg">
            <p className="font-semibold mb-1">Configure OpenRouter API Key</p>
            <p className="text-sm">
              Please add your OpenRouter API key to the <code className="bg-yellow-900/30 px-2 py-1 rounded">.env</code> file.
              Get your key from{' '}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-yellow-300"
              >
                openrouter.ai
              </a>
            </p>
          </div>
        )}

        <section className="bg-gray-900 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Categories</h3>
          <div className="space-y-4">
            {categories.length > 0 && (
              <p className="text-gray-400 text-sm">
                Categories are loaded from database. Default categories are seeded from .env on first launch.
              </p>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="New category name"
                className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && addCategory()}
              />
              <button
                onClick={addCategory}
                className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                <Plus size={20} />
                Add
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between bg-gray-800 px-4 py-3 rounded-lg"
                >
                  <span className="text-white">{category.name}</span>
                  <button
                    onClick={() => deleteCategory(category.id)}
                    className="text-red-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-gray-900 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Import Bookmarks</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-gray-800 px-4 py-3 rounded-lg">
              <input
                type="checkbox"
                id="autoCategorize"
                checked={autoCategorize}
                onChange={(e) => setAutoCategorize(e.target.checked)}
                disabled={importing}
                className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />
              <label
                htmlFor="autoCategorize"
                className="text-white text-sm flex-1 cursor-pointer"
              >
                Automatically categorize with AI during import (waits for each batch to complete)
              </label>
              {autoCategorize && !apiKey && (
                <span className="text-yellow-400 text-xs">API key required</span>
              )}
            </div>
            <div>
              <label className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-6 py-4 rounded-lg font-semibold transition-colors cursor-pointer">
                {importing ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    {autoCategorize ? 'Importing & Categorizing...' : 'Importing...'}
                  </>
                ) : (
                  <>
                    <Upload size={20} />
                    Upload JSON or CSV File
                  </>
                )}
                <input
                  type="file"
                  accept=".json,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={importing}
                />
              </label>
              <p className="text-gray-500 text-sm mt-2">
                Upload your exported X.com bookmarks in JSON or CSV format
              </p>
            </div>
            {importProgress.total > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>{autoCategorize ? 'Importing & Categorizing...' : 'Importing bookmarks...'}</span>
                  <span>{importProgress.current} / {importProgress.total}</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="bg-gray-900 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Database Management</h3>
          <div className="space-y-4">
            <div className="bg-blue-500/20 border border-blue-500 text-blue-400 px-4 py-3 rounded-lg">
              <p className="font-semibold mb-1">Database Export & Import</p>
              <p className="text-sm">
                Download your database as a .db file or load a previously exported database file.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleExportDatabase}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Download size={18} />
                Download Database (.db)
              </button>

              <label className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2">
                <Upload size={18} />
                Load Database (.db)
                <input
                  type="file"
                  accept=".db,.sqlite,.sqlite3"
                  onChange={handleImportDatabase}
                  className="hidden"
                />
              </label>
            </div>

            <p className="text-gray-400 text-sm">
              The .db file is a standard SQLite database that you can open with any SQLite tool or transfer between devices.
            </p>

            <div className="border-t border-gray-800 pt-4">
              <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-3">
                <p className="font-semibold mb-1">Danger Zone</p>
                <p className="text-sm">
                  This action cannot be undone. All bookmarks, categories, and settings will be permanently deleted.
                </p>
              </div>
              <button
                onClick={handleWipeData}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={18} />
                Wipe All Data
              </button>
            </div>
          </div>
        </section>

        <section className="bg-gray-900 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">AI Categorization</h3>
          <div className="space-y-4">
            <p className="text-gray-400">
              Use AI to categorize bookmarks using Grok 4 Fast. Pick a source below — the AI will assign each bookmark to one of your existing categories.
            </p>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Source to categorize</label>
              <select
                value={recategorizeSource}
                onChange={(e) => setRecategorizeSource(e.target.value)}
                disabled={categorizing}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="__uncategorized__">Uncategorized only</option>
                <option value="__all__">All bookmarks (re-categorize everything)</option>
                {categories
                  .filter((c) => c.name !== 'Uncategorized')
                  .map((c) => (
                    <option key={c.id} value={c.name}>
                      Re-categorize: {c.name} ({c.count})
                    </option>
                  ))}
              </select>
              <p className="text-gray-500 text-xs mt-2">
                AI can only assign bookmarks to categories that exist in your list above.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={categorizeWithAI}
                disabled={categorizing || !apiKey}
                className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {categorizing ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Categorizing...
                  </>
                ) : (
                  <>
                    <Zap size={20} />
                    {recategorizeSource === '__uncategorized__'
                      ? 'Categorize with AI'
                      : 'Re-categorize with AI'}
                  </>
                )}
              </button>
              {categorizing && (
                <button
                  onClick={stopCategorization}
                  className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  <XCircle size={20} />
                  Stop
                </button>
              )}
            </div>
            {!apiKey && (
              <p className="text-yellow-400 text-sm">
                Please configure your OpenRouter API key first
              </p>
            )}
          </div>
        </section>

        <section>
          <LogConsole logs={logs} onClear={clearLogs} />
        </section>
      </div>
    </div>
  );
}
