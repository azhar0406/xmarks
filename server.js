import express from 'express';
import cors from 'cors';
import { execFile } from 'child_process';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync, readdirSync } from 'fs';

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

// Resolve paths relative to this file's location, not process.cwd()
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const MEDIA_DIR = process.env.MEDIA_DIR || join(__dirname, 'media');

/**
 * Generate a filename from a URL when client doesn't provide one.
 * Extracts the media ID from the URL path and adds the correct extension.
 */
function generateFilename(url, index) {
  try {
    const urlPath = url.split('?')[0];
    const parts = urlPath.split('/');
    const mediaId = parts[parts.length - 1] || `file_${index}`;
    // Determine extension from URL
    const extMatch = urlPath.match(/\.([a-zA-Z0-9]+)$/);
    let ext = extMatch ? extMatch[1] : 'jpg';
    // Check if it's a video URL
    if (url.includes('/amplify_video/') || url.includes('/ext_tw_video/') || url.includes('/tweet_video/')) {
      ext = 'mp4';
    }
    return `${mediaId}.${ext}`;
  } catch {
    return `file_${index}.jpg`;
  }
}
const PORT = process.env.API_PORT || 3001;

// In-memory download state
const downloads = new Map();

// Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, mediaDir: MEDIA_DIR });
});

// Start a download job
app.post('/download-media', async (req, res) => {
  const { items, urls } = req.body;

  // Support both old format (just urls) and new format (items with metadata)
  let downloadItems = [];
  if (Array.isArray(items) && items.length > 0) {
    downloadItems = items;
  } else if (Array.isArray(urls) && urls.length > 0) {
    // Fallback: convert URLs to items without custom filenames
    downloadItems = urls.map(url => ({ url, filename: null }));
  } else {
    return res.status(400).json({ error: 'items or urls must be a non-empty array' });
  }

  const jobId = randomUUID().slice(0, 8);

  // Ensure media dir and logs dir exist
  for (const dir of [MEDIA_DIR, join(__dirname, 'logs')]) {
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  }

  // Write aria2c input file with custom filenames
  // Format: URL\n  out=filename
  const tmpFile = join(__dirname, `media-urls-${jobId}.txt`);
  let fileContent = '';
  let fileIndex = 0;
  for (const item of downloadItems) {
    fileContent += item.url + '\n';
    fileIndex++;
    // Generate filename if not provided by client
    const filename = item.filename || generateFilename(item.url, fileIndex);
    fileContent += `  out=${filename}\n`;
  }
  await writeFile(tmpFile, fileContent);

  // Verify file was written
  const fileExists = existsSync(tmpFile);
  console.log(`[Job ${jobId}] Input file: ${tmpFile}`);
  console.log(`[Job ${jobId}] File exists: ${fileExists}`);
  console.log(`[Job ${jobId}] File content (first 3 lines):`);
  console.log(fileContent.split('\n').slice(0, 6).join('\n'));

  downloads.set(jobId, {
    status: 'running',
    total: downloadItems.length,
    completed: 0,
    failed: 0,
    startedAt: Date.now(),
    tmpFile: tmpFile,
  });

  // Run aria2c in the background
  const args = [
    '-i', tmpFile,
    '-x', '4',
    '-s', '4',
    '--max-connection-per-server=4',
    '-d', MEDIA_DIR,
    '--content-disposition=false',
    '--allow-overwrite=true',
    '--auto-file-renaming=false',
    '--file-allocation=none',
  ];

  console.log(`[Job ${jobId}] Starting aria2c for ${downloadItems.length} URLs → ${MEDIA_DIR}`);
  console.log(`[Job ${jobId}] aria2c args: ${args.join(' ')}`);

  const child = execFile('aria2c', args, { timeout: 1_800_000 }, (error, stdout, stderr) => {
    const job = downloads.get(jobId);
    if (!job) return;

    // Log aria2c output for debugging
    if (stdout) console.log(`[Job ${jobId}] aria2c stdout:`, stdout.toString().slice(0, 500));
    if (stderr) console.log(`[Job ${jobId}] aria2c stderr:`, stderr.toString().slice(0, 500));

    if (error) {
      job.status = 'error';
      job.error = error.message;
      console.error(`[Job ${jobId}] Failed:`, error.message);
      // Keep the input file on failure for debugging
      console.log(`[Job ${jobId}] Keeping input file for debugging: ${tmpFile}`);
    } else {
      job.status = 'completed';
      job.completed = job.total;
      console.log(`[Job ${jobId}] Completed successfully`);
      // Cleanup temp file on success
      unlink(tmpFile).catch(() => {});
    }
  });

  // Snapshot file count before this job starts
  let existingFileCount = 0;
  try {
    existingFileCount = readdirSync(MEDIA_DIR).length;
  } catch {}

  // Track failed downloads from aria2c stderr output
  child.stderr?.on('data', (data) => {
    const job = downloads.get(jobId);
    if (!job || job.status !== 'running') return;
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.includes('Download failed:') || line.includes('(error code')) {
        job.failed++;
      }
    }
  });

  // Periodically sync completed count with actual new files on disk
  const countInterval = setInterval(() => {
    const job = downloads.get(jobId);
    if (!job || job.status !== 'running') {
      clearInterval(countInterval);
      return;
    }
    try {
      const currentCount = readdirSync(MEDIA_DIR).length;
      const newFiles = Math.max(0, currentCount - existingFileCount);
      job.completed = Math.min(newFiles, job.total);
    } catch {}
  }, 3000);

  res.json({ jobId, status: 'running', total: downloadItems.length });
});

// Check download status
app.get('/download-status/:jobId', (req, res) => {
  const job = downloads.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});

app.listen(PORT, () => {
  console.log(`Xmarks API server running on http://localhost:${PORT}`);
  console.log(`Media download directory: ${MEDIA_DIR}`);
});
