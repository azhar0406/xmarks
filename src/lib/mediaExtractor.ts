/**
 * Extracts unique media URLs from an array of bookmark objects.
 *
 * Each bookmark's `media` field is either a JSON string or an array of
 * `{ type, url, thumbnail?, original? }` objects.
 *
 * - Photos  → use `original` (highest quality) or fall back to `url`
 * - Videos / animated_gifs → use `url`
 *
 * Returns a deduplicated array of URL strings, one per line suitable for
 * an aria2c input file.
 */

export interface MediaItem {
  type: string;        // "photo" | "video" | "animated_gif"
  url: string;
  thumbnail?: string;
  original?: string;
}

function parseMedia(media: unknown): MediaItem[] {
  if (!media) return [];
  if (Array.isArray(media)) return media as MediaItem[];
  if (typeof media === 'string') {
    try {
      const parsed = JSON.parse(media);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Given raw bookmark objects (as parsed from the uploaded JSON file),
 * return a deduplicated list of downloadable media URLs.
 */
export interface MediaItemWithMeta {
  url: string;
  filename: string | null;
}

/**
 * Build a proper filename from bookmark metadata.
 * Format: {username}_{media_id}_{type}_{index}_{date}.{ext}
 * Example: gregpr07_2057939790268604786_animated_gif_1_20260523.mp4
 */
function buildFilename(
  screenName: string,
  bookmarkId: string,
  type: string,
  index: number,
  createdAt: string,
  url: string
): string {
  // Extract date (YYYY-MM-DD) from created_at like "2026-05-23 03:10:55 +05:30"
  const dateStr = createdAt ? createdAt.split(' ')[0].replace(/-/g, '') : 'unknown';
  
  // Extract extension from URL
  const urlPath = url.split('?')[0];
  const extMatch = urlPath.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1] : 'mp4';
  
  // Clean username (remove special chars)
  const cleanName = (screenName || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '');
  
  // Type mapping
  const typeStr = type || 'photo';
  
  return `${cleanName}_${bookmarkId}_${typeStr}_${index}_${dateStr}.${ext}`;
}

export function extractMediaUrls(bookmarks: any[]): MediaItemWithMeta[] {
  const seen = new Set<string>();
  const items: MediaItemWithMeta[] = [];

  for (const bookmark of bookmarks) {
    const mediaItems = parseMedia(bookmark.media);
    let mediaIndex = 0;

    for (const item of mediaItems) {
      // Pick the best URL for this media item
      // Always prefer 'original' (actual media URL) over 'url' (often a t.co redirect)
      const downloadUrl = item.original || item.url;

      if (!downloadUrl) continue;

      // Deduplicate
      if (seen.has(downloadUrl)) continue;
      seen.add(downloadUrl);
      
      mediaIndex++;
      const filename = buildFilename(
        bookmark.screen_name,
        bookmark.id,
        item.type,
        mediaIndex,
        bookmark.created_at,
        downloadUrl
      );
      
      items.push({ url: downloadUrl, filename });
    }
  }

  return items;
}

/**
 * Build the content of a media-urls.txt file for aria2c.
 * Each line is a URL – aria2c will download them all in parallel.
 */
export function buildMediaUrlsFile(items: MediaItemWithMeta[]): string {
  // aria2c input file format: URL\n  out=filename
  let content = '';
  for (const item of items) {
    content += item.url + '\n';
    if (item.filename) {
      content += `  out=${item.filename}\n`;
    }
  }
  return content;
}

/**
 * Trigger a browser download of the media-urls.txt content.
 */
export function downloadMediaUrlsFile(items: MediaItemWithMeta[]): void {
  const content = buildMediaUrlsFile(items);
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'media-urls.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface DownloadJob {
  jobId: string;
  status: 'running' | 'completed' | 'error';
  total: number;
  completed: number;
  failed: number;
  error?: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Start a server-side aria2c download via the API.
 */
export async function startServerDownload(items: MediaItemWithMeta[]): Promise<DownloadJob> {
  const res = await fetch(`${API_BASE}/api/download-media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Poll the status of a download job.
 */
export async function getDownloadStatus(jobId: string): Promise<DownloadJob> {
  const res = await fetch(`${API_BASE}/api/download-status/${jobId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Check if the API server is reachable.
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}
