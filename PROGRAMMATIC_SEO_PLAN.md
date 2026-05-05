# Programmatic SEO — Acquisition Strategy

## Why This Works for a Transcript Tool

Programmatic SEO is unusually well-suited here because:

1. **The content IS the product** — transcripts are high-quality, unique, keyword-rich text. Google loves them.
2. **Search intent is exact** — someone searching *"Lex Fridman transcript"* wants precisely what you offer.
3. **The long tail is massive** — millions of YouTube videos, each a potential ranking page.
4. **Zero content creation cost** — transcripts are fetched programmatically, not written by hand.
5. **The conversion is natural** — person reads a transcript on your site → "save this to my library" → installs extension.

The website is the acquisition funnel. The extension is the product they pay for.

---

## Keyword Universe

### Tier 1 — High volume, high intent (target first)

These are searched thousands of times per month:

| Pattern | Example | Intent |
|---|---|---|
| `[creator name] transcript` | "lex fridman transcript" | Find all transcripts from a creator |
| `[podcast name] transcript` | "huberman lab transcript" | Podcast listeners who want to read |
| `[video title] transcript` | "naval ravikant how to get rich transcript" | Want to read a specific video |
| `[creator] [episode/video] transcript` | "tim ferriss podcast 700 transcript" | Specific episode lookup |

### Tier 2 — Topic-based (scale target)

| Pattern | Example | Intent |
|---|---|---|
| `youtube [topic] transcript` | "youtube stoicism transcript" | Topic research |
| `[topic] lecture transcript` | "machine learning lecture transcript" | Students |
| `ted talk [topic] transcript` | "ted talk productivity transcript" | TED content |
| `[creator] [topic] transcript` | "lex fridman elon musk transcript" | Specific conversations |

### Tier 3 — Tool-based (intent to use the extension)

| Pattern | Example | Intent |
|---|---|---|
| `youtube transcript [action]` | "youtube transcript to notes" | Want a workflow |
| `save youtube transcript` | — | Ready to install something |
| `youtube transcript search` | — | Power user need |
| `youtube transcript organizer` | — | Research use case |

---

## Website Architecture

This is a **Next.js** app (App Router, TypeScript) deployed on Vercel. Separate repo from the extension.

```
yoursite.com/
├── /                          → homepage (tool overview + install CTA)
├── /transcript/[videoId]      → individual video transcript page
├── /channel/[channelHandle]   → channel index page
├── /topic/[topicSlug]         → topic collection page
├── /creator/[creatorSlug]     → creator hub page (curated)
├── /search                    → search transcripts
└── /pricing                   → extension pricing page
```

### Page types and their SEO value

---

### Page Type 1: `/transcript/[videoId]`

**Ranks for**: `"[video title] transcript"`, `"[creator] [topic] transcript"`

**Template structure**:
```
<title>[Video Title] — Full Transcript | [Brand]</title>
<meta description="Read the full transcript of '[Video Title]' by [Channel].
Search, copy, and save to your research library.">

[Video thumbnail + metadata]
[Video embed]
─────────────────────────────
Full Transcript
[Timestamped transcript text — the actual content Google indexes]
─────────────────────────────
[Sticky sidebar or bottom banner]
"Save this transcript to your research library"
[Install Extension CTA]
```

**Schema markup** (VideoObject):
```json
{
  "@type": "VideoObject",
  "name": "Video Title",
  "description": "...",
  "thumbnailUrl": "...",
  "uploadDate": "...",
  "transcript": "full transcript text here"
}
```

**Key SEO elements**:
- H1: `[Video Title] — Full Transcript`
- First paragraph: 2–3 sentence summary of the video (AI-generated)
- Word count: naturally high because transcript is the content
- Internal links: link to `/channel/[channelHandle]` and 3 related videos
- Canonical URL to avoid duplicates

---

### Page Type 2: `/channel/[channelHandle]`

**Ranks for**: `"[channel name] transcripts"`, `"[creator name] transcript"`

**Template structure**:
```
<title>[Channel Name] Transcripts — All Videos | [Brand]</title>

[Channel banner + subscriber count]
[Channel description]

Most viewed transcripts:
[Grid of video cards with title, date, word count]

Recent transcripts:
[Paginated list]

About [Channel Name]:
[AI-generated 2–3 paragraph summary of what this creator covers]

[CTA: "Save [Channel Name]'s videos to your library"]
```

**Internal linking**: Each video card links to `/transcript/[videoId]`

---

### Page Type 3: `/topic/[topicSlug]`

**Ranks for**: `"youtube [topic] transcripts"`, `"[topic] lecture transcript"`

**Topics to create first** (high search volume):
- `/topic/artificial-intelligence`
- `/topic/stoicism`
- `/topic/entrepreneurship`
- `/topic/productivity`
- `/topic/investing`
- `/topic/health-longevity`
- `/topic/philosophy`
- `/topic/programming`
- `/topic/psychology`

