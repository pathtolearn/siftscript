# YouTube Shorts & Playlist Detection — Implementation Plan

## Overview

The extension currently only detects regular YouTube watch pages (`/watch?v=VIDEO_ID`). This plan covers adding full support for:

1. **YouTube Shorts** — `/shorts/VIDEO_ID` URLs
2. **YouTube Playlists** — `/playlist?list=LIST_ID` URLs (and watch pages that are part of a playlist)

---

## Current State

| Feature | File | Limitation |
|---|---|---|
| Page detection | `lib/youtube/pageDetector.ts:3-7` | Only checks `pathname === '/watch'` with `?v=` param |
| Video context extraction | `lib/youtube/pageDetector.ts:14-58` | DOM selectors target `ytd-watch-metadata` — not present on Shorts or Playlist pages |
| Transcript fetch | `lib/youtube/fetchTranscript.ts:74-139` | Works by video ID — no Shorts/Playlist awareness |
| Popup UI | `entrypoints/popup/App.tsx:172-194` | Shows "No YouTube Video Detected" for any non-watch page |

---

## Part 1: YouTube Shorts

### Background

- **URL format:** `https://www.youtube.com/shorts/dQw4w9WgXcQ`
- Video ID is the path segment after `/shorts/`, not a query param
- The Shorts player uses a completely different DOM structure (`ytd-reel-video-renderer`, `ytd-shorts`) compared to the standard watch page (`ytd-watch-metadata`)
- Transcripts exist for Shorts with auto-captions — the same InnerTube API and caption track endpoints work with the video ID

### 1.1 — Extend page detection (`lib/youtube/pageDetector.ts`)

**Add `isYouTubeShortsPage()`:**

```typescript
export function isYouTubeShortsPage(): boolean {
  return (
    window.location.hostname === 'www.youtube.com' &&
    window.location.pathname.startsWith('/shorts/') &&
    window.location.pathname.split('/').length >= 3
  );
}
```

**Add `getVideoIdFromShortsUrl()`:**

```typescript
export function getVideoIdFromShortsUrl(): string | null {
  const parts = window.location.pathname.split('/'); // ['', 'shorts', 'VIDEO_ID']
  return parts[2] ?? null;
}
```

**Update `extractVideoContext()` to branch on Shorts:**

The function currently bails out if `!isYouTubeWatchPage()`. Change the guard to:

```typescript
const isShortsPage = isYouTubeShortsPage();
const isWatchPage = isYouTubeWatchPage();
if (!isWatchPage && !isShortsPage) return null;
```

Then extract the video ID differently for Shorts:

```typescript
const videoId = isWatchPage
  ? new URLSearchParams(window.location.search).get('v')
  : getVideoIdFromShortsUrl();
```

**Shorts-specific DOM selectors:**

The Shorts player lazy-loads content. Use the following selector strategy (fall back in order):

| Field | Shorts selector | Fallback |
|---|---|---|
| Title | `ytd-reel-player-overlay-renderer h2 span` | `[aria-label*="shorts" i]` on the video element |
| Channel name | `ytd-channel-name a` (same as watch) | `#channel-name a` |
| Channel ID | Parse from channel anchor `href` (same logic) | — |
| Duration | Not shown in Shorts UI; set `"Shorts"` as placeholder | — |
| Publish date | Not available in DOM; leave `null` | — |
| Thumbnail | Same construction: `https://img.youtube.com/vi/{videoId}/mqdefault.jpg` | — |

**Updated `waitForVideoMetadata()` for Shorts:**

The current polling checks for `h1.ytd-watch-metadata`. For Shorts, also check `ytd-reel-player-overlay-renderer h2`:

```typescript
const isReady = isShortsPage
  ? !!document.querySelector('ytd-reel-player-overlay-renderer h2 span')?.textContent?.trim()
  : title !== 'Unknown Title';
```

### 1.2 — Transcript availability check for Shorts (`lib/youtube/fetchTranscript.ts`)

Shorts do not have the in-page transcript panel button. Skip Method 1 (panel) for Shorts and go directly to Method 2 (page HTML) then Method 3 (InnerTube API).

Add a `pageType` parameter to `fetchTranscript()`:

```typescript
export async function fetchTranscript(
  videoId: string,
  preferredLanguage?: string,
  pageType: 'watch' | 'shorts' | 'playlist-item' = 'watch'
): Promise<TranscriptResult>
```

In the method waterfall:

```typescript
const methods = pageType === 'shorts'
  ? [fetchFromPageHtml, fetchFromInnerTube]   // skip panel method
  : [fetchFromTranscriptPanel, fetchFromPageHtml, fetchFromInnerTube];
```

`checkTranscriptAvailability()` — for Shorts, skip the DOM button check and make a lightweight InnerTube player request to confirm caption tracks exist:

```typescript
if (isYouTubeShortsPage()) {
  const videoId = getVideoIdFromShortsUrl();
  if (!videoId) return { available: false };
  return await checkTranscriptAvailabilityViaApi(videoId);
}
```

Add `checkTranscriptAvailabilityViaApi(videoId)` that calls the InnerTube `/player` endpoint and checks `captions.playerCaptionsTracklistRenderer.captionTracks.length > 0`.

### 1.3 — Page change listener updates (`lib/youtube/pageDetector.ts`)

The existing `setupPageChangeListener()` listens on `yt-navigate-finish` and URL changes. Shorts navigation fires the same events, so the listener will fire correctly. However, the callback currently calls `isYouTubeWatchPage()` to decide whether to notify — update to:

```typescript
const isRelevantPage = isYouTubeWatchPage() || isYouTubeShortsPage();
if (isRelevantPage) { /* notify */ }
```

### 1.4 — Popup UI updates (`entrypoints/popup/App.tsx`)

- Add `pageType: 'watch' | 'shorts' | 'playlist'` field to `VideoContext`
- Display a `Shorts` badge next to the video title when `pageType === 'shorts'`
- The rest of the save/fetch/display flow is identical to watch pages — no other UI changes needed

### 1.5 — VideoContext type (`lib/types/index.ts` or `types/index.ts`)

Add `pageType` field:

```typescript
interface VideoContext {
  // ... existing fields ...
  pageType: 'watch' | 'shorts' | 'playlist-item';
}
```

---

## Part 2: YouTube Playlists

### Background

