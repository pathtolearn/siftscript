Here’s an end-to-end requirements spec for your Chrome extension.

I’m treating the product as a **local-first YouTube transcript manager**:
it fetches transcript data for a YouTube video, stores everything in **IndexedDB**, and gives users a clean **management console + dashboard** for search, browse, categorize, and export. I am **not** including AI summarization, embeddings, or cloud sync.

A few stack constraints I’ve grounded this around:
WXT supports React via `@wxt-dev/module-react`, generates the extension manifest from config/entrypoints, and works cleanly with MV3-style extension structure. Chrome extension storage guidance also matters here: extension pages can use IndexedDB, but content scripts should not rely on page web storage, and MV3 background logic runs in an extension service worker lifecycle rather than as a permanent background page. React’s current docs are for React 19.x. ([WXT][1])

## 1. Product definition

### 1.1 Goal

Build a Chrome extension that lets a user:

* open any YouTube video
* fetch the available transcript
* save that transcript locally
* organize saved transcripts with categories/tags/status
* search and filter across all saved transcripts
* review transcript history from a dashboard

### 1.2 Non-goals

* no AI summaries
* no vector search
* no cloud backend
* no user accounts
* no collaboration
* no server-side processing
* no browser-wide scraping outside the YouTube context

## 2. Primary user stories

### 2.1 Capture

* As a user, I can save the transcript for the current YouTube video from the watch page.
* As a user, I can see whether a transcript is available before saving.
* As a user, I can refresh a saved transcript if the source changes.

### 2.2 Browse and manage

* As a user, I can view all saved transcripts in one console.
* As a user, I can open a transcript detail page with metadata and full text.
* As a user, I can categorize transcripts into folders or categories.
* As a user, I can tag transcripts with multiple tags.
* As a user, I can mark transcripts with status values like unread, reviewed, favorite, archived.

### 2.3 Search

* As a user, I can search by video title, channel name, transcript text, tags, category, and date saved.
* As a user, I can filter by language, transcript availability type, channel, category, tag, status, and saved date.
* As a user, I can sort by newest, oldest, title, channel, transcript length, and last opened.

### 2.4 Maintenance

* As a user, I can edit local metadata without changing source data.
* As a user, I can delete one transcript or bulk delete many.
* As a user, I can export selected transcripts.
* As a user, I can import previously exported local data.

## 3. Scope of the extension

## 3.1 Surfaces

You should build these extension surfaces:

1. **Content script on YouTube watch pages**

   * detects video page
   * extracts video metadata
   * triggers transcript fetch flow
   * optionally injects a small action button

2. **Background/service worker**

   * coordinates extension events
   * handles message passing
   * opens dashboard pages
   * manages alarms or lightweight maintenance tasks if needed

3. **Popup**

   * quick actions for current tab
   * save transcript
   * open dashboard
   * show save status

4. **Options page or full dashboard page**

   * main management console
   * transcript library
   * transcript detail page
   * categories/tags/settings/import-export

WXT is a strong fit for this structure because it supports distinct extension entrypoints and MV3 manifest generation cleanly. ([WXT][2])

## 4. Functional requirements

### 4.1 Transcript acquisition

The system must:

* detect a valid YouTube watch page
* extract at minimum:

  * video ID
  * video URL
  * video title
  * channel title
  * thumbnail URL
  * publish date if obtainable
  * detected page language if obtainable
* determine transcript availability
* fetch transcript segments when available
* normalize transcript into a structured local format

### 4.1.1 Transcript fetch outcomes

Support these result states:

* transcript fetched successfully
* transcript not available
* transcript disabled
* transcript requires a different selected language
* fetch failed due to parsing/network/page state issue

### 4.1.2 Transcript structure

Each saved transcript should store:

* transcript ID
* video ID
* transcript language code
* transcript language label
* transcript source type

  * manual
  * auto-generated
  * unknown
* segment list:

  * segment ID
  * start time
  * duration
  * text
  * sequence number
* flattened full text
* word count
* segment count
* created at
* updated at
* fetch version

### 4.1.3 Re-fetch rules

* User can manually re-fetch
* If the video ID already exists, system asks whether to:

  * skip
  * overwrite transcript content
  * save as another language/version
* Re-fetch should preserve user-created tags/categories/notes unless user explicitly chooses full overwrite

## 4.2 Library/dashboard

### 4.2.1 Transcript list view

Must show:

* video thumbnail
* title
* channel name
* category
* tags
* saved date
* language
* transcript status
* transcript length
* favorite indicator

Actions:

* open detail
* edit metadata
* delete
* favorite/unfavorite
* archive/unarchive
* bulk select

### 4.2.2 Detail view

Must show:

