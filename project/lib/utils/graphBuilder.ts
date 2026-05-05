import { conceptRepository } from '../db/repositories/conceptRepository';
import { conceptClusterRepository } from '../db/repositories/conceptClusterRepository';
import type {
  ConceptCluster,
  ConceptCategory,
  GraphData,
  GraphNode,
  GraphEdge,
} from '../../types';

// ─── Cluster building ─────────────────────────────────────────────────────────

function makeClusterId(): string {
  return `cluster-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function mode<T>(arr: T[]): T {
  const counts = new Map<T, number>();
  for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Rebuilds all concept clusters from raw concepts table.
 * Replaces the entire clusters table atomically.
 * ~100ms for 10,000 concept records.
 */
export async function buildConceptGraph(): Promise<void> {
  const grouped = await conceptRepository.getAllGroupedByLabel();
  const now = new Date();

  const clusters: ConceptCluster[] = [];

  for (const [normalizedLabel, concepts] of grouped.entries()) {
    // Pick display label — prefer longer/more specific forms
    const label = concepts
      .map(c => c.label)
      .sort((a, b) => b.length - a.length)[0];

    // Unique sets
    const transcriptIds = [...new Set(concepts.map(c => c.transcriptId))];
    const videoIds = [...new Set(concepts.map(c => c.videoId))];
    const channelIds = [...new Set(concepts.map(c => c.channelId))];

    // Dominant category
    const category = mode(concepts.map(c => c.category)) as ConceptCategory;

    // Total mentions across all transcripts
    const totalMentions = concepts.reduce((sum, c) => sum + c.mentions, 0);

    // Timeline bounds from video publish dates
    const dates = concepts.map(c => c.publishedAt.getTime()).filter(Boolean);
    const firstSeenAt = dates.length ? new Date(Math.min(...dates)) : now;
    const lastSeenAt = dates.length ? new Date(Math.max(...dates)) : now;

    clusters.push({
      clusterId: makeClusterId(),
      label,
      normalizedLabel,
      category,
      transcriptIds,
      videoIds,
      channelIds,
      totalMentions,
      firstSeenAt,
      lastSeenAt,
      updatedAt: now,
    });
  }

  await conceptClusterRepository.replaceAll(clusters);
}

// ─── Graph data derivation ────────────────────────────────────────────────────

const CATEGORY_COLOURS: Record<ConceptCategory, string> = {
  idea:         '#6366F1', // indigo
  framework:    '#F59E0B', // amber
  person:       '#10B981', // emerald
  book:         '#F43F5E', // rose
  topic:        '#0EA5E9', // sky
  organization: '#8B5CF6', // violet
};

export const categoryColour = (cat: ConceptCategory): string =>
  CATEGORY_COLOURS[cat] ?? '#6366F1';

/**
 * Derives the GraphData (nodes + edges) from persisted clusters.
 * Only includes concepts that appear in >= minTranscripts.
 */
export async function deriveGraphData(minTranscripts = 2): Promise<GraphData> {
  const clusters = await conceptClusterRepository.getCrossTranscript(minTranscripts);

  if (clusters.length === 0) {
    return { nodes: [], edges: [], lastBuiltAt: new Date() };
  }

  // Concept nodes
  const conceptNodes: GraphNode[] = clusters.map(cl => ({
    id: `concept:${cl.normalizedLabel}`,
    type: 'concept' as const,
    label: cl.label,
    category: cl.category,
    transcriptCount: cl.transcriptIds.length,
    totalMentions: cl.totalMentions,
  }));

  // Creator nodes — one per unique channel that has >= 2 transcripts in the graph
  const channelMap = new Map<string, { channelId: string; channelTitle: string; transcriptIds: Set<string> }>();
  for (const cl of clusters) {
    for (let i = 0; i < cl.channelIds.length; i++) {
      const chId = cl.channelIds[i];
      if (!channelMap.has(chId)) {
        // Find a channelTitle from concepts
        channelMap.set(chId, { channelId: chId, channelTitle: chId, transcriptIds: new Set() });
      }
      cl.transcriptIds.forEach(tid => channelMap.get(chId)!.transcriptIds.add(tid));
    }
  }

  // Resolve channel titles from raw concepts
  const allConcepts = await conceptRepository.getAllGroupedByLabel();
  for (const concepts of allConcepts.values()) {
    for (const c of concepts) {
      const entry = channelMap.get(c.channelId);
      if (entry && entry.channelTitle === c.channelId) {
        entry.channelTitle = c.channelTitle;
      }
    }
  }

  const creatorNodes: GraphNode[] = [...channelMap.values()]
    .filter(ch => ch.transcriptIds.size >= 2)
    .map(ch => ({
      id: `creator:${ch.channelId}`,
      type: 'creator' as const,
      label: ch.channelTitle,
      transcriptCount: ch.transcriptIds.size,
      totalMentions: ch.transcriptIds.size,
      channelId: ch.channelId,
    }));

  const nodes: GraphNode[] = [...conceptNodes, ...creatorNodes];

  // Edges
  // 1. concept ↔ concept: share >= 1 transcript
  const edges: GraphEdge[] = [];

  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const a = clusters[i];
      const b = clusters[j];
      const shared = a.transcriptIds.filter(id => b.transcriptIds.includes(id));
      if (shared.length > 0) {
        edges.push({
          source: `concept:${a.normalizedLabel}`,
          target: `concept:${b.normalizedLabel}`,
          weight: shared.length,
          sharedTranscriptIds: shared,
        });
      }
    }
  }

  // 2. creator ↔ concept edges
  for (const cl of clusters) {
    for (const channelId of cl.channelIds) {
      if (channelMap.has(channelId) && channelMap.get(channelId)!.transcriptIds.size >= 2) {
        edges.push({
          source: `creator:${channelId}`,
          target: `concept:${cl.normalizedLabel}`,
          weight: cl.transcriptIds.filter(tid => {
            const entry = channelMap.get(channelId);
            return entry ? entry.transcriptIds.has(tid) : false;
          }).length,
          sharedTranscriptIds: [],
        });
      }
    }
  }

  return { nodes, edges, lastBuiltAt: new Date() };
}

// ─── Creator overlap ──────────────────────────────────────────────────────────

export interface CreatorOverlapEntry {
  channelIdA: string;
  channelTitleA: string;
  channelIdB: string;
  channelTitleB: string;
  sharedConcepts: string[];   // normalizedLabels
  sharedConceptLabels: string[];
  overlapScore: number;
}

export async function buildCreatorOverlap(): Promise<CreatorOverlapEntry[]> {
  const clusters = await conceptClusterRepository.getCrossTranscript(1);

  // Map channelId → Set<normalizedLabel>
  const channelConcepts = new Map<string, Set<string>>();
  const channelTitles = new Map<string, string>();

  for (const cl of clusters) {
    for (const channelId of cl.channelIds) {
      if (!channelConcepts.has(channelId)) {
        channelConcepts.set(channelId, new Set());
      }
      channelConcepts.get(channelId)!.add(cl.normalizedLabel);
    }
  }

  // Resolve titles
  const allGrouped = await conceptRepository.getAllGroupedByLabel();
  for (const concepts of allGrouped.values()) {
    for (const c of concepts) {
      if (!channelTitles.has(c.channelId)) {
        channelTitles.set(c.channelId, c.channelTitle);
      }
    }
  }

  const channelIds = [...channelConcepts.keys()];
  const result: CreatorOverlapEntry[] = [];

  for (let i = 0; i < channelIds.length; i++) {
    for (let j = i + 1; j < channelIds.length; j++) {
      const idA = channelIds[i];
      const idB = channelIds[j];
      const setA = channelConcepts.get(idA)!;
      const setB = channelConcepts.get(idB)!;
      const shared = [...setA].filter(x => setB.has(x));
      if (shared.length === 0) continue;

      // Jaccard-like score
      const union = new Set([...setA, ...setB]);
      const overlapScore = Math.round((shared.length / union.size) * 100);

      // Resolve labels
      const sharedConceptLabels = shared.map(nl => {
        const concepts = allGrouped.get(nl);
        return concepts?.[0]?.label ?? nl;
      });

      result.push({
        channelIdA: idA,
        channelTitleA: channelTitles.get(idA) ?? idA,
        channelIdB: idB,
        channelTitleB: channelTitles.get(idB) ?? idB,
        sharedConcepts: shared,
        sharedConceptLabels,
        overlapScore,
      });
    }
  }

  return result.sort((a, b) => b.overlapScore - a.overlapScore);
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

export interface TimelineEntry {
  date: Date;
  channelTitle: string;
  videoId: string;
  transcriptId: string;
  context: string;
  mentions: number;
}

export async function buildTimeline(normalizedLabel: string): Promise<TimelineEntry[]> {
  const grouped = await conceptRepository.getAllGroupedByLabel();
  const concepts = grouped.get(normalizedLabel) ?? [];

  return concepts
    .map(c => ({
      date: c.publishedAt,
      channelTitle: c.channelTitle,
      videoId: c.videoId,
      transcriptId: c.transcriptId,
      context: c.context,
      mentions: c.mentions,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}