- **Playlist page URL:** `https://www.youtube.com/playlist?list=PLxxxxxx`
- **Watch-within-playlist URL:** `https://www.youtube.com/watch?v=VIDEO_ID&list=PLxxxxxx&index=3`
- Playlist pages list all videos but don't play one directly
- For the watch-in-playlist case the extension already works (it's a watch page) — the gap is detecting the playlist context and offering bulk actions
- For the standalone playlist page, there is no single video to transcribe — the feature is: show all videos in the playlist and let the user bulk-save transcripts

### 2.1 — Detection (`lib/youtube/pageDetector.ts`)

**Add `isYouTubePlaylistPage()`:**

```typescript
export function isYouTubePlaylistPage(): boolean {
  return (
    window.location.hostname === 'www.youtube.com' &&
    window.location.pathname === '/playlist' &&
    new URLSearchParams(window.location.search).has('list')
  );
}

export function getPlaylistIdFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('list');
}
```

**Add `isWatchWithinPlaylist()`:**

```typescript
export function isWatchWithinPlaylist(): boolean {
  return (
    isYouTubeWatchPage() &&
    new URLSearchParams(window.location.search).has('list')
  );
}
```

### 2.2 — Playlist metadata extraction

**Add `extractPlaylistContext()` in `lib/youtube/pageDetector.ts`:**

Extracts the playlist title, channel, and the list of video items currently rendered in the DOM.

```typescript
export interface PlaylistVideoItem {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  durationText: string;
  index: number;
}

export interface PlaylistContext {
  playlistId: string;
  title: string;
  channelTitle: string;
  totalVideos: number;
  videos: PlaylistVideoItem[];
  pageType: 'playlist';
}

export function extractPlaylistContext(): PlaylistContext | null {
  if (!isYouTubePlaylistPage()) return null;

  const playlistId = getPlaylistIdFromUrl();
  if (!playlistId) return null;

  // Title
  const title =
    document.querySelector('yt-formatted-string.ytd-playlist-header-renderer')
      ?.textContent?.trim() ?? 'Unknown Playlist';

  // Channel
  const channelTitle =
    document.querySelector('ytd-playlist-header-renderer .ytd-channel-name a')
      ?.textContent?.trim() ?? '';

  // Total video count
  const countText =
    document.querySelector('.metadata-stats yt-formatted-string')
      ?.textContent?.trim() ?? '';
  const totalVideos = parseInt(countText.replace(/\D/g, ''), 10) || 0;

  // Individual video rows — ytd-playlist-video-renderer
  const rows = document.querySelectorAll('ytd-playlist-video-renderer');
  const videos: PlaylistVideoItem[] = [];

  rows.forEach((row, i) => {
    const anchor = row.querySelector('a#video-title') as HTMLAnchorElement | null;
    if (!anchor) return;

    const href = anchor.href ?? '';
    const videoId = new URLSearchParams(new URL(href).search).get('v');
    if (!videoId) return;

    videos.push({
      videoId,
      title: anchor.textContent?.trim() ?? '',
      channelTitle:
        row.querySelector('ytd-channel-name a')?.textContent?.trim() ?? '',
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      durationText:
        row.querySelector('.ytd-thumbnail-overlay-time-status-renderer span')
          ?.textContent?.trim() ?? '',
      index: i + 1,
    });
  });

  return { playlistId, title, channelTitle, totalVideos, videos, pageType: 'playlist' };
}
```

> **Note on lazy-loading:** YouTube playlist pages use virtual scrolling — only visible rows are in the DOM. The initial extraction captures what's loaded. A scroll-and-collect strategy (see 2.6) is needed for full playlists.

### 2.3 — Message types (`lib/messaging/types.ts`)

Add new message types:

```typescript
GET_PLAYLIST_CONTEXT: {
  request: {}
  response: { context: PlaylistContext | null }
}

FETCH_PLAYLIST_TRANSCRIPTS: {
  request: {
    videoIds: string[];
    preferredLanguage?: string;
    playlistId: string;
  }
  response: {
    results: Array<{
      videoId: string;
      status: 'success' | 'error' | 'no-transcript';
      transcriptId?: string;
      error?: string;
    }>
  }
}
```

### 2.4 — Content script handler (`entrypoints/content.ts`)

Add handler for `GET_PLAYLIST_CONTEXT`:

```typescript
messaging.onMessage('GET_PLAYLIST_CONTEXT', async () => {
  if (!isYouTubePlaylistPage()) return { context: null };
  await waitForPlaylistMetadata(); // new polling helper
  const context = extractPlaylistContext();
  return { context };
});
```

Add handler for `FETCH_PLAYLIST_TRANSCRIPTS`:

```typescript
messaging.onMessage('FETCH_PLAYLIST_TRANSCRIPTS', async ({ data }) => {
  const results = [];
  for (const videoId of data.videoIds) {
    try {
      const transcript = await fetchTranscript(videoId, data.preferredLanguage, 'playlist-item');
      // save via existing save logic
      const saved = await saveTranscript({ videoId, transcript, playlistId: data.playlistId });
      results.push({ videoId, status: 'success', transcriptId: saved.transcriptId });
    } catch (err) {
      results.push({
        videoId,
        status: err.message.includes('no transcript') ? 'no-transcript' : 'error',
        error: String(err),
      });
    }
  }
  return { results };
});
```

### 2.5 — Popup UI: Playlist mode (`entrypoints/popup/App.tsx`)

When on a playlist page:

1. Show playlist title and video count
2. Show a scrollable list of playlist videos with checkboxes (all checked by default)
3. Show a "Save Selected Transcripts" button with a progress indicator
4. After completion, show a summary: `X saved, Y skipped (no transcript), Z errors`

**New state:**

```typescript
const [playlistContext, setPlaylistContext] = useState<PlaylistContext | null>(null);
const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
const [bulkProgress, setBulkProgress] = useState<{
  total: number; done: number; errors: number;
} | null>(null);
```

**Detection flow on mount:**

```typescript
// After checking for video context:
const playlistRes = await messaging.sendMessage('GET_PLAYLIST_CONTEXT', {});
if (playlistRes.context) {
  setPlaylistContext(playlistRes.context);
  setSelectedVideoIds(new Set(playlistRes.context.videos.map(v => v.videoId)));
}
```

**UI component: `PlaylistView`** (new file `components/playlist/PlaylistView.tsx`):

```
┌─────────────────────────────────────┐
│  📋 My Playlist (42 videos)         │
│  by Channel Name                    │
├─────────────────────────────────────┤
│  ☑ 1. Video Title One        3:42   │
│  ☑ 2. Video Title Two        8:15   │
│  ☑ 3. Video Title Three      12:01  │
│  ... (scrollable)                   │
├─────────────────────────────────────┤
│  [Select All] [Deselect All]        │
│  [Save 42 Transcripts]              │
│                                     │
│  Progress: ████████░░ 32/42         │
└─────────────────────────────────────┘
```

### 2.6 — Scroll-and-collect for large playlists

YouTube only renders ~30 rows at a time. For full playlist scraping, add a utility in `lib/youtube/playlistScraper.ts`:

```typescript
export async function scrollAndCollectAllVideos(
  onProgress?: (count: number) => void
): Promise<PlaylistVideoItem[]> {
  const collected = new Map<string, PlaylistVideoItem>();
  const MAX_SCROLLS = 200; // up to ~6000 videos
  
  for (let i = 0; i < MAX_SCROLLS; i++) {
    // Collect currently visible rows
    const rows = document.querySelectorAll('ytd-playlist-video-renderer');
    let addedThisPass = 0;
    rows.forEach((row, idx) => {
      const item = parsePlaylistRow(row, collected.size + addedThisPass);
      if (item && !collected.has(item.videoId)) {
        collected.set(item.videoId, item);
        addedThisPass++;
      }
    });

    onProgress?.(collected.size);

    // Check if we've hit the end (spinner gone, no new rows)
    const spinner = document.querySelector('ytd-playlist-video-list-renderer ytd-continuation-item-renderer');
    if (!spinner && addedThisPass === 0) break;

    // Scroll to bottom to trigger next batch
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise(r => setTimeout(r, 800));
  }

  return Array.from(collected.values());
}
```

This function runs in the content script context (not in the popup) so it has DOM access.

Add `SCROLL_AND_COLLECT_PLAYLIST` message type and handler so the popup can trigger this and receive progress updates.

### 2.7 — Watch-within-playlist banner

When the user is on a watch page that has a `&list=` parameter, show a non-intrusive banner in the popup:

```
┌─────────────────────────────────────┐
│  Part of playlist: "My Playlist"   │
│  [Save this transcript] [Save all] │
└─────────────────────────────────────┘
```

"Save all" navigates to the playlist page in the popup context and triggers bulk save (or opens the playlist page in a new tab with the extension pre-activated).

---

## Part 3: Shared Infrastructure Changes

### 3.1 — `wxt.config.ts` — no changes needed

The content script already matches `*://www.youtube.com/*`, which covers `/shorts/*` and `/playlist*`.

### 3.2 — Update `isRelevantPage()` check in `setupPageChangeListener()`

Anywhere the code currently calls only `isYouTubeWatchPage()` to decide whether to act, update to a shared helper:

```typescript
// lib/youtube/pageDetector.ts
export function isRelevantYouTubePage(): boolean {
  return isYouTubeWatchPage() || isYouTubeShortsPage() || isYouTubePlaylistPage();
}
```

### 3.3 — `VideoContext.pageType` field

Add `pageType: 'watch' | 'shorts' | 'playlist-item'` to the `VideoContext` interface and populate it in `extractVideoContext()`.

---

## Implementation Order

| Step | Task | Files changed | Effort |
|---|---|---|---|
| 1 | Add `isYouTubeShortsPage()` + `getVideoIdFromShortsUrl()` | `pageDetector.ts` | Small |
| 2 | Update `extractVideoContext()` to handle Shorts DOM | `pageDetector.ts` | Medium |
| 3 | Skip transcript panel method for Shorts in `fetchTranscript()` | `fetchTranscript.ts` | Small |
| 4 | Add `checkTranscriptAvailabilityViaApi()` for Shorts | `fetchTranscript.ts` | Small |
| 5 | Update `setupPageChangeListener()` to use `isRelevantYouTubePage()` | `pageDetector.ts` | Small |
| 6 | Add `pageType` to `VideoContext` type | `types/index.ts` | Trivial |
| 7 | Show Shorts badge in popup | `popup/App.tsx` | Small |
| 8 | Add `isYouTubePlaylistPage()` + `extractPlaylistContext()` | `pageDetector.ts` | Medium |
| 9 | Create `lib/youtube/playlistScraper.ts` | new file | Medium |
| 10 | Add playlist message types and content script handlers | `messaging/types.ts`, `content.ts` | Medium |
| 11 | Create `components/playlist/PlaylistView.tsx` | new file | Large |
| 12 | Update popup mount logic to detect playlist pages | `popup/App.tsx` | Medium |
| 13 | Add watch-within-playlist banner | `popup/App.tsx` | Small |

---

## Edge Cases & Gotchas

| Scenario | Handling |
|---|---|
| Shorts with no captions | `checkTranscriptAvailabilityViaApi()` returns `available: false`; popup shows "No transcript available" same as watch pages |
| Shorts DOM not loaded yet | `waitForVideoMetadata()` polling covers this; Shorts metadata loads fast but add the Shorts-specific selector to the check |
| Playlist with 1000+ videos | `scrollAndCollectAllVideos()` caps at 200 scrolls; add a warning in UI if `totalVideos > collected.length` |
| Playlist videos with no transcripts | `FETCH_PLAYLIST_TRANSCRIPTS` handler returns per-video status; UI shows skip count separately |
| Private/age-gated playlist videos | InnerTube API returns 403 or empty captions; handler catches and marks as `error` |
| Shorts in a playlist | `/shorts/VIDEO_ID` URL — treat as Shorts, not playlist; `isYouTubePlaylistPage()` returns false |
| YouTube Music (`music.youtube.com`) | Not matched by `www.youtube.com` check — out of scope |
| Embedded Shorts (`/embed/`) | Not a Shorts page — keep out of scope unless added later |

---

## Testing Checklist

### Shorts
- [ ] Navigate directly to a Shorts URL — popup shows title, channel, Shorts badge
- [ ] Navigate from a watch page to a Shorts page (SPA navigation) — popup updates
- [ ] Save transcript from a Shorts video with captions
- [ ] Shorts video with no captions — popup shows "No transcript available"
- [ ] `getVideoIdFromShortsUrl()` unit tests with valid and malformed URLs

### Playlists
- [ ] Open popup on a playlist page — shows playlist title, video list
- [ ] Select/deselect individual videos and "Select All" / "Deselect All"
- [ ] Bulk save 5 videos — progress bar updates, summary shown on completion
- [ ] Playlist with some videos lacking transcripts — correct skip count in summary
- [ ] Large playlist (50+ videos) — scroll-and-collect captures all items
- [ ] Watch page with `&list=` param — banner shown with "Save all" option

---

## Files to Create

| File | Purpose |
|---|---|
| `project/lib/youtube/playlistScraper.ts` | Scroll-and-collect DOM scraper for playlist video lists |
| `project/components/playlist/PlaylistView.tsx` | Popup UI for playlist mode |

## Files to Modify

| File | Change summary |
|---|---|
| `project/lib/youtube/pageDetector.ts` | Add Shorts/playlist detection functions, update context extraction and page change listener |
| `project/lib/youtube/fetchTranscript.ts` | Add `pageType` param, skip panel method for non-watch pages, add API-based availability check |
| `project/lib/messaging/types.ts` | Add `GET_PLAYLIST_CONTEXT` and `FETCH_PLAYLIST_TRANSCRIPTS` message types |
| `project/entrypoints/content.ts` | Add handlers for new message types |
| `project/entrypoints/popup/App.tsx` | Add playlist detection on mount, render `PlaylistView`, watch-in-playlist banner |
| `project/lib/types/index.ts` | Add `pageType` to `VideoContext`, add `PlaylistContext` and `PlaylistVideoItem` interfaces |
