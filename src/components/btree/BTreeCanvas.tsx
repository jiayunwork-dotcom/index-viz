import { useMemo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BTreeNodeData, HighlightType } from '@/structures/btree/types';
import { cn } from '@/lib/utils';

interface FrameData {
  nodes: Record<string, BTreeNodeData>;
  rootId: string | null;
  order: number;
  isPlus: boolean;
  nodeId?: string;
  type?: HighlightType;
  path?: string[];
  insertingKey?: number;
  leafChain: { from: string; to: string }[];
  splitInfo?: { leftId: string; rightId: string; upKey: number } | null;
}

interface BTreeCanvasProps {
  frame: FrameData | null;
}

interface LaidOutNode extends BTreeNodeData {
  x: number;
  y: number;
  width: number;
  centerX: number;
}

const K_W = 40;
const K_H = 34;
const K_GAP = 4;
const PAD_X = 10;
const PAD_Y = 8;
const LV_GAP = 100;
const ND_GAP = 40;

function nodeW(nKeys: number): number {
  const c = Math.max(nKeys, 1);
  return PAD_X * 2 + c * K_W + (c - 1) * K_GAP;
}

function layoutTree(
  nodes: Record<string, BTreeNodeData>,
  rootId: string | null
): LaidOutNode[] {
  if (!rootId || !nodes[rootId]) return [];
  const result: LaidOutNode[] = [];

  const layout = (id: string, depth: number, startX: number): { width: number; centerX: number } => {
    const nd = nodes[id];
    if (!nd) return { width: 0, centerX: 0 };

    const selfW = nodeW(nd.keys.length);

    if (nd.children.length === 0) {
      result.push({
        ...nd,
        x: startX,
        y: depth * (K_H + PAD_Y * 2 + LV_GAP) + 30,
        width: selfW,
        centerX: startX + selfW / 2,
      });
      return { width: selfW, centerX: startX + selfW / 2 };
    }

    let childTotalW = 0;
    const childCenters: number[] = [];

    nd.children.forEach((cid, i) => {
      const childX = startX + childTotalW + (i > 0 ? ND_GAP : 0);
      if (i > 0) childTotalW += ND_GAP;
      const cr = layout(cid, depth + 1, childX);
      childCenters.push(cr.centerX);
      childTotalW += cr.width;
    });

    const firstC = childCenters[0];
    const lastC = childCenters[childCenters.length - 1];
    const childrenCx = (firstC + lastC) / 2;
    const totalW = Math.max(selfW, childTotalW);

    const shift = (totalW - childTotalW) / 2;
    if (shift > 0) {
      nd.children.forEach((cid) => shiftSubtree(cid, shift, depth + 1, result));
    }

    const selfCx = childrenCx + shift;

    result.push({
      ...nd,
      x: selfCx - selfW / 2,
      y: depth * (K_H + PAD_Y * 2 + LV_GAP) + 30,
      width: selfW,
      centerX: selfCx,
    });

    return { width: totalW, centerX: selfCx };
  };

  const shiftSubtree = (id: string, delta: number, depth: number, list: LaidOutNode[]) => {
    const nd = list.find((n) => n.id === id);
    if (!nd) return;
    nd.x += delta;
    nd.centerX += delta;
    nd.children.forEach((cid) => shiftSubtree(cid, delta, depth + 1, list));
  };

  layout(rootId, 0, 40);

  return result;
}

function colorsOf(hl: HighlightType | undefined) {
  switch (hl) {
    case 'searching': return { stroke: '#3b82f6', fill: '#eff6ff', key: '#bfdbfe', keyText: '#1e40af' };
    case 'splitting': return { stroke: '#ef4444', fill: '#fee2e2', key: '#fca5a5', keyText: '#991b1b' };
    case 'merging': return { stroke: '#f97316', fill: '#ffedd5', key: '#fdba74', keyText: '#9a3412' };
    case 'borrowing': return { stroke: '#f59e0b', fill: '#fef3c7', key: '#fcd34d', keyText: '#92400e' };
    case 'found': return { stroke: '#22c55e', fill: '#dcfce7', key: '#86efac', keyText: '#166534' };
    case 'inserting': return { stroke: '#10b981', fill: '#d1fae5', key: '#6ee7b7', keyText: '#065f46' };
    default: return { stroke: '#cbd5e1', fill: '#ffffff', key: '#f1f5f9', keyText: '#334155' };
  }
}