**Template structure**:
```
<title>[Topic] Transcripts on YouTube — [Brand]</title>

"The best YouTube videos about [Topic], fully transcribed."

[Featured creators in this topic]
[Top 20 most-read transcripts in this topic]
[Recently added]

[CTA: "Research [Topic] with AI — Install Extension"]
```

---

### Page Type 4: `/creator/[creatorSlug]`

High-effort but high-value for major creators. Manually curated, richer content.

**Target first** (huge search volume for transcripts):
- Lex Fridman
- Andrew Huberman
- Tim Ferriss
- Naval Ravikant
- Paul Graham (YC talks)
- 3Blue1Brown
- Andrej Karpathy
- Y Combinator
- TED Talks

**Richer than channel page** — includes:
- Creator bio
- Key themes across their content (AI-generated from all transcripts)
- Most-cited ideas (extracted from transcripts)
- "Read all [X] transcripts" vs "just the top ones"

---

## Technical Implementation

### Stack

```
Next.js 15 (App Router)
TypeScript
Tailwind CSS
Supabase (public transcript database)
Vercel (hosting + ISR/edge caching)
```

### Database Schema (Supabase — public side)

```sql
-- Public transcripts (separate from extension's local IndexedDB)
create table public_transcripts (
  id uuid primary key default gen_random_uuid(),
  video_id text unique not null,         -- YouTube video ID
  title text not null,
  channel_id text not null,
  channel_name text not null,
  channel_handle text,
  published_at timestamptz,
  duration_seconds int,
  view_count bigint,
  transcript_text text,                  -- full plain text (for search)
  transcript_json jsonb,                 -- timestamped segments
  summary text,                          -- AI-generated summary
  topics text[],                         -- AI-classified topics
  language text default 'en',
  word_count int,
  indexed_at timestamptz default now(),
  page_views int default 0
);

create index on public_transcripts(channel_id);
create index on public_transcripts(topics);
create index on public_transcripts(view_count desc);

-- Channels
create table channels (
  channel_id text primary key,
  handle text,
  name text not null,
  description text,
  subscriber_count bigint,
  video_count int,
  thumbnail_url text,
  topics text[],
  channel_summary text,                  -- AI-generated
  last_synced timestamptz
);
```

### Content Pipeline

How transcripts get into the public database:

```
Option A — Seeded from extension users (with consent)
  User saves transcript → opt-in prompt → 
  "Contribute to the public library to help others discover this content?" 
  → [Yes, contribute] → POST to your backend → stored in public_transcripts

Option B — Automated crawler (independent of extension)
  Cron job → fetch transcripts for top creators/channels →
  Store in public_transcripts
  (Target: 10,000 videos in the first month for Tier 1 creators)

Option C — On-demand generation
  User visits /transcript/[videoId] →
  If not in DB, fetch transcript in real-time →
  Store it → serve it
  (Slower first load but scales infinitely)
```

**Recommended**: Start with Option B for top creators, add Option C for long-tail.

### Next.js Route Implementation

#### `/transcript/[videoId]/page.tsx`

```typescript
// Use ISR — revalidate every 24 hours
export const revalidate = 86400

export async function generateMetadata({ params }) {
  const video = await getTranscript(params.videoId)
  return {
    title: `${video.title} — Full Transcript`,
    description: `Read the full transcript of "${video.title}" by ${video.channelName}. ${video.summary?.slice(0, 120)}`,
    openGraph: {
      images: [video.thumbnailUrl]
    }
  }
}

export default async function TranscriptPage({ params }) {
  const video = await getTranscript(params.videoId)
  // render transcript page
}

// Pre-generate top 10,000 pages at build time
export async function generateStaticParams() {
  const topVideos = await getTopVideosByViews(10000)
  return topVideos.map(v => ({ videoId: v.video_id }))
}
```

#### Sitemap (`/sitemap.xml`)