* title
* channel
* source URL
* metadata summary
* transcript text
* transcript segmented with timestamps
* tags and category
* user notes
* status
* created/updated timestamps

Actions:

* copy full transcript
* copy selected text
* export
* edit local metadata
* re-fetch transcript
* open video in YouTube

### 4.2.3 Dashboard overview

Must show:

* total saved transcripts
* transcripts by category
* transcripts by language
* recent saves
* favorites count
* archived count
* storage usage estimate
* failed fetch count

## 4.3 Categories, tags, and statuses

### 4.3.1 Categories

* user can create, rename, delete categories
* each transcript belongs to zero or one primary category
* deleting a category does not delete transcripts
* uncategorized must exist as fallback

### 4.3.2 Tags

* user can create freeform tags
* transcript can have many tags
* autocomplete existing tags
* merge duplicate tags
* bulk apply/remove tags

### 4.3.3 Statuses

Minimum statuses:

* unread
* in-review
* reviewed
* archived

Optional:

* favorite
* pinned

## 4.4 Search and filter

### 4.4.1 Search behavior

Global search should support:

* title search
* channel search
* transcript full-text search
* tag search
* category search
* note search

### 4.4.2 Filter options

* category
* tag
* status
* language
* channel
* source type
* saved date range
* updated date range
* transcript length range

### 4.4.3 Sort options

* newest saved
* oldest saved
* recently opened
* title A-Z
* title Z-A
* channel A-Z
* longest transcript
* shortest transcript

### 4.4.4 Search UX

* debounced input
* highlighted matches
* empty state
* no-results recovery suggestions
* saved filter presets optional for v2

## 4.5 Notes and annotations

Each transcript may support:

* one freeform user note
* optional per-transcript summary field written manually by user
* bookmark timestamps
* highlighted segments

For MVP, I’d keep this to:

* one transcript note
* optional pinned segments

## 4.6 Import/export

Required export formats:

* JSON export of all application data
* TXT export of full transcript
* CSV export of transcript metadata list

Optional:

* Markdown export per transcript

Import rules:

* validate schema
* deduplicate by video ID + language
* support merge vs replace
* show import summary

## 4.7 Settings

Settings page should support:

* default save behavior
* default transcript language preference
* theme mode
* export preferences
* category defaults
* dashboard density
* clear all local data
* backup/export all data
* import backup

## 5. Data model

Use IndexedDB as the main persistence layer. Chrome’s extension guidance distinguishes extension storage APIs from web storage and notes that IndexedDB is appropriate among extension persistence options; importantly, content scripts should not treat page web storage as extension-owned data. ([Chrome for Developers][3])

Recommended stores:

### 5.1 `videos`

Fields:

* `videoId` PK
* `url`
* `title`
* `channelId`
* `channelTitle`
* `thumbnailUrl`
* `publishedAt`
* `durationText`
* `lastSeenAt`

Indexes:

* `title`
* `channelTitle`
* `publishedAt`
* `lastSeenAt`

### 5.2 `transcripts`

Fields:

* `transcriptId` PK
* `videoId` FK
* `languageCode`
* `languageLabel`
* `sourceType`
* `fullText`
* `segmentCount`
* `wordCount`
* `createdAt`
* `updatedAt`
* `lastOpenedAt`
* `status`
* `favorite`
* `archived`
* `categoryId`
* `notes`
* `fetchState`
* `fetchErrorCode`

Indexes:

* `videoId`
* `languageCode`
* `status`
* `favorite`
* `archived`
* `categoryId`
* `createdAt`
* `updatedAt`
* `lastOpenedAt`

### 5.3 `segments`

Fields:

* `segmentId` PK
* `transcriptId` FK
* `sequence`
* `startMs`
* `durationMs`
* `text`

Indexes:

* `transcriptId`
* `sequence`
* compound: `[transcriptId + sequence]`

### 5.4 `categories`

Fields:

* `categoryId` PK
* `name`
* `colorToken`
* `createdAt`
* `updatedAt`

Indexes:

* `name`

### 5.5 `tags`

Fields:

* `tagId` PK
* `name`
* `createdAt`
* `updatedAt`

Indexes:

* `name`

### 5.6 `transcriptTags`

Fields:

* `id` PK
* `transcriptId`
* `tagId`

Indexes:

* `transcriptId`
* `tagId`
* compound: `[transcriptId + tagId]`

### 5.7 `settings`

Fields:

* `key`
* `value`

### 5.8 `jobs` or `activityLog`

Optional but useful:

* `jobId`
* `type`
* `status`
* `startedAt`
* `finishedAt`
* `message`

This helps debugging failed fetches.

## 6. Architecture requirements

## 6.1 Recommended architecture

