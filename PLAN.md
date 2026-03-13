# YouTube Transcript Manager - Implementation Plan

## Overview
Local-first Chrome extension for fetching, saving, and managing YouTube transcripts using IndexedDB storage.

## Tech Stack
- **Extension Framework**: WXT with React 19
- **Styling**: Tailwind CSS + ShadCN UI
- **Database**: IndexedDB via Dexie
- **Tables**: TanStack Table
- **Virtualization**: TanStack Virtual
- **Forms**: React Hook Form + Zod
- **Icons**: lucide-react

---

## Phase 1: Foundation (Week 1)

### 1.1 Project Setup
- [ ] Initialize WXT project with React module
- [ ] Configure Tailwind CSS with ShadCN
- [ ] Set up TypeScript configuration
- [ ] Configure build scripts and development workflow
- [ ] Set up linting (ESLint) and formatting (Prettier)

### 1.2 Extension Entrypoints
- [ ] Create `entrypoints/background.ts` (service worker)
- [ ] Create `entrypoints/content.youtube.ts` (content script)
- [ ] Create `entrypoints/popup.html` + popup React component
- [ ] Create `entrypoints/options.html` (dashboard entry)
- [ ] Configure manifest permissions (storage, youtube.com/*)

### 1.3 Database Schema
- [ ] Set up Dexie with 7 stores:
  - `videos` - video metadata
  - `transcripts` - transcript records
  - `segments` - individual transcript segments
  - `categories` - user-defined categories
  - `tags` - tag definitions
  - `transcriptTags` - many-to-many junction
  - `settings` - app configuration
- [ ] Create indexes for all query patterns
- [ ] Implement migration manager
- [ ] Create repository modules for each store

### 1.4 Messaging System
- [ ] Define typed message contracts
- [ ] Implement content script ↔ background communication
- [ ] Implement popup ↔ background communication
- [ ] Message handlers for: GET_CURRENT_VIDEO_CONTEXT, FETCH_TRANSCRIPT, SAVE_TRANSCRIPT, OPEN_DASHBOARD

### 1.5 YouTube Detection
- [ ] Detect YouTube watch page navigation
- [ ] Extract video metadata (ID, URL, title, channel, thumbnail, publish date)
- [ ] Detect page language
- [ ] Handle SPA navigation (YouTube's dynamic loading)

**Phase 1 Acceptance Criteria:**
- Extension loads without errors
- Database initializes with all stores
- YouTube page detection working
- Messages flow between components

---

## Phase 2: Transcript Capture (Week 2)

### 2.1 Transcript Service
- [ ] Implement transcript availability check
- [ ] Fetch transcript from YouTube's internal API
- [ ] Support manual and auto-generated transcripts
- [ ] Detect available languages
- [ ] Normalize transcript structure (segments with timestamps)
- [ ] Calculate word count and segment count

### 2.2 Transcript Fetch Outcomes
- [ ] Handle success state
- [ ] Handle "not available" state
- [ ] Handle "disabled" state
- [ ] Handle "language unavailable" state
- [ ] Handle parsing/network errors

### 2.3 Save Flow
- [ ] Transaction: save video → transcript → segments
- [ ] Duplicate detection (videoId + languageCode)
- [ ] Conflict resolution UI (skip/overwrite/save as new)
- [ ] Preserve user metadata on re-fetch
- [ ] Update timestamps (createdAt, updatedAt)

### 2.4 Popup UI
- [ ] Display current video info (thumbnail, title, channel)
- [ ] Show transcript availability status
- [ ] Save button with loading state
- [ ] Quick category selector
- [ ] Open dashboard button
- [ ] Error messages for invalid states

### 2.5 Content Script Integration
- [ ] Optional: inject save button near video
- [ ] Visual indicator for saved transcripts
- [ ] Communication with popup via background

**Phase 2 Acceptance Criteria:**
- Can save transcript from any YouTube video
- Duplicate handling works correctly
- Popup shows accurate status
- All fetch states handled gracefully

---

## Phase 3: Management Console (Week 3-4)

### 3.1 Dashboard Layout
- [ ] Create dashboard shell with navigation
- [ ] Implement React Router routes:
  - `/` - Dashboard home
  - `/library` - Transcript list
  - `/transcript/:id` - Detail view
  - `/settings` - Configuration

### 3.2 Dashboard Home
- [ ] Stats cards (total, favorites, archived, failed)
- [ ] Recent transcripts list (last 5)
- [ ] Category distribution preview
- [ ] Failed items indicator
- [ ] Quick action shortcuts

### 3.3 Library View
- [ ] Search bar with debounced input
- [ ] Filter sidebar (category, status, language, channel, date range)
- [ ] Sort dropdown (newest, oldest, title, channel, length)
- [ ] Table/grid view toggle
- [ ] Columns: thumbnail, title, channel, category, tags, date, language, status, length
- [ ] Pagination or infinite scroll
- [ ] TanStack Table integration

### 3.4 Transcript Detail View
- [ ] Metadata header (title, channel, URL, dates)
- [ ] Segmented transcript with timestamps
- [ ] Click timestamp to seek video (optional)
- [ ] Copy full transcript button
- [ ] Copy selected text
- [ ] Export dropdown (TXT, JSON)

### 3.5 Categories System
- [ ] Create category modal
- [ ] Rename category
- [ ] Delete category (move to uncategorized)
- [ ] Color coding for categories
- [ ] Category selector in detail view
- [ ] "Uncategorized" fallback

### 3.6 Tags System
- [ ] Tag input with autocomplete
- [ ] Create new tags on-the-fly
- [ ] Display tags as chips
- [ ] Remove tags
- [ ] Tag cloud or list view
- [ ] Merge duplicate tags

### 3.7 Status Management
- [ ] Status selector (unread, in-review, reviewed, archived)
- [ ] Favorite toggle (star icon)
- [ ] Bulk status update
- [ ] Status indicators in list view

### 3.8 Search Implementation ✅
- [x] Full-text search across:
  - Video titles
  - Channel names
  - Transcript text
  - Tags
  - Categories
  - Notes
- [x] Search normalization (lowercase, whitespace)
- [x] Debounced search input

### 3.9 List Actions ✅
- [x] Open detail view
- [x] Edit metadata (favorite, archive, category)
- [x] Delete single transcript
- [x] Bulk selection (checkboxes)
- [x] Bulk actions: delete, change category, favorite, archive

**Phase 3 Acceptance Criteria:**
- Dashboard displays all stats correctly
- Can browse, search, and filter transcripts
- Categories and tags functional
- Detail view shows full transcript
- All CRUD operations working

---

## Phase 4: Polish & Advanced Features (Week 5)

### 4.1 Import/Export
- [ ] JSON export (all data)
- [ ] TXT export (single transcript)
- [ ] CSV export (metadata list)
- [ ] Import JSON with validation
- [ ] Import merge vs replace modes
- [ ] Import summary report
- [ ] Deduplication on import

### 4.2 Settings Page
- [ ] Default save behavior
- [ ] Default transcript language preference
- [ ] Theme mode (light/dark/system)
- [ ] Dashboard density (compact/comfortable)
- [ ] Category defaults
- [ ] Clear all data (with confirmation)
- [ ] Backup/export all data
- [ ] Import backup

### 4.3 Keyboard Shortcuts ✅ (Partial)
- [x] `/` to focus search
- [x] `Esc` to clear search
- [ ] `Enter` to open selected transcript
- [ ] Arrow keys for list navigation
- [ ] `Ctrl/Cmd + A` for bulk select all
- [ ] `Delete` key to remove selected

### 4.4 Empty States
- [ ] No saved transcripts
- [ ] No categories yet
- [ ] No search results
- [ ] Transcript unavailable
- [ ] Failed fetch
- [ ] No notes

### 4.5 Error Handling
- [ ] Not on YouTube page
- [ ] Transcript not available
- [ ] Language unavailable
- [ ] Parsing failed
- [ ] Duplicate transcript
- [ ] Import failed
- [ ] Export failed
- [ ] Storage quota exceeded
- [ ] Retry mechanisms

### 4.6 Accessibility
- [ ] Full keyboard navigation
- [ ] Semantic HTML structure
- [ ] ARIA labels on icon buttons
- [ ] Focus-visible states
- [ ] Color contrast compliance (WCAG 4.5:1)
- [ ] Screen reader announcements
- [ ] Transcript timestamps keyboard accessible

### 4.7 Performance Optimizations
- [ ] Virtualize long transcript lists
- [ ] Paginate or lazy-load detail segments
- [ ] Debounce search input
- [ ] Cache dashboard aggregate queries
- [ ] Index common filter fields
- [ ] Optimize re-renders with React.memo

### 4.8 User Notes ✅
- [x] Add/edit transcript notes
- [x] Display notes in detail view
- [x] Search within notes (via full-text search)

**Phase 4 Acceptance Criteria:**
- Import/export works reliably
- Keyboard navigation complete
- All empty states designed
- Error handling graceful
- Accessibility baseline met
- Smooth performance with 1000+ transcripts

---

## MVP Scope (Minimum Viable Product)

### Must Have:
1. ✅ Phase 1: Foundation
2. ✅ Phase 2: Transcript Capture
3. ✅ Phase 3: Management Console (core features only)
4. ⚠️ Phase 4: Basic export (JSON/TXT only)

### Excluded from MVP:
- Charts and visualizations
- Per-segment annotations/bookmarks
- Advanced import merge strategies
- Bulk selection shortcuts
- Markdown export
- Pinning transcripts
- Activity logging

---

## Data Model Summary

### Videos Store
```typescript
interface Video {
  videoId: string; // PK
  url: string;
  title: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt: Date;
  durationText: string;
  lastSeenAt: Date;
}
```

### Transcripts Store
```typescript
interface Transcript {
  transcriptId: string; // PK
  videoId: string; // FK
  languageCode: string;
  languageLabel: string;
  sourceType: 'manual' | 'auto-generated' | 'unknown';
  fullText: string;
  segmentCount: number;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
  lastOpenedAt: Date;
  status: 'unread' | 'in-review' | 'reviewed' | 'archived';
  favorite: boolean;
  archived: boolean;
  categoryId: string | null;
  notes: string;
  fetchState: 'success' | 'unavailable' | 'error';
  fetchErrorCode: string | null;
}
```

### Segments Store
```typescript
interface Segment {
  segmentId: string; // PK
  transcriptId: string; // FK
  sequence: number;
  startMs: number;
  durationMs: number;
  text: string;
}
```

---

## Success Metrics

### MVP Success:
- [ ] User can save transcript from YouTube
- [ ] Data persists in IndexedDB
- [ ] Dashboard lists all transcripts
- [ ] Search by title/channel/text works
- [ ] Categories and tags functional
- [ ] Can view full transcript
- [ ] Can delete and export data
- [ ] Works entirely offline

### v1 Success:
- [ ] Bulk actions work
- [ ] Import/export stable
- [ ] Robust filtering/sorting
- [ ] Clean duplicate/re-fetch flow
- [ ] Polished UX for 1,000+ transcripts
- [ ] Accessibility baseline met

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| YouTube DOM changes | Abstract DOM queries, use data attributes |
| Large library performance | Virtualization, pagination, indexing |
| Storage quota | Compression, export prompts, size warnings |
| Schema migrations | Version from day one, migration scripts |
| Transcript availability | Graceful degradation, clear error messages |

---

## Notes

- Keep permissions minimal (youtube.com/* only)
- No external API calls - truly local
- No analytics/telemetry by default
- Prioritize keyboard navigation
- Test with 1000+ transcripts early

---

*Generated from Features.md - Last updated: 2026-03-13*
