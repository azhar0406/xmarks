import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';

const MIME_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

function serveMediaFolder(): Plugin {
  const mediaDir = path.resolve(__dirname, 'media');

  let dirCache: string[] | null = null;
  const getDirListing = (): string[] => {
    if (dirCache) return dirCache;
    try {
      dirCache = fs.readdirSync(mediaDir);
    } catch {
      dirCache = [];
    }
    return dirCache;
  };
  const invalidateDirCache = () => { dirCache = null; };
  try {
    fs.watch(mediaDir, { persistent: false }, invalidateDirCache);
  } catch { /* watch may fail; safe to ignore */ }

  // Strip trailing _YYYYMMDD.ext to get the unique {screen_name}_{tweet_id}_{type}_{index}_ prefix.
  const buildPrefix = (filename: string): string | null => {
    const m = filename.match(/^(.+_\d+_(?:photo|video|animated_gif)_\d+)_\d{8}\.[a-z0-9]{2,5}$/i);
    return m ? m[1] + '_' : null;
  };

  const resolveActualFile = (requested: string): string | null => {
    const exactPath = path.join(mediaDir, requested);
    if (fs.existsSync(exactPath) && fs.statSync(exactPath).isFile()) return exactPath;
    const prefix = buildPrefix(requested);
    if (!prefix) return null;
    const match = getDirListing().find(f => f.startsWith(prefix));
    return match ? path.join(mediaDir, match) : null;
  };

  return {
    name: 'serve-media',
    configureServer(server) {
      server.middlewares.use('/media', (req, res, next) => {
        try {
          const url = decodeURIComponent((req.url || '').split('?')[0]);
          const requested = url.replace(/^\/+/, '');
          const filePath = resolveActualFile(requested);
          if (!filePath) {
            res.statusCode = 404;
            return res.end('Not found');
          }
          if (!filePath.startsWith(mediaDir + path.sep)) {
            res.statusCode = 403;
            return res.end('Forbidden');
          }
          const stat = fs.statSync(filePath);
          if (!stat.isFile()) return next();

          const ext = path.extname(filePath).toLowerCase();
          const mime = MIME_TYPES[ext] || 'application/octet-stream';
          res.setHeader('Content-Type', mime);
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Cache-Control', 'public, max-age=3600');

          const range = req.headers.range;
          if (range && mime.startsWith('video/')) {
            const match = /bytes=(\d*)-(\d*)/.exec(range);
            const start = match && match[1] ? parseInt(match[1], 10) : 0;
            const end = match && match[2] ? parseInt(match[2], 10) : stat.size - 1;
            if (start >= stat.size || end >= stat.size) {
              res.statusCode = 416;
              res.setHeader('Content-Range', `bytes */${stat.size}`);
              return res.end();
            }
            res.statusCode = 206;
            res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
            res.setHeader('Content-Length', String(end - start + 1));
            fs.createReadStream(filePath, { start, end }).pipe(res);
          } else {
            res.setHeader('Content-Length', String(stat.size));
            fs.createReadStream(filePath).pipe(res);
          }
        } catch (err: any) {
          if (err && err.code === 'ENOENT') {
            res.statusCode = 404;
            return res.end('Not found');
          }
          res.statusCode = 500;
          res.end('Internal error');
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), serveMediaFolder()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