Use a simple layered design:

### UI layer

* React 19
* Tailwind CSS
* ShadCN components
* React Router for dashboard navigation
* TanStack Table for list management
* TanStack Virtual for long lists
* React Hook Form + Zod for forms

### Extension runtime layer

* WXT entrypoints
* content script
* popup
* options/dashboard page
* background/service worker

### Domain layer

Plain TS modules:

* transcript service
* search service
* category service
* export service
* import service

### Persistence layer

* IndexedDB wrapper
* repository modules per store
* schema migration manager

## 6.2 Message passing

Define typed message contracts between:

* content script ↔ background
* popup ↔ background
* dashboard ↔ background when needed

Message examples:

* `GET_CURRENT_VIDEO_CONTEXT`
* `FETCH_TRANSCRIPT`
* `SAVE_TRANSCRIPT`
* `REFETCH_TRANSCRIPT`
* `OPEN_DASHBOARD`
* `EXPORT_DATA`

## 6.3 Manifest and permissions

Keep permissions minimal because Chrome warns users about some permissions, and extension permissions must be explicitly declared. ([Chrome for Developers][4])

Likely minimum:

* `storage` only if you use `chrome.storage` for lightweight prefs
* `tabs` only if truly needed
* host permissions for YouTube pages:

  * `https://www.youtube.com/*`

Try to avoid:

* broad `<all_urls>`
* unnecessary scripting permissions
* anything that creates scary install warnings

## 7. UX requirements

## 7.1 Design goals

* simple
* fast
* local-first
* low-friction
* readable transcript experience
* keyboard-friendly

## 7.2 Core screens

### Popup

Sections:

* current video summary
* transcript availability status
* save button
* quick category selector
* open dashboard button

### Dashboard home

Sections:

* top stats
* recent transcripts
* category distribution
* failed items
* shortcuts

### Transcript library

Sections:

* search bar
* filter sidebar or top filter bar
* sortable table/grid
* bulk actions

### Transcript detail

Sections:

* metadata header
* transcript viewer
* notes/tags/category editor
* actions panel

### Settings

Sections:

* storage
* defaults
* import/export
* appearance

## 7.3 Empty states

Need designed empty states for:

* no saved transcripts
* no categories yet
* no search results
* transcript unavailable
* failed fetch
* no notes

## 7.4 Keyboard support

Must support:

* `/` to focus search
* `Enter` open selected transcript
* `Esc` close dialogs
* arrows in list navigation
* bulk selection shortcuts optional

## 8. Performance requirements

You mentioned search and dashboard management, so performance matters more in the library than in the capture flow.

### 8.1 Startup

* popup initial render under 500 ms on warm path
* dashboard first meaningful render under 1.5 s for medium data sets
* avoid blocking UI on full transcript hydration

### 8.2 Data volume targets

Define support targets clearly:

#### MVP

* 1,000 saved transcripts
* 5–10 million characters total text
* search across all saved items

#### v1 stable

* 10,000 transcripts
* smooth filtering and sorting
* lazy detail loading

### 8.3 Strategies

* virtualize long lists
* paginate or incremental render transcript detail
* store denormalized `fullText` for search
* fetch segments on detail open, not always on list screen
* precompute searchable fields
* debounce search
* index common filter fields in IndexedDB
* keep dashboard aggregate queries cached

## 9. Search design requirements

Since there is no AI, search quality depends on indexing and query handling.

### 9.1 Search modes

Implement:

* simple keyword search across normalized text fields
* exact phrase search optional
* field-specific search optional in v2

### 9.2 Search normalization

* lowercase normalization
* whitespace normalization
* punctuation-insensitive matching
* diacritic handling where feasible

### 9.3 Search ranking

Rank by:

1. title match
2. tag/category match
3. channel match
4. transcript text match
5. recency boost

### 9.4 Search result snippets

* show matched excerpt from transcript
* highlight terms
* show timestamp of first matched segment if possible

## 10. Error handling requirements

### 10.1 User-visible errors

Need clear messages for:

* not on a YouTube watch page
* transcript not available
* language unavailable
* parsing failed
* duplicate transcript
* import failed
* export failed
* storage quota/DB corruption issues

### 10.2 Recovery

* retry fetch
* open transcript manually
* export backup before destructive operations
* reset local DB only from settings with confirmation

## 11. Security and privacy requirements

### 11.1 Privacy principles

* all transcript data stored locally
* no server transmission
* no analytics by default
* no third-party tracking
* no hidden collection of browsing history

### 11.2 Permission minimization

* only request YouTube host permissions
* request optional permissions only when feature requires them

### 11.3 Sensitive content handling

* transcripts may contain personal/sensitive data from videos
* provide “delete permanently” action
* document local storage behavior clearly in settings/about page

