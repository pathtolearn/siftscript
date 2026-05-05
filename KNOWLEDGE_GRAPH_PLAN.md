# VidSage — Automatic Knowledge Graph: Implementation Plan

## What We're Building

An always-on intelligence layer that automatically extracts concepts from every saved transcript and builds a living graph of connections across the entire library — without any user action required.

**The user experience:**
1. Save a transcript → concepts are extracted silently in the background
2. Open Knowledge Graph tab → see a visual graph of ideas, creators, and connections
3. Click any concept node → see every transcript where that idea appears
4. Switch to Creators view → see which channels share intellectual DNA
5. Switch to Timeline → see how a topic evolves across years of content

This requires no manual selection, no triggering, no configuration.

---

## Architecture Overview

```
SAVE_TRANSCRIPT (background.ts)
    ↓ after save completes
extractConcepts(transcript, segments)   ← new, runs automatically
    ↓ stores to IndexedDB
concepts table (new)
    ↓ triggers
buildConceptGraph()                     ← new, runs after each extraction
    ↓ stores to IndexedDB
conceptClusters table (new)
    ↓ read by
KnowledgeGraphView (React UI)           ← refactored
    ↓ renders
GraphVisualization (D3 force graph)     ← new visual component
ClusterView                             ← new: concept cards
CreatorOverlapView                      ← new: creator matrix
TimelineView                            ← new: topic evolution
```

---

## Phase 1: Data Layer

### 1.1 New Types (`project/types/index.ts`)

Add these to the existing types file:

```typescript
// Concept extracted from a single transcript
export type ConceptCategory =
  | 'idea'        // Abstract concepts: "first principles thinking", "emergence"
  | 'framework'   // Mental models, methodologies: "Feynman technique", "inversion"
  | 'person'      // People mentioned: "Richard Feynman", "Charlie Munger"
  | 'book'        // Books/papers referenced: "Poor Charlie's Almanack"
  | 'topic'       // Subject areas: "AI safety", "stoicism", "longevity"
  | 'organization' // Companies, institutions: "OpenAI", "Y Combinator"

export interface Concept {
  conceptId: string
  transcriptId: string
  videoId: string
  channelId: string
  channelTitle: string
  label: string              // Original extracted label
  normalizedLabel: string    // Lowercased, trimmed — used for deduplication
  category: ConceptCategory
  mentions: number           // How many times it appears in the transcript
  context: string            // Short excerpt showing the concept in context
  publishedAt: Date          // Video publish date — used for timeline
  extractedAt: Date
  extractionMethod: 'ai' | 'keyword'  // Which extraction method was used
}

// A cluster = one concept that appears across multiple transcripts
export interface ConceptCluster {
  clusterId: string
  label: string              // Display label (most common form)
  normalizedLabel: string    // Key for grouping
  category: ConceptCategory
  transcriptIds: string[]    // All transcripts containing this concept
  videoIds: string[]
  channelIds: string[]       // Unique channels where this appears
  totalMentions: number
  firstSeenAt: Date          // Earliest video publish date in cluster
  lastSeenAt: Date           // Latest video publish date in cluster
  updatedAt: Date
}

// Graph data shape consumed by the visualisation component
export interface GraphNode {
  id: string
  type: 'concept' | 'creator'
  label: string
  category?: ConceptCategory
  transcriptCount: number    // Size of node
  totalMentions: number
  channelId?: string         // For creator nodes
}

export interface GraphEdge {
  source: string             // GraphNode id
  target: string             // GraphNode id
  weight: number             // Number of shared transcripts
  sharedTranscriptIds: string[]
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  lastBuiltAt: Date
}
```

### 1.2 Database Schema (`project/lib/db/schema.ts`)

Increment to version 6, add two new tables:

```typescript
// Add to TranscriptDatabase class:
concepts!: Table<Concept>
conceptClusters!: Table<ConceptCluster>

// Version 6:
this.version(6).stores({
  // ... all existing v5 tables unchanged ...
  concepts: 'conceptId, transcriptId, videoId, channelId, normalizedLabel, category, publishedAt, extractedAt',
  conceptClusters: 'clusterId, normalizedLabel, category, updatedAt',
}).upgrade(() => {
  console.log('v6: adding concepts and conceptClusters tables');
})
```

**Index rationale:**
- `normalizedLabel` — fast lookup when building clusters (find all concepts with same label)
- `channelId` — fast lookup for creator overlap view
- `publishedAt` — fast sort for timeline view
- `category` — filter by concept type

### 1.3 Concept Repository (`project/lib/db/repositories/conceptRepository.ts`)

```typescript
export class ConceptRepository {
  // Insert extracted concepts for a transcript (replaces any existing)
  async saveForTranscript(concepts: Concept[]): Promise<void>
  
  // Get all concepts for a specific transcript
  async getByTranscriptId(transcriptId: string): Promise<Concept[]>
  
  // Get all concepts grouped by normalizedLabel (for cluster building)
  async getAllGroupedByLabel(): Promise<Map<string, Concept[]>>
  
  // Get concepts for a specific channel (for creator view)
  async getByChannelId(channelId: string): Promise<Concept[]>
  
  // Get concepts within a date range (for timeline)
  async getByDateRange(from: Date, to: Date): Promise<Concept[]>
  
  // Delete all concepts for a transcript (called on transcript delete)
  async deleteByTranscriptId(transcriptId: string): Promise<void>
  
  // Check if concepts have been extracted for a transcript
  async hasExtraction(transcriptId: string): Promise<boolean>
}
```

### 1.4 Concept Cluster Repository (`project/lib/db/repositories/conceptClusterRepository.ts`)

```typescript
export class ConceptClusterRepository {
  // Replace all clusters (called after each graph rebuild)
  async replaceAll(clusters: ConceptCluster[]): Promise<void>
  
  // Get all clusters, ordered by totalMentions desc
  async getAll(): Promise<ConceptCluster[]>
  
  // Get clusters appearing in 2+ transcripts (the meaningful connections)
  async getCrossTranscript(minTranscripts?: number): Promise<ConceptCluster[]>
  
  // Get clusters for a specific channel
  async getByChannelId(channelId: string): Promise<ConceptCluster[]>
  
  // Get clusters within a date range (for timeline)
  async getByDateRange(from: Date, to: Date): Promise<ConceptCluster[]>
  
  // Get count (used for empty state logic)
  async count(): Promise<number>
}
```

---

## Phase 2: Extraction Pipeline

### 2.1 AI Concept Extractor (`project/lib/utils/conceptExtractor.ts`)

Two extraction modes:

**Mode 1: AI extraction** (when API key is configured)

```typescript
export async function extractConceptsWithAI(
  transcript: Transcript,
  video: Video,
  segments: Segment[],
  settings: AISettings
): Promise<Omit<Concept, 'conceptId' | 'extractedAt'>[]>
```

Prompt design:
```
You are extracting key concepts from a YouTube transcript for a research knowledge base.

Video: "${video.title}" by ${video.channelTitle}

Transcript excerpt (first 8000 chars):
${truncatedTranscript}

Extract up to 20 of the most significant concepts. For each concept return:
- label: the concept name as mentioned (e.g., "first principles thinking")
- category: one of: idea | framework | person | book | topic | organization
- mentions: estimated frequency (1-10)
- context: a single sentence from the transcript that best illustrates this concept

Focus on:
- Ideas and mental models discussed
- Frameworks or methodologies explained  
- Notable people referenced by name
- Books or papers mentioned
- Key subject areas covered

Return JSON: { "concepts": [{ "label", "category", "mentions", "context" }] }
```

Use the cheapest/fastest model available (gpt-4o-mini / gemini-flash / haiku) — this runs on every save.

**Mode 2: Keyword extraction** (no API key, always available as fallback)

