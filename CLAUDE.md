# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Xmarks is a local-first, privacy-focused X/Twitter bookmark dashboard. It's a React SPA with **no backend** — all data lives in an in-browser SQLite database (sql.js/WASM) persisted to IndexedDB. AI categorization is handled via OpenRouter API (optional).

## Commands

- **Dev server**: `npm run dev` (Vite, localhost:5173)
- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **Type check**: `npm run typecheck` (runs `tsc --noEmit -p tsconfig.app.json`)
- **Preview prod build**: `npm run preview`

No test framework is configured.

## Architecture

**Data flow**: User imports X bookmarks (JSON/CSV) → parsed and inserted into in-browser SQLite → auto-persisted to IndexedDB → React components query DB for display → OpenRouter API optionally categorizes bookmarks via AI.

**Key layers:**

- `src/lib/database.ts` — Singleton `BookmarkDatabase` class wrapping sql.js. All DB reads/writes go through here. Auto-persists to IndexedDB after writes. sql.js WASM loaded from `https://sql.js.org/dist/`.
- `src/lib/fileSystem.ts` — IndexedDB wrapper for persisting the SQLite binary database blob.
- `src/pages/Settings.tsx` — Largest file (~31KB). Handles import/export, category management, AI categorization, and logging. This is where most business logic lives.
- `src/components/BookmarkCard.tsx` — Tweet-styled card rendering with media support and engagement metrics.

**Routing**: Hash-based routing in `App.tsx` — Home (`/`), Search, CategoryView, Settings.

**Database schema**: Single `bookmarks` table with columns: id, created_at, full_text, favorite_count, retweet_count, reply_count, views_count, name, screen_name, profile_image_url, media (JSON array), category. Indexed on created_at DESC, category, screen_name.

## Environment Variables

Defined in `.env` (see `.env.example`):
- `VITE_OPENROUTER_API_KEY` — Required for AI categorization
- `VITE_MEDIA_PATH` — Path to local media folder (default `/media`)
- `VITE_DEFAULT_CATEGORIES` — Comma-separated default category list

## Tech Stack

React 18 + TypeScript + Vite + Tailwind CSS 3. Dark theme throughout. Icons via Lucide React. No backend, no SSR.

## Conventions

- Functional components with hooks (useState, useEffect, useRef)
- All DB operations are async — database initializes lazily on first use
- Console logging with prefixes (`[Database]`, `[FileSystem]`, `[Settings]`) for debugging
- Media files stored in `/media/` (gitignored), named `{screen_name}_{tweet_id}_{media_type}_{index}_{YYYYMMDD}.{ext}`