## 12. Data lifecycle requirements

### 12.1 Save

* on save, write video metadata first
* then write transcript record
* then write segments
* complete transaction or roll back

### 12.2 Update

* preserve local user metadata on content refresh
* mark `updatedAt`
* optionally version old transcript content in v2

### 12.3 Delete

Support:

* soft archive
* permanent delete transcript only
* permanent delete transcript + related segments
* clear all data

## 13. Accessibility requirements

* full keyboard navigation
* semantic HTML
* ARIA labels on icon buttons
* focus-visible states
* sufficient color contrast
* screen-reader friendly status messaging
* transcript timestamps readable and actionable

## 14. Analytics/telemetry

Given your “no AI, simple local product” direction:

### MVP recommendation

* no remote analytics

### Optional local-only diagnostics

* local event counters for debugging:

  * save success count
  * fetch failure count
  * import/export count

User can clear diagnostics anytime.

## 15. Recommended folder structure

```txt
entrypoints/
  background.ts
  content.youtube.ts
  popup.html
  options.html

components/
  ui/
  transcript/
  dashboard/
  filters/

features/
  transcripts/
  categories/
  tags/
  search/
  settings/
  import-export/

lib/
  db/
    schema.ts
    migrations.ts
    repositories/
  messaging/
  youtube/
    parseVideoContext.ts
    fetchTranscript.ts
    normalizeTranscript.ts
  utils/

routes/
  dashboard.tsx
  library.tsx
  transcript-detail.tsx
  settings.tsx

stores/
  useTranscriptStore.ts
  useFilterStore.ts
  useSettingsStore.ts

types/
```

## 16. Recommended implementation breakdown

## Phase 1: foundation

* WXT project setup
* React 19 + Tailwind + ShadCN wiring
* extension entrypoints
* typed message bus
* IndexedDB schema + migrations
* YouTube page detection

## Phase 2: transcript capture

* parse current video metadata
* transcript availability detection
* transcript fetch and normalization
* save flow
* duplicate handling

## Phase 3: management console

* transcript library
* detail page
* search/filter/sort
* categories/tags/status

## Phase 4: polish

* bulk actions
* import/export
* dashboard widgets
* keyboard shortcuts
* accessibility
* error states
* settings

## 17. Acceptance criteria

### MVP is done when:

* user can save transcript from a YouTube watch page
* saved transcripts persist in IndexedDB
* dashboard lists all saved transcripts
* user can search by title/channel/transcript text
* user can categorize and tag transcripts
* user can open transcript detail and read full text
* user can delete and export data
* product works without any backend

### v1 is done when:

* bulk actions work
* import/export is stable
* filters and sorting are robust
* duplicate/re-fetch flow is clean
* UX is polished for 1,000+ transcripts
* accessibility baseline is met

## 18. Suggested technical decisions

These are not mandatory, but they fit your stack well:

* **State/query**: Zustand or TanStack Query-lite patterns
* **DB wrapper**: Dexie for IndexedDB ergonomics
* **Tables**: TanStack Table
* **Virtualization**: TanStack Virtual
* **Forms**: React Hook Form + Zod
* **Date handling**: date-fns
* **Icons**: lucide-react

## 19. Risks and edge cases

Main product risks:

* transcript availability differs across videos/languages
* YouTube page structure can change
* auto-generated vs manual transcript detection may be inconsistent
* very large transcript libraries can make client-side search slow if not indexed carefully
* duplicate language/version handling can get messy without explicit rules

Main technical risks:

* doing too much in the content script
* coupling UI directly to YouTube DOM
* not versioning IndexedDB schema from day one
* loading full transcript blobs into list screens

## 20. My recommendation for your MVP cut

Build this first:

* save transcript from current video
* popup with save action
* dashboard with list view
* detail page
* categories + tags
* full-text search
* JSON/TXT export
* local settings
* no charts initially
* no advanced per-segment annotations initially

That gives you a real usable product quickly without bloating the first version.

I can turn this next into a **PRD + engineering spec + folder-by-folder implementation plan** in a format you can paste straight into Cursor or Lovable.

[1]: https://wxt.dev/guide/essentials/frontend-frameworks?utm_source=chatgpt.com "Frontend Frameworks"
[2]: https://wxt.dev/guide/essentials/config/manifest?utm_source=chatgpt.com "Manifest"
[3]: https://developer.chrome.com/docs/extensions/reference/api/storage?utm_source=chatgpt.com "chrome.storage | API - Chrome for Developers"
[4]: https://developer.chrome.com/docs/extensions/reference/permissions-list?utm_source=chatgpt.com "Permissions - Chrome for Developers"
