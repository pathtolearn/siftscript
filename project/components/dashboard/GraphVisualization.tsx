import { useEffect, useRef, useCallback } from 'react';
import { categoryColour } from '../../lib/utils/graphBuilder';
import type { GraphData, GraphNode, GraphEdge } from '../../types';

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphVisualizationProps {
  data: GraphData;
  onNodeClick: (node: GraphNode) => void;
  selectedNodeId: string | null;
}

// ─── Force simulation constants ──────────────────────────────────────────────
const REPULSION    = 4000;
const SPRING_K     = 0.04;
const SPRING_LEN   = 120;
const GRAVITY      = 0.015;
const DAMPING      = 0.82;
const TICK_MS      = 16;
const WARMUP_TICKS = 200;

function buildSimNodes(nodes: GraphNode[], w: number, h: number): SimNode[] {
  return nodes.map((n, i) => {
    // Spiral placement for initial positions
    const angle = i * 2.399963;
    const r = 40 * Math.sqrt(i + 1);
    return {
      ...n,
      x: w / 2 + r * Math.cos(angle),
      y: h / 2 + r * Math.sin(angle),
      vx: 0,
      vy: 0,
    };
  });
}

function tick(simNodes: SimNode[], edges: GraphEdge[], w: number, h: number, alpha: number) {
  const cx = w / 2;
  const cy = h / 2;
  const n = simNodes.length;
  const idxMap = new Map(simNodes.map((nd, i) => [nd.id, i]));

  // Reset forces
  const fx = new Float64Array(n);
  const fy = new Float64Array(n);

  // Repulsion (Barnes-Hut approximation skipped — just O(n²) for ≤200 nodes)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = simNodes[j].x - simNodes[i].x || 0.01;
      const dy = simNodes[j].y - simNodes[i].y || 0.01;
      const dist2 = dx * dx + dy * dy;
      const force = REPULSION / dist2;
      fx[i] -= force * dx;
      fy[i] -= force * dy;
      fx[j] += force * dx;
      fy[j] += force * dy;
    }
  }

  // Spring attraction along edges
  for (const e of edges) {
    const ai = idxMap.get(e.source);
    const bi = idxMap.get(e.target);
    if (ai === undefined || bi === undefined) continue;
    const dx = simNodes[bi].x - simNodes[ai].x;
    const dy = simNodes[bi].y - simNodes[ai].y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
    const force = SPRING_K * (dist - SPRING_LEN);
    fx[ai] += force * dx / dist;
    fy[ai] += force * dy / dist;
    fx[bi] -= force * dx / dist;
    fy[bi] -= force * dy / dist;
  }

  // Center gravity
  for (let i = 0; i < n; i++) {
    fx[i] += GRAVITY * (cx - simNodes[i].x) * alpha;
    fy[i] += GRAVITY * (cy - simNodes[i].y) * alpha;
  }

  // Integrate
  for (let i = 0; i < n; i++) {
    simNodes[i].vx = (simNodes[i].vx + fx[i]) * DAMPING;
    simNodes[i].vy = (simNodes[i].vy + fy[i]) * DAMPING;
    simNodes[i].x += simNodes[i].vx;
    simNodes[i].y += simNodes[i].vy;
  }
}

function nodeRadius(node: GraphNode): number {
  if (node.type === 'creator') return 16;
  const base = 7 + Math.min(node.transcriptCount * 2, 10);
  return base;
}

