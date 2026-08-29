# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Xmarks is a local-first, privacy-focused X/Twitter bookmark dashboard. It is a React SPA whose data lives entirely in an in-browser SQLite database (sql.js/WASM) persisted to IndexedDB. A small optional Node/Express API server (`server.js`) exists for one job only: downloading tweet media to disk with `aria2c`. AI categorization goes through the OpenRouter API (optional).

## Commands

- **Dev server**: `npm run dev` (Vite, http://127.0.0.1:5173, `strictPort`)
- **API server (dev)**: `npm run api:dev` (`node server.js`, port 3001)
- **API server (PM2)**: `npm run api:start` / `api:stop` / `api:restart` (uses `ecosystem.config.cjs`, which also defines an `xmarks-frontend` PM2 app)
- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **Type check**: `npm run typecheck` (runs `tsc --noEmit -p tsconfig.app.json`)
- **Preview prod build**: `npm run preview`

No test framework is configured. `aria2c` must be on PATH for server-side media download.

## Architecture

**Data flow**: User imports X bookmarks (JSON/CSV) → parsed and inserted into in-browser SQLite in batches of 100 → auto-persisted to IndexedDB after every write → React pages query the DB → OpenRouter optionally categorizes bookmarks → media URLs extracted at import time are sent to the API server, which runs `aria2c` into `media/`.

**Frontend layers (`src/`):**

- `lib/database.ts` — Singleton `BookmarkDatabase` (`export const db`) wrapping sql.js. All DB reads/writes go through here. Every mutating method calls `saveToFile()` → `db.export()` → IndexedDB. Inserts are schema-driven: `getTableColumns()` reads `PRAGMA table_info` and `resolveBookmarkValue()` fills every column, so imported `.db` files with extra columns keep working. sql.js WASM is loaded from `https://sql.js.org/dist/`.
- `lib/fileSystem.ts` — IndexedDB wrapper (`BookmarksDB` → store `database` → key `bookmarks_database`) storing the SQLite binary blob.
- `lib/mediaExtractor.ts` — Extracts deduplicated media URLs from raw bookmarks (prefers `original` over `url`), builds the canonical filename, and is the API client (`startServerDownload`, `getDownloadStatus`, `checkApiHealth`) using `VITE_API_URL`.
- `lib/translate.ts` — Free Google Translate `gtx` endpoint (no key) + `looksNonEnglish()` heuristic.
- `lib/assets.ts` — Inline SVG default avatar and `onError` fallback handler.
- `pages/Settings.tsx` — Largest file (~1100 lines). Categories CRUD, JSON/CSV import (with optional AI categorization per batch), AI re-categorization by source (uncategorized / all / a specific category) with `AbortController`, `.db` export/import, wipe, the Media Download section, and the log console. Pending media URLs are persisted in `localStorage['pendingMediaUrls']`.
- `pages/Home.tsx` — Feed of **random** bookmarks (`ORDER BY RANDOM()`, pages of 10 via `IntersectionObserver`). Search box with debounced suggestions; selecting a suggestion scrolls to it if on screen.
- `pages/Search.tsx` — Full search (`LIKE` on `full_text`, `name`, `screen_name`) with suggestions.
- `pages/CategoryView.tsx` — Up to 1000 bookmarks for one category, newest first.
- `components/BookmarkCard.tsx` — Tweet-styled card: linkified text, local media grid, translate button, inline category dropdown, undo-able delete (2s toast), engagement counts.
- `components/Sidebar.tsx`, `RightSidebar.tsx` (random picks), `Toast.tsx` (`useToast()` context), `LogConsole.tsx`.

**Routing**: No router. `App.tsx` holds `currentPage` in `useState`; values are `'home' | 'search' | 'settings' | 'category-<name>'`. Sidebar categories come from `Home` via `onCategoriesUpdate`.

**Backend (`server.js`, Express 5 + CORS):**

- `GET /health` → `{ ok, mediaDir }`
- `POST /download-media` with `{ items: [{ url, filename }] }` (or legacy `{ urls: [] }`) → writes `media-urls-<jobId>.txt` in aria2c input format (`URL\n  out=filename`), spawns `aria2c -i … -d MEDIA_DIR`, returns `{ jobId }`. Progress is estimated by counting new files in `MEDIA_DIR` every 3s; failures are counted from aria2c stderr. Job state is in-memory only.
- `GET /download-status/:jobId` → job object.
- Env: `MEDIA_DIR` (default `./media` relative to `server.js`), `API_PORT` (default 3001).
- Deployment: PM2 via `ecosystem.config.cjs` (logs in `logs/`) or systemd via `xmarks-api.service` (`/var/www/xmarks`).

**Dev media serving**: `vite.config.ts` has a custom `serveMediaFolder` plugin mounted at `/media`. It serves files with correct MIME types, supports byte-range requests for video, and falls back to prefix matching on `{screen_name}_{tweet_id}_{type}_{index}_` when the date suffix in the request doesn't match the file on disk. In production the `media/` folder must be served by your web server at `VITE_MEDIA_PATH`.

**Database schema**:
- `bookmarks`: id (PK), created_at, full_text, favorite_count, retweet_count, reply_count, views_count, name, screen_name, profile_image_url, media (JSON array string), category, url. Indexes on `created_at DESC`, `category`, `screen_name`.
- `categories`: id (UUID PK), name (UNIQUE), created_at. `getCategoriesWithCounts()` unions user-created categories, categories only present on bookmarks, and a synthetic `Uncategorized` row.

**AI categorization**: Model is hardcoded as `deepseek/deepseek-v4-flash` via `@openrouter/sdk` in two places in `Settings.tsx` (`categorizeBookmark()` and `categorizeWithAI()`). The response must exactly match an existing category name or it's set to `Uncategorized`. 500 ms delay between calls.

## Environment Variables

Defined in `.env` (see `.env.example`). All are exposed to the browser bundle — including the OpenRouter key.
- `VITE_OPENROUTER_API_KEY` — Required for AI categorization
- `VITE_MEDIA_PATH` — Path to local media folder (default `/media`)
- `VITE_API_URL` — Base URL of the media download API (default `http://localhost:3001`)
- `VITE_DEFAULT_CATEGORIES` — Comma-separated categories seeded when the `categories` table is empty

Server-side (`server.js`): `MEDIA_DIR`, `API_PORT`.

## Tech Stack

React 18 + TypeScript + Vite 5 + Tailwind CSS 3 (frontend). Express 5 + aria2c (API). Dark theme throughout. Icons via Lucide React. No SSR.

## Conventions

- Functional components with hooks (useState, useEffect, useRef)
- All DB operations are async — database initializes lazily on first use (`if (!this.db) await this.init()`)
- Console logging with prefixes (`[Database]`, `[FileSystem]`, `[Settings]`, `[BookmarkCard]`, `[Job <id>]` on the server) for debugging
- Media files live in `media/` (gitignored except `.gitkeep`), named `{screen_name}_{tweet_id}_{media_type}_{index}_{YYYYMMDD}.{ext}` where `media_type` is `photo | video | animated_gif` and `index` is 1-based per tweet
- `media-urls-*.txt` temp files are gitignored
