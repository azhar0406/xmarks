# Xmarks - X Bookmark Dashboard

A local-first, dark-themed dashboard to organise, browse, and rediscover your X (Twitter) bookmarks. It gives you the feel of exploring x.com in dark mode — with AI-powered auto-categorisation, full-text search, random bookmark surfacing, and one-click data management.

Built as a hobby project to actually *do something* with all those bookmarked posts.

## Features

- **Import & Browse** — Import bookmarks exported from X as JSON/CSV and browse them in a familiar tweet-card layout with media previews (images & videos)
- **AI Auto-Categorisation** — Automatically categorise bookmarks using AI via [OpenRouter](https://openrouter.ai/) (uses Grok model)
- **Full-Text Search** — Search across tweet text, author names, and handles with live suggestions
- **Category Management** — Create, view, and delete custom categories; filter bookmarks by category
- **Random Picks** — Right sidebar surfaces random bookmarks to nudge you into revisiting old saves
- **Local SQLite Database** — All data lives in your browser via sql.js + IndexedDB. No backend, no cloud
- **Database Export/Import** — Export your entire database as a `.db` file for backup or portability
- **One-Click Purge** — Wipe all data when you want a fresh start
- **Operation Logging** — Built-in log console for debugging imports and AI operations

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- sql.js (in-browser SQLite via WASM)
- IndexedDB for persistence
- OpenRouter SDK for AI categorisation
- Lucide React icons

## Prerequisites

- Node.js (v18+)
- npm
- An [OpenRouter](https://openrouter.ai/) API key (for AI categorisation feature)
- [Tampermonkey](https://www.tampermonkey.net/) browser extension
- [Twitter Web Exporter](https://github.com/prinsss/twitter-web-exporter) userscript

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/azhar0406/xmarks.git
cd xmarks
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example env file and add your OpenRouter API key:

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_OPENROUTER_API_KEY=sk-or-v1-your-openrouter-api-key-here
VITE_MEDIA_PATH=/media
VITE_DEFAULT_CATEGORIES=AI/ML,React Native,Devops,Solidity
```

| Variable | Description |
|---|---|
| `VITE_OPENROUTER_API_KEY` | Your OpenRouter API key (get one at [openrouter.ai/keys](https://openrouter.ai/keys)) |
| `VITE_MEDIA_PATH` | Path to the local media folder (default: `/media`) |
| `VITE_DEFAULT_CATEGORIES` | Comma-separated list of default categories seeded on first launch |

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Exporting Bookmarks from X

This project uses [Twitter Web Exporter](https://github.com/prinsss/twitter-web-exporter) with Tampermonkey to export bookmarks and associated media from X.

### Setup

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Install the [Twitter Web Exporter](https://github.com/prinsss/twitter-web-exporter) userscript

### Export Steps (Read Carefully)

> **Important:** Follow these steps exactly to avoid missing bookmarks due to X's caching behaviour.

1. Open [x.com/i/bookmarks](https://x.com/i/bookmarks) in your browser
2. **Scroll all the way down** until you reach the very bottom of your bookmarks list
3. **Scroll back up to the top** (or press `Home` / `Page Up` repeatedly) — this forces X to load any bookmarks that may have been skipped due to caching issues
4. Repeat steps 2-3 if you have a very large number of bookmarks to ensure everything is loaded
5. **Only after all bookmarks are loaded**, use Twitter Web Exporter to start the export
6. Export the bookmark data as **JSON** format
7. Also export the **associated media files** (images, videos, GIFs)

> **Why the scroll dance?** X.com sometimes doesn't load all bookmarks in a single pass due to its internal caching and lazy-loading. Scrolling to the bottom and back forces the browser to fetch every bookmark. Skipping this step may result in missing bookmarks in your export.

### Media Files Setup

After exporting, extract/copy all media files into the `media/` folder at the project root:

```
xmarks/
  media/
    username_tweetid_photo_1_20230101.jpg
    username_tweetid_video_1_20230101.mp4
    ...
  src/
  ...
```

The system automatically maps media files to their associated bookmarks based on the filename pattern. No manual linking required.

## Importing into Xmarks

1. Start the dev server (`npm run dev`)
2. Go to **Settings** (gear icon in sidebar)
3. Under **Import**, upload your exported JSON/CSV file
4. Optionally enable **AI Categorisation** during import to auto-categorise bookmarks
5. Your bookmarks will appear on the Home page

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |

## Project Structure

```
xmarks/
├── media/                  # Exported media files (gitignored contents)
├── src/
│   ├── components/
│   │   ├── BookmarkCard.tsx   # Tweet-style bookmark card
│   │   ├── LogConsole.tsx     # Debug log viewer
│   │   ├── RightSidebar.tsx   # Random picks panel
│   │   └── Sidebar.tsx        # Navigation & categories
│   ├── lib/
│   │   ├── database.ts        # SQLite database layer
│   │   └── fileSystem.ts      # IndexedDB persistence
│   ├── pages/
│   │   ├── Home.tsx           # Feed with infinite scroll
│   │   ├── Search.tsx         # Full-text search
│   │   ├── Settings.tsx       # Import, export, AI, categories
│   │   └── CategoryView.tsx   # Filtered category view
│   ├── App.tsx                # App shell & routing
│   ├── main.tsx               # Entry point
│   └── index.css              # Tailwind + custom styles
├── .env.example               # Environment template
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## License

MIT