function drawGraph(
  ctx: CanvasRenderingContext2D,
  simNodes: SimNode[],
  edges: GraphEdge[],
  scale: number,
  offsetX: number,
  offsetY: number,
  selectedId: string | null,
  hoveredId: string | null,
  dpr: number,
) {
  const idxMap = new Map(simNodes.map((nd, i) => [nd.id, i]));
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.save();
  ctx.scale(dpr, dpr);

  const w = ctx.canvas.width / dpr;
  const h = ctx.canvas.height / dpr;

  ctx.translate(w / 2 + offsetX, h / 2 + offsetY);
  ctx.scale(scale, scale);

  // Edges
  for (const e of edges) {
    const ai = idxMap.get(e.source);
    const bi = idxMap.get(e.target);
    if (ai === undefined || bi === undefined) continue;
    const a = simNodes[ai];
    const b = simNodes[bi];
    const alpha = Math.min(0.15 + e.weight * 0.1, 0.6);
    const width = Math.min(0.5 + e.weight * 0.3, 3);

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = `rgba(99,102,241,${alpha})`;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  // Nodes
  for (const nd of simNodes) {
    const r = nodeRadius(nd);
    const isSelected = nd.id === selectedId;
    const isHovered = nd.id === hoveredId;
    const colour = nd.type === 'creator' ? '#64748B' : categoryColour(nd.category!);

    // Glow ring for selected/hovered
    if (isSelected || isHovered) {
      ctx.beginPath();
      ctx.arc(nd.x, nd.y, r + 5, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? `${colour}40` : `${colour}20`;
      ctx.fill();
    }

    // Node circle
    ctx.beginPath();
    ctx.arc(nd.x, nd.y, r, 0, Math.PI * 2);
    ctx.fillStyle = colour;
    ctx.fill();

    // White border
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    const fontSize = Math.max(9, Math.min(12, r));
    ctx.font = `${isSelected ? 600 : 400} ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = isSelected || isHovered ? '#1E293B' : '#475569';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const maxWidth = 80;
    let label = nd.label;
    if (ctx.measureText(label).width > maxWidth) {
      while (label.length > 3 && ctx.measureText(label + '…').width > maxWidth) {
        label = label.slice(0, -1);
      }
      label += '…';
    }
    ctx.fillText(label, nd.x, nd.y + r + 3);
  }

  ctx.restore();
}

export function GraphVisualization({ data, onNodeClick, selectedNodeId }: GraphVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const animFrameRef = useRef<number>(0);
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const hoveredIdRef = useRef<string | null>(null);
  const draggingRef = useRef<{ node: SimNode | null; startX: number; startY: number; moved: boolean }>({
    node: null, startX: 0, startY: 0, moved: false,
  });
  const panRef = useRef<{ active: boolean; startX: number; startY: number; startOX: number; startOY: number }>({
    active: false, startX: 0, startY: 0, startOX: 0, startOY: 0,
  });

  // Canvas to world coords helper
  const toWorld = useCallback((cx: number, cy: number, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const px = cx - rect.left;
    const py = cy - rect.top;
    const w = rect.width;
    const h = rect.height;
    return {
      wx: (px - w / 2 - offsetRef.current.x) / scaleRef.current,
      wy: (py - h / 2 - offsetRef.current.y) / scaleRef.current,
    };
  }, []);

  const hitTest = useCallback((wx: number, wy: number): SimNode | null => {
    for (const nd of simNodesRef.current) {
      const r = nodeRadius(nd) + 4;
      const dx = nd.x - wx;
      const dy = nd.y - wy;
      if (dx * dx + dy * dy <= r * r) return nd;
    }
    return null;
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    drawGraph(ctx, simNodesRef.current, data.edges, scaleRef.current, offsetRef.current.x, offsetRef.current.y, selectedNodeId, hoveredIdRef.current, dpr);
  }, [data.edges, selectedNodeId]);

  // Init / re-init when data changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const w = rect.width;
    const h = rect.height;

    simNodesRef.current = buildSimNodes(data.nodes, w, h);

    // Warm-up simulation (run ticks without rendering)
    for (let i = 0; i < WARMUP_TICKS; i++) {
      const alpha = 1 - i / WARMUP_TICKS;
      tick(simNodesRef.current, data.edges, w, h, alpha);
    }

    // Centre the graph
    scaleRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };

    redraw();

    // Live simulation loop
    let running = true;
    let ticks = 0;
    const MAX_LIVE = 300;

    function loop() {
      if (!running || ticks > MAX_LIVE) return;
      const alpha = Math.max(0, 1 - ticks / MAX_LIVE);
      tick(simNodesRef.current, data.edges, w, h, alpha);
      redraw();
      ticks++;
      animFrameRef.current = requestAnimationFrame(loop);
    }
    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [data, redraw]);

  // Redraw when selected changes
  useEffect(() => {
    redraw();
  }, [selectedNodeId, redraw]);

  // ── Pointer events ────────────────────────────────────────────────────────

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const { wx, wy } = toWorld(e.clientX, e.clientY, canvas);
    const hit = hitTest(wx, wy);
    if (hit) {
      draggingRef.current = { node: hit, startX: e.clientX, startY: e.clientY, moved: false };
    } else {
      panRef.current = { active: true, startX: e.clientX, startY: e.clientY, startOX: offsetRef.current.x, startOY: offsetRef.current.y };
    }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const { wx, wy } = toWorld(e.clientX, e.clientY, canvas);

    // Dragging a node
    if (draggingRef.current.node) {
      const dx = e.clientX - draggingRef.current.startX;
      const dy = e.clientY - draggingRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) draggingRef.current.moved = true;
      if (draggingRef.current.moved) {
        draggingRef.current.node.x = wx;
        draggingRef.current.node.y = wy;
        draggingRef.current.node.vx = 0;
        draggingRef.current.node.vy = 0;
        redraw();
      }
      return;
    }

    // Panning
    if (panRef.current.active) {
      offsetRef.current = {
        x: panRef.current.startOX + (e.clientX - panRef.current.startX),
        y: panRef.current.startOY + (e.clientY - panRef.current.startY),
      };
      redraw();
      return;
    }

    // Hover detection
    const hit = hitTest(wx, wy);
    const newId = hit?.id ?? null;
    if (newId !== hoveredIdRef.current) {
      hoveredIdRef.current = newId;
      canvas.style.cursor = newId ? 'pointer' : 'grab';
      redraw();
    }
  }

  function handleMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (draggingRef.current.node && !draggingRef.current.moved) {
      // It was a click — fire selection
      const canvas = canvasRef.current!;
      const { wx, wy } = toWorld(e.clientX, e.clientY, canvas);
      const hit = hitTest(wx, wy);
      if (hit) onNodeClick(hit);
    }
    draggingRef.current = { node: null, startX: 0, startY: 0, moved: false };
    panRef.current.active = false;
  }

  function handleMouseLeave() {
    hoveredIdRef.current = null;
    draggingRef.current = { node: null, startX: 0, startY: 0, moved: false };
    panRef.current.active = false;
    redraw();
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
  }

  function handleWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    scaleRef.current = Math.min(4, Math.max(0.2, scaleRef.current * factor));
    redraw();
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full rounded-xl"
      style={{ cursor: 'grab', background: 'white' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
    />
  );
}