export default function BTreeCanvas({ frame }: BTreeCanvasProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const nodeH = K_H + PAD_Y * 2;

  const { laidOut, bounds, highlights } = useMemo(() => {
    if (!frame) return { laidOut: [] as LaidOutNode[], bounds: { w: 0, h: 0 }, highlights: {} as Record<string, HighlightType> };
    const laid = layoutTree(frame.nodes, frame.rootId);
    let maxX = 0, maxY = 0;
    laid.forEach((n) => {
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + nodeH);
    });
    const hl: Record<string, HighlightType> = {};
    if (frame.type && frame.nodeId) hl[frame.nodeId] = frame.type;
    if (frame.path) frame.path.forEach((p) => { if (!hl[p]) hl[p] = 'searching'; });
    return { laidOut: laid, bounds: { w: maxX + 40, h: maxY + 60 }, highlights: hl };
  }, [frame, nodeH]);

  if (!frame) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        插入数据开始可视化
      </div>
    );
  }

  const svgW = Math.max(800, bounds.w);
  const svgH = Math.max(400, bounds.h);
  const nodeMap: Record<string, LaidOutNode> = {};
  laidOut.forEach((n) => { nodeMap[n.id] = n; });

  const splitNode = frame.type === 'splitting' && frame.nodeId ? nodeMap[frame.nodeId] : null;
  const selectedNode = selectedId ? frame.nodes[selectedId] : null;

  const showUpKey = (frame.type === 'splitting' && splitNode != null) || (frame.splitInfo != null && frame.insertingKey != null);

  const upKeyStartY = splitNode ? splitNode.y + nodeH / 2 : 
    (frame.splitInfo ? (() => {
      const left = nodeMap[frame.splitInfo.leftId];
      const right = nodeMap[frame.splitInfo.rightId];
      if (left && right) return (left.y + right.y) / 2;
      return 100;
    })() : 100);

  const upKeyX = splitNode ? splitNode.centerX :
    (frame.splitInfo ? (() => {
      const left = nodeMap[frame.splitInfo.leftId];
      const right = nodeMap[frame.splitInfo.rightId];
      if (left && right) return (left.centerX + right.centerX) / 2;
      return 100;
    })() : 100);

  return (
    <div className="relative h-full overflow-auto bg-gradient-to-b from-slate-50 to-white">
      <svg width={svgW} height={svgH} className="block">
        <defs>
          <marker id="bt-edge" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 z" fill="#94a3b8" />
          </marker>
          <marker id="bt-edge-blue" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 z" fill="#3b82f6" />
          </marker>
          <marker id="bt-chain" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
            <path d="M0,0 L9,4.5 L0,9 z" fill="#0ea5e9" />
          </marker>
          <filter id="bt-glow-red" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feFlood floodColor="#ef4444" floodOpacity="0.8" result="red" />
            <feComposite in="red" in2="blur" operator="in" result="red-glow" />
            <feMerge><feMergeNode in="red-glow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="bt-glow-green" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <g>
          {laidOut.flatMap((node) =>
            node.children.map((childId, i) => {
              const child = nodeMap[childId];
              if (!child) return null;
              const onPath = highlights[node.id] === 'searching' && highlights[childId] === 'searching';
              const exitX = node.x + (node.width / (node.children.length + 1)) * (i + 1);
              return (
                <motion.line
                  key={`edge-${node.id}-${childId}`}
                  initial={{ opacity: 0 }}
                  animate={{
                    x1: exitX,
                    y1: node.y + nodeH,
                    x2: child.centerX,
                    y2: child.y,
                    stroke: onPath ? '#3b82f6' : '#94a3b8',
                    strokeWidth: onPath ? 2.5 : 1.5,
                    opacity: 1,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                  markerEnd={onPath ? 'url(#bt-edge-blue)' : 'url(#bt-edge)'}
                />
              );
            })
          )}
        </g>

        <g>
          {frame.leafChain?.map((link, i) => {
            const from = nodeMap[link.from];
            const to = nodeMap[link.to];
            if (!from || !to) return null;
            const midY = from.y + nodeH / 2;
            return (
              <motion.line
                key={`chain-${i}`}
                initial={{ opacity: 0 }}
                animate={{
                  x1: from.x + from.width,
                  y1: midY,
                  x2: to.x - 2,
                  y2: midY,
                  opacity: 1,
                }}
                transition={{ duration: 0.4 }}
                stroke="#0ea5e9"
                strokeWidth={2}
                strokeDasharray="5 3"
                markerEnd="url(#bt-chain)"
              />
            );
          })}
        </g>

        <AnimatePresence mode="popLayout">
          {laidOut.map((node) => {
            const hl = highlights[node.id];
            const cs = colorsOf(hl);
            const isSelected = selectedId === node.id;
            const isSplitting = hl === 'splitting';
            const isFound = hl === 'found';

            return (
              <g key={node.id}>
                <motion.rect
                  layoutId={`nd-${node.id}`}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{
                    x: node.x,
                    y: node.y,
                    width: node.width,
                    height: nodeH,
                    rx: 8,
                    fill: cs.fill,
                    stroke: cs.stroke,
                    strokeWidth: isSplitting || isFound ? 3.5 : 2,
                    filter: isSplitting ? 'url(#bt-glow-red)' : isFound ? 'url(#bt-glow-green)' : 'none',
                    scale: isSplitting ? [1, 1.08, 1, 1.08, 1] : 1,
                    opacity: 1,
                  }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{
                    layout: { duration: 0.5, ease: 'easeInOut' },
                    scale: { duration: isSplitting ? 0.7 : 0.3, repeat: isSplitting ? Infinity : 0, repeatType: 'loop' },
                    fill: { duration: 0.3 },
                    stroke: { duration: 0.3 },
                    filter: { duration: 0.25 },
                    opacity: { duration: 0.25 },
                  }}
                  style={{ cursor: 'pointer', transformOrigin: `${node.centerX}px ${node.y + nodeH / 2}px` }}
                  onClick={() => setSelectedId(isSelected ? null : node.id)}
                />

                {isSelected && (
                  <motion.rect
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    x={node.x - 4}
                    y={node.y - 4}
                    width={node.width + 8}
                    height={nodeH + 8}
                    rx={11}
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                  />
                )}

                {node.keys.map((k, ki) => {
                  const kx = node.x + PAD_X + ki * (K_W + K_GAP);
                  const ky = node.y + PAD_Y;
                  const isKHi =
                    (hl === 'found' && frame.insertingKey != null && k === frame.insertingKey) ||
                    (hl === 'inserting' && frame.insertingKey != null && k === frame.insertingKey);

                  return (
                    <g key={`k-${node.id}-${ki}`}>
                      <motion.rect
                        layoutId={`kr-${node.id}-${ki}`}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{
                          x: kx,
                          y: ky,
                          width: K_W,
                          height: K_H,
                          rx: 6,
                          fill: isKHi ? '#22c55e' : cs.key,
                          scale: isKHi ? [1, 1.2, 1] : 1,
                          opacity: 1,
                        }}
                        transition={{
                          layout: { duration: 0.4, ease: 'easeInOut' },
                          scale: { duration: 0.45, repeat: isKHi ? 2 : 0 },
                          fill: { duration: 0.3 },
                        }}
                      />
                      <motion.text
                        layoutId={`kt-${node.id}-${ki}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{
                          x: kx + K_W / 2,
                          y: ky + K_H / 2 + 5,
                          opacity: 1,
                          fill: isKHi ? '#ffffff' : cs.keyText,
                        }}
                        transition={{ layout: { duration: 0.4 }, fill: { duration: 0.3 } }}
                        textAnchor="middle"
                        fontSize="14"
                        fontWeight="600"
                        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                      >
                        {k}
                      </motion.text>
                    </g>
                  );
                })}

                {node.keys.length === 0 && (
                  <text
                    x={node.centerX}
                    y={node.y + nodeH / 2 + 4}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#94a3b8"
                  >
                    空
                  </text>
                )}
              </g>
            );
          })}
        </AnimatePresence>

        {showUpKey && (
          <g>
            <motion.circle
              key="upkey-circle"
              initial={{ r: 0, opacity: 0, cy: upKeyStartY }}
              animate={{
                cx: upKeyX,
                cy: splitNode ? splitNode.y - 28 : upKeyStartY - 60,
                r: 17,
                opacity: [0, 1, 1, 0.9],
              }}
              transition={{ duration: 1, ease: 'easeOut' }}
              fill="#ef4444"
              style={{ transformOrigin: `${upKeyX}px ${splitNode ? splitNode.y - 28 : upKeyStartY - 60}px` }}
            />
            <motion.text
              key="upkey-text"
              initial={{ opacity: 0, y: 10 }}
              animate={{
                x: upKeyX,
                y: splitNode ? splitNode.y - 23 : upKeyStartY - 55,
                opacity: [0, 1, 1, 0.9],
              }}
              transition={{ duration: 1, ease: 'easeOut' }}
              textAnchor="middle"
              fontSize="14"
              fontWeight="700"
              fill="white"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            >
              {frame.insertingKey}
            </motion.text>
            <motion.path
              key="upkey-path"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.5 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              d={`M ${upKeyX} ${upKeyStartY + 2} Q ${upKeyX + 25} ${upKeyStartY - 15}, ${upKeyX} ${upKeyStartY - 55}`}
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="4 2"
              fill="none"
            />
          </g>
        )}

        {frame.type === 'borrowing' && frame.nodeId && (() => {
          const n = nodeMap[frame.nodeId!];
          if (!n) return null;
          return (
            <motion.text
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: [0, 1, 1, 0], x: [15, 0, 0, -8] }}
              transition={{ duration: 1, repeat: Infinity }}
              x={n.x + n.width + 6}
              y={n.y + nodeH / 2 + 6}
              fontSize="18"
              fill="#f59e0b"
              fontWeight="bold"
            >
              ←
            </motion.text>
          );
        })()}
      </svg>

      {selectedNode && (
        <div className="absolute right-4 top-4 card p-4 text-sm pointer-events-auto max-w-xs z-10 shadow-xl border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-slate-800">节点详情</h4>
            <button onClick={() => setSelectedId(null)} className="text-slate-400 hover:text-slate-600 text-base">✕</button>
          </div>
          <div className="space-y-1.5 text-slate-600">
            <div className="flex justify-between">
              <span>ID</span>
              <span className="font-mono text-slate-800 text-xs">{selectedNode.id}</span>
            </div>
            <div className="flex justify-between">
              <span>层级</span>
              <span className="text-slate-800">L{selectedNode.level}</span>
            </div>
            <div className="flex justify-between">
              <span>类型</span>
              <span className="text-slate-800">{selectedNode.isLeaf ? '叶子节点' : '内部节点'}</span>
            </div>
            <div className="flex justify-between">
              <span>Key 数量</span>
              <span className="text-slate-800 font-mono">{selectedNode.keys.length} / {frame.order - 1}</span>
            </div>
            <div>
              <span>Keys</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {selectedNode.keys.map((k) => (
                  <span key={k} className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-xs">{k}</span>
                ))}
                {selectedNode.keys.length === 0 && <span className="text-slate-400 text-xs">无</span>}
              </div>
            </div>
            <div className="flex justify-between">
              <span>子节点数</span>
              <span className="text-slate-800 font-mono">{selectedNode.children.length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