```typescript
// app/sitemap.ts
export default async function sitemap() {
  const videos = await getAllVideoIds()
  const channels = await getAllChannelHandles()

  return [
    ...videos.map(id => ({
      url: `https://yoursite.com/transcript/${id}`,
      changeFrequency: 'monthly',
      priority: 0.8
    })),
    ...channels.map(handle => ({
      url: `https://yoursite.com/channel/${handle}`,
      changeFrequency: 'weekly',
      priority: 0.9
    }))
  ]
}
```

---

## Conversion Strategy

Every page has one job: convert a reader into an extension installer.

### Conversion placements (per transcript page)

1. **Top banner** (dismissible): *"Save this transcript to your research library → [Install Free]"*
2. **Mid-transcript callout** (after ~50% scroll): *"Reading this for research? Save it and search across all your videos. [Install Free]"*
3. **Sticky bottom bar** (appears after 30s): *"Save · Search · Connect ideas across videos [Install Extension]"*
4. **End of transcript CTA** (biggest, most prominent): Full value prop + install button

### Conversion copy that works

Don't say: *"Install our extension"*

Say: *"Save this transcript to your personal library. Search it later. Connect it with other videos you've saved."*

The difference: the first is about you, the second is about what they get.

### Tracking conversions

Use UTM parameters on every install link:
```
https://chromewebstore.google.com/...?utm_source=transcript_page&utm_medium=organic&utm_campaign=[videoId]
```

This tells you which transcript pages convert best → double down on those topics/creators.

---

## Content Seeding Plan (First 90 Days)

### Month 1 — Seed with high-authority creators

Target these first because they have existing search demand:

**Podcasts (high transcript search volume)**:
- Lex Fridman Podcast (400+ episodes)
- Huberman Lab (300+ episodes)
- Tim Ferriss Show (700+ episodes)
- My First Million
- Acquired Podcast
- All-In Podcast

**Education (student audience, high repeat use)**:
- 3Blue1Brown
- Andrej Karpathy
- Fireship
- MIT OpenCourseWare YouTube
- Stanford Online

**Business/Startup**:
- Y Combinator
- a16z
- Paul Graham talks
- Gary Vaynerchuk

**Target**: 5,000 pages indexed by end of Month 1.

### Month 2 — Topic pages + internal linking

- Create all Tier 2 topic pages
- Build internal linking between transcript ↔ channel ↔ topic pages
- Submit updated sitemap to Google Search Console
- Start tracking which pages rank and which convert

### Month 3 — Long tail automation

- Enable Option C (on-demand generation) for any YouTube video
- Add "Request transcript" feature on 404 pages
- Target: 50,000+ pages indexed

---

## SEO Technical Checklist

- [ ] `robots.txt` — allow all crawlers
- [ ] XML sitemap — auto-generated, submitted to GSC
- [ ] Canonical tags — prevent duplicate content
- [ ] VideoObject schema on every transcript page
- [ ] BreadcrumbList schema for navigation
- [ ] Open Graph tags for social sharing
- [ ] Page speed — use Next.js ISR + Vercel Edge for fast TTFB
- [ ] Core Web Vitals — no layout shift, fast LCP (pre-load thumbnails)
- [ ] Internal linking — every page links to 3–5 related pages
- [ ] `hreflang` — if you add non-English transcripts later

---

## Revised Full Timeline

### Week 1–2: Extension repositioning (from MONETIZATION_PLAN.md)
- Rebrand
- Rewrite Chrome Web Store listing
- Knowledge graph → hero feature
- Onboarding flow

### Week 3–4: Website foundation
- Next.js project setup
- Supabase schema + connection
- `/transcript/[videoId]` page template
- `/channel/[channelHandle]` page template
- Seed 1,000 transcripts from top 5 creators

### Week 5–6: Backend + monetization
- Managed AI proxy (Vercel Edge Function)
- Stripe integration
- Auth (Supabase)
- Usage limits in extension

### Week 7: SEO infrastructure
- Sitemap generation
- Schema markup
- On-demand transcript generation (Option C)
- Google Search Console setup
- Submit sitemap

### Week 8: Seed at scale + launch
- Bulk ingest top 20 creators (5,000–10,000 pages)
- Topic pages
- Internal linking
- Submit to Chrome Web Store with new listing
- Announce on relevant subreddits (r/productivity, r/LearnProgramming, etc.)

### Month 2–3: Iterate
- Monitor GSC for ranking pages
- Double down on converting topics/creators
- Add more creators based on search demand data
- A/B test conversion copy

---

## What Makes This Defensible

Once you have 50,000+ indexed transcript pages:

1. **Data moat** — you have more transcripts indexed than any competitor
2. **SEO compounding** — pages keep ranking without ongoing work
3. **Brand association** — "[Your brand] transcript" becomes a search pattern itself
4. **User data** — you see which topics/creators drive installs → informs feature roadmap
5. **Backlinks** — researchers and students naturally link to specific transcript pages

The extension is the product. The website is the distribution machine. SEO is the fuel.

---

## Repository Structure

```
/ (monorepo or two separate repos)
├── extension/          → existing WXT/React extension
└── web/                → Next.js website
    ├── app/
    │   ├── page.tsx                    → homepage
    │   ├── transcript/[videoId]/
    │   │   └── page.tsx
    │   ├── channel/[channelHandle]/
    │   │   └── page.tsx
    │   ├── topic/[topicSlug]/
    │   │   └── page.tsx
    │   ├── creator/[creatorSlug]/
    │   │   └── page.tsx
    │   └── sitemap.ts
    ├── components/
    │   ├── TranscriptViewer.tsx
    │   ├── InstallCTA.tsx              → conversion component
    │   ├── VideoCard.tsx
    │   └── ChannelHeader.tsx
    ├── lib/
    │   ├── supabase.ts
    │   ├── transcripts.ts              → data fetching
    │   └── youtube.ts                 → YouTube API helpers
    └── scripts/
        └── seed.ts                    → bulk transcript ingestion script
```
