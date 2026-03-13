# YouTube Transcript Manager

A Chrome extension to save and manage YouTube transcripts locally using IndexedDB.

## Features

- **Save Transcripts**: One-click transcript saving from any YouTube video
- **Local Storage**: All data stored in IndexedDB - no cloud required
- **Duplicate Detection**: Automatically detects and handles duplicate transcripts
- **Categories & Tags**: Organize transcripts with custom categories and tags
- **Dashboard**: View stats, recent transcripts, and manage your library
- **Search & Filter**: Find transcripts quickly (Phase 3)
- **Export**: Export transcripts in multiple formats (Phase 4)

## Installation

### Development Mode

1. Build the extension:
   ```bash
   npm run build
   ```

2. Load in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `.output/chrome-mv3` folder

3. Navigate to any YouTube video and click the extension icon

### Production Build

```bash
npm run build
```

The extension will be built in `.output/chrome-mv3/`.

## Development

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Build for Firefox
npm run build:firefox

# Create zip package
npm run zip
```

## Project Structure

```
project/
├── entrypoints/           # Extension entry points
│   ├── background.ts      # Service worker
│   ├── content.ts         # YouTube content script
│   ├── popup/             # Extension popup
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.html
│   └── options.html       # Dashboard/options page
├── lib/
│   ├── db/                # Database layer
│   │   ├── schema.ts      # IndexedDB schema
│   │   └── repositories/  # Data access layer
│   ├── messaging/         # Message passing
│   │   ├── messaging.ts
│   │   └── types.ts
│   ├── youtube/           # YouTube integration
│   │   ├── pageDetector.ts
│   │   └── fetchTranscript.ts
│   └── utils/
├── types/                 # TypeScript types
├── assets/                # CSS and assets
└── wxt.config.ts         # WXT configuration
```

## Architecture

### Data Flow

1. **Popup** requests video context from **Content Script**
2. **Content Script** extracts metadata from YouTube page
3. **Content Script** fetches transcript using YouTube's internal API
4. **Background Script** saves data to IndexedDB
5. **Dashboard** (Options Page) reads from IndexedDB to display

### Database Schema

- **videos**: Video metadata (title, channel, thumbnail, etc.)
- **transcripts**: Transcript records with metadata
- **segments**: Individual transcript segments with timestamps
- **categories**: User-defined categories
- **tags**: Tag definitions
- **transcriptTags**: Many-to-many relationship
- **settings**: App configuration

## Usage

1. Navigate to any YouTube video
2. Click the extension icon in the toolbar
3. Click "Save Transcript" to save
4. Choose a category (optional)
5. Open Dashboard to view saved transcripts

## Tech Stack

- **WXT**: Extension framework
- **React 19**: UI library
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **Dexie**: IndexedDB wrapper
- **Lucide React**: Icons

## Roadmap

### Phase 1: Foundation ✅
- Project setup
- Database schema
- Extension architecture
- Basic popup and dashboard

### Phase 2: Transcript Capture ✅
- YouTube page detection
- Transcript fetching
- Duplicate detection
- Category selection

### Phase 3: Management Console (Next)
- Full library view
- Search and filters
- Transcript detail page
- Bulk actions

### Phase 4: Polish
- Import/Export
- Settings page
- Keyboard shortcuts
- Accessibility improvements

## License

MIT