```typescript
export function extractConceptsFromKeywords(
  transcript: Transcript,
  video: Video,
  segments: Segment[]
): Omit<Concept, 'conceptId' | 'extractedAt'>[]
```

Algorithm:
1. Tokenize the full transcript text
2. Remove stopwords (common English words)
3. Calculate TF-IDF score per unique phrase (1–4 word n-grams)
4. Take top 20 by TF-IDF score
5. Assign category `'topic'` (can't distinguish without AI)
6. Set `extractionMethod: 'keyword'`

This means concept extraction works for every user from day one, even without an AI key. AI key gives richer categorization.

**Main entry point:**

```typescript
export async function extractConcepts(
  transcript: Transcript,
  video: Video,
  segments: Segment[]
): Promise<void>
// Tries AI first, falls back to keyword extraction
// Saves results to concepts table
// Called automatically from background after every save
```

### 2.2 Graph Builder (`project/lib/utils/graphBuilder.ts`)

Runs after concept extraction to rebuild the global concept clusters and graph data.

```typescript
// Main function — rebuilds all clusters from raw concepts table
export async function buildConceptGraph(): Promise<void>

// Derives GraphData (nodes + edges) from clusters — used by UI
export async function deriveGraphData(
  minTranscripts?: number  // default: 2 — only show cross-transcript concepts
): Promise<GraphData>

// Creator overlap: which creators share the most concepts
export async function buildCreatorOverlap(): Promise<Array<{
  channelA: { channelId: string; channelTitle: string }
  channelB: { channelId: string; channelTitle: string }
  sharedConcepts: string[]
  overlapScore: number
}>>

// Topic timeline: how a concept cluster appears over time
export async function buildTimeline(clusterId: string): Promise<Array<{
  date: Date
  channelTitle: string
  videoTitle: string
  transcriptId: string
  context: string
}>>
```

**`buildConceptGraph()` algorithm:**

```
1. Load all concepts from IndexedDB (grouped by normalizedLabel)
2. For each unique normalizedLabel:
   a. Collect all concept instances (from different transcripts)
   b. Pick most common label form (or longest) as display label
   c. Determine dominant category (mode)
   d. Compute: transcriptIds, videoIds, channelIds (unique sets)
   e. Sum totalMentions
   f. Find firstSeenAt / lastSeenAt from publishedAt dates
   g. Create ConceptCluster record
3. Replace all clusters in conceptClusters table
```

**Performance note:** This is a read-then-write operation on IndexedDB, not a heavy computation. For a library of 500 transcripts it runs in < 200ms. Run on every concept extraction.

---

## Phase 3: Background Integration

### 3.1 Update `project/entrypoints/background.ts`

In the `SAVE_TRANSCRIPT` handler, after the transaction completes successfully, trigger concept extraction:

```typescript
// After successful transcript save:
const savedTranscript = await transcriptRepository.getById(transcriptId)
const savedVideo = await videoRepository.getById(savedTranscript.videoId)
const savedSegments = await segmentRepository.getByTranscriptId(transcriptId)

// Fire and forget — don't block the save response
extractConcepts(savedTranscript, savedVideo, savedSegments)
  .then(() => buildConceptGraph())
  .catch(err => console.warn('Concept extraction failed (non-critical):', err))
```

Key design decisions:
- **Non-blocking** — the save response returns immediately; extraction happens after
- **Non-critical** — extraction failure is logged but never surfaces as an error to the user
- **Idempotent** — if extraction runs twice for the same transcript, it replaces the previous result

### 3.2 New Message Types (`project/lib/messaging/types.ts`)

Add two new message types:

```typescript
EXTRACT_CONCEPTS_FOR_ALL: {
  payload: {}
  response: { queued: number }  // number of transcripts queued for extraction
}

GET_GRAPH_DATA: {
  payload: { minTranscripts?: number }
  response: GraphData
}
```

### 3.3 Backfill Handler

For users who already have transcripts saved before this feature shipped, expose a "build graph" trigger in the UI. Background handler:

```typescript
messaging.registerHandler('EXTRACT_CONCEPTS_FOR_ALL', async () => {
  const allTranscripts = await transcriptRepository.getAll()
  const needsExtraction = await Promise.all(
    allTranscripts.map(async t => ({
      transcript: t,
      hasExtraction: await conceptRepository.hasExtraction(t.transcriptId)
    }))
  )
  const queue = needsExtraction.filter(x => !x.hasExtraction)

  // Process in batches of 3 to avoid rate limiting
  for (let i = 0; i < queue.length; i += 3) {
    const batch = queue.slice(i, i + 3)
    await Promise.all(batch.map(async ({ transcript }) => {
      const video = await videoRepository.getById(transcript.videoId)
      const segments = await segmentRepository.getByTranscriptId(transcript.transcriptId)
      await extractConcepts(transcript, video, segments)
    }))
    await buildConceptGraph()
    // Brief pause between batches
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  return { queued: queue.length }
})
```

---

## Phase 4: Visual Graph Component

### 4.1 Install Dependency

```bash
npm install react-force-graph-2d
```

`react-force-graph-2d` renders a D3 force-directed graph on a canvas element. Lightweight API, React-friendly, handles hundreds of nodes smoothly.

### 4.2 `GraphVisualization` Component (`project/components/graph/GraphVisualization.tsx`)

```typescript
interface GraphVisualizationProps {
  data: GraphData
  highlightNodeId?: string          // Highlight a specific node (on hover/search)
  onNodeClick: (node: GraphNode) => void
  onEdgeClick: (edge: GraphEdge) => void
  height?: number                    // defaults to 600
}
```

**Visual design:**

Concept nodes:
- Shape: circle
- Size: `4 + Math.sqrt(node.transcriptCount) * 3` — bigger = more transcripts
- Colour by category:
  - `idea` → indigo `#6366F1`
  - `framework` → amber `#F59E0B`
  - `person` → emerald `#10B981`
  - `book` → rose `#F43F5E`
  - `topic` → sky `#0EA5E9`
  - `organization` → violet `#8B5CF6`

Creator nodes:
- Shape: square/rect
- Size: proportional to number of transcripts saved from that channel
- Colour: slate `#64748B`

Edges:
- Thickness: `1 + Math.log(edge.weight)`
- Colour: light gray `#CBD5E1`, hover → indigo

**Interaction:**
- Hover node → show tooltip (label, transcript count, category)
- Click node → `onNodeClick` fires → right panel shows node detail
- Drag nodes → force layout responds
- Scroll → zoom in/out
- Double-click background → reset zoom

**Empty state (< 2 concepts extracted):**
```
[Network icon]
"Your knowledge graph is building..."
Concepts are extracted automatically as you save transcripts.
[If 0 transcripts: "Save your first transcript to get started"]
[If transcripts exist but no extraction yet: "Build Graph" button]
```

### 4.3 Node Detail Panel (`project/components/graph/NodeDetailPanel.tsx`)

Slides in from the right when a node is clicked:

**For concept nodes:**
```
[Category badge]  [Concept label]

Appears in X transcripts · Y creators · Z total mentions

Transcripts containing this concept:
[List of video cards with channel, title, date]
[Click to open transcript detail]

Related concepts (share transcripts):
[Horizontal scroll of concept chips]
```

**For creator nodes:**
```
[Channel avatar if available]  [Channel name]

X transcripts saved · Y unique concepts

Concepts this creator covers most:
[Top 8 concept chips, coloured by category]

Shared intellectual DNA with:
[Other creator cards, ordered by overlap score]
```

---

## Phase 5: Knowledge Graph Views

### 5.1 Refactor `KnowledgeGraphView.tsx`

Replace the current single-page view with a 4-tab layout. The existing `CrossAnalysis`-based view (themes/contradictions/progression/synthesis) moves to an "Analysis" sub-tab.

**New tab structure:**

```
[Graph]  [Clusters]  [Creators]  [Timeline]  [Analysis]
```

Tabs only visible after at least one concept extraction has run.

---

### 5.2 Graph Tab

The `GraphVisualization` component with a floating control panel:

```
[Floating controls — top left]
Filter by category: [All] [Ideas] [Frameworks] [People] [Books] [Topics]
Min connections: [1] [2] [3+]
Show creators: [toggle]

[Search — top right]
[Search concepts...]
```

---

### 5.3 Clusters Tab (`project/components/graph/ClusterView.tsx`)

List view of all concept clusters, sorted by `totalMentions` descending:

```
[Sort: Most mentioned | Most transcripts | Most creators | Newest | Oldest]
[Filter: Category dropdown]

[Search: filter clusters by label]

────────────────────────────────────────

[concept card]
┌──────────────────────────────────────────────────────────┐
│  [category colour dot]  First Principles Thinking        │
│  framework · 12 transcripts · 4 creators · 47 mentions   │
│                                                          │
│  [creator avatars/initials: LF  AH  TF  NK]             │
│                                                          │
│  "The idea that you should break problems down to their  │
│  fundamental truths rather than reasoning by analogy..." │
│                                                          │
│  First seen: Mar 2021  ·  Last seen: Nov 2024            │
└──────────────────────────────────────────────────────────┘
```

Clicking a card opens a drawer showing all transcripts containing that concept with the relevant excerpt highlighted.

---

### 5.4 Creators Tab (`project/components/graph/CreatorOverlapView.tsx`)

**Section 1 — Creator cards (top)**

Grid of creator cards, each showing:
- Channel name
- Top 5 concept chips (most mentioned)
- Transcript count

**Section 2 — Overlap matrix (below)**

A grid/heatmap showing shared concept count between every pair of creators in your library.

```
                  Lex F.  Huberman  Tim F.  Naval
Lex Fridman       ——      41        28      35
Huberman Lab      41      ——        19      12
Tim Ferriss       28      19        ——      22
Naval Ravikant    35      12        22      ——
```

Clicking a cell opens a panel listing the shared concepts between those two creators.

---

### 5.5 Timeline Tab (`project/components/graph/TimelineView.tsx`)

**Layout:** Search/filter bar at top, scrollable timeline below.

User selects a concept cluster from a searchable dropdown (or clicks through from Clusters tab). The timeline shows every appearance of that concept across all saved transcripts, sorted by video publish date:

```
[Select concept: "First Principles Thinking ▾]

──── 2019 ────────────────────────────────────────────

  [Thumbnail]  Naval Ravikant on Joe Rogan
               "You want to be able to think from first principles..."
               Jan 2019

──── 2021 ────────────────────────────────────────────

  [Thumbnail]  Elon Musk — Lex Fridman #49
               "Physics is a good framework for first principles..."
               Nov 2021

  [Thumbnail]  Tim Ferriss: How to Learn Anything
               "Charlie Munger calls these mental models..."
               Dec 2021

──── 2023 ────────────────────────────────────────────

  [Thumbnail]  Andrej Karpathy: Software 2.0
               "Building from the ground up rather than..."
               Feb 2023
```

Each entry is clickable and opens the transcript at that segment.

---

### 5.6 Analysis Tab

The existing manual cross-video analysis (select transcripts → Cross-Analyze → see themes/contradictions/progression/synthesis). Moved here from the top-level. Now positioned as a complement to the automatic graph, not the primary feature.

---

## Phase 6: Empty States & Onboarding Integration

### 6.1 Graph empty states

Three states to handle:

**State 1 — No transcripts saved**
```
[Icon]
Save your first YouTube transcript to start building your knowledge graph.
[→ goes to YouTube badge/instructions]
```

**State 2 — Transcripts saved but no extractions yet**
```
[Icon]
Your graph is ready to build.
You have X transcripts. Click below to extract concepts and build your graph.
[Build Knowledge Graph]  ← triggers EXTRACT_CONCEPTS_FOR_ALL
```

**State 3 — Concepts extracting (in progress)**
```
[Spinner]
Extracting concepts from your library...
X / Y transcripts processed
This only runs once. New transcripts are processed automatically.
```

### 6.2 Update Onboarding Step 3

Update `OnboardingFlow.tsx` Step 3 to mention the automatic graph:

```
Your library is ready.

Concepts are being extracted from your saved videos automatically.
Once you have 3+ videos saved, open the Knowledge Graph tab to see
how ideas connect across everything you've watched.
```

---

## File Summary

### New files to create

```
project/
├── types/index.ts                              — add Concept, ConceptCluster, GraphNode, GraphEdge, GraphData
├── lib/db/schema.ts                            — version 6, add concepts + conceptClusters tables
├── lib/db/repositories/
│   ├── conceptRepository.ts                    — NEW
│   └── conceptClusterRepository.ts             — NEW
├── lib/utils/
│   ├── conceptExtractor.ts                     — NEW (AI + keyword extraction)
│   └── graphBuilder.ts                         — NEW (cluster building + graph data)
└── components/
    └── graph/
        ├── GraphVisualization.tsx              — NEW (react-force-graph-2d wrapper)
        ├── NodeDetailPanel.tsx                 — NEW (slide-in panel on node click)
        ├── ClusterView.tsx                     — NEW (concept cluster list)
        ├── CreatorOverlapView.tsx              — NEW (creator matrix)
        └── TimelineView.tsx                    — NEW (topic evolution)
```

### Existing files to modify

```
project/
├── entrypoints/background.ts                   — trigger extractConcepts after SAVE_TRANSCRIPT
├── lib/messaging/types.ts                      — add EXTRACT_CONCEPTS_FOR_ALL, GET_GRAPH_DATA
├── components/dashboard/KnowledgeGraphView.tsx — refactor to 5-tab layout
├── components/onboarding/OnboardingFlow.tsx    — update Step 3 copy
└── package.json                                — add react-force-graph-2d
```

---

## Decisions & Trade-offs

### Why keyword fallback matters
If we require an AI key for extraction, the Knowledge Graph tab is dead for most new users. The keyword fallback (TF-IDF) gives every user something useful from day one, even if the categories are less precise. AI extraction enriches it when available.

### Why `normalizedLabel` is the cluster key
Creators say the same thing in different ways: "first principles", "first principles thinking", "reasoning from first principles". Normalizing to lowercase and trimming whitespace catches most of these. For a v1, this is sufficient. Future improvement: embedding-based semantic deduplication.

### Why `buildConceptGraph()` replaces all clusters
Rather than incrementally updating clusters (complex, error-prone), we rebuild the full cluster set from raw concepts on every change. With 500 transcripts × 20 concepts each = 10,000 concept records. A full rebuild takes ~100ms. Simple and correct.

### Why react-force-graph-2d over D3 directly
- React-friendly API (pass data, get graph)
- Handles canvas rendering (smooth with 500+ nodes)
- Force simulation built in
- ~80KB gzipped — acceptable given the extension is already 992KB

### Why the old Analysis tab is kept
The manual cross-video analysis (themes/contradictions) produces higher-quality, more focused output for a specific research question. The automatic graph is for discovery. They serve different jobs. Keep both, but demote Analysis from hero to supporting feature.

---

## Timeline

| Phase | Work | Days |
|---|---|---|
| 1 — Data layer | Types, schema v6, repositories | 2 |
| 2 — Extraction pipeline | conceptExtractor.ts, graphBuilder.ts | 3 |
| 3 — Background integration | background.ts changes, backfill handler | 2 |
| 4 — Graph visualisation | GraphVisualization + NodeDetailPanel | 3 |
| 5 — Knowledge Graph views | All 5 tabs (Graph, Clusters, Creators, Timeline, Analysis) | 4 |
| 6 — Polish | Empty states, onboarding update, edge cases | 1 |

**Total: ~15 days solo**
