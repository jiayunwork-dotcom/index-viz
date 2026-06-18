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
  subtreeWidth: number;
}

const K_W = 40;
const K_H = 34;
const K_GAP = 4;
const PAD_X = 10;
const PAD_Y = 8;
const LV_GAP = 120;
const ND_GAP = 60;
const SIBLING_GAP = 70;
const SUBTREE_GAP = 30;

function nodeW(nKeys: number): number {
  const c = Math.max(nKeys, 1);
  return PAD_X * 2 + c * K_W + (c - 1) * K_GAP;
}

interface Contour {
  left: number[];
  right: number[];
}

function layoutTree(
  nodes: Record<string, BTreeNodeData>,
  rootId: string | null
): LaidOutNode[] {
  if (!rootId || !nodes[rootId]) return [];
  const result: LaidOutNode[] = [];
  const nodeData: Record<string, { x: number; y: number; width: number; centerX: number; contour: Contour; depth: number }> = {};

  const mergeContours = (childContours: Contour[], gaps: number[]): Contour => {
    if (childContours.length === 0) return { left: [], right: [] };
    
    const maxDepth = Math.max(...childContours.map(c => Math.max(c.left.length, c.right.length)));
    const left: number[] = [];
    const right: number[] = [];
    
    for (let d = 0; d < maxDepth; d++) {
      let minL = Infinity;
      let maxR = -Infinity;
      for (let i = 0; i < childContours.length; i++) {
        const cc = childContours[i];
        const gap = gaps[i] || 0;
        if (cc.left[d] !== undefined) minL = Math.min(minL, cc.left[d] + gap);
        if (cc.right[d] !== undefined) maxR = Math.max(maxR, cc.right[d] + gap);
      }
      left.push(minL === Infinity ? 0 : minL);
      right.push(maxR === -Infinity ? 0 : maxR);
    }
    return { left, right };
  };

  const layout = (id: string, depth: number): { centerX: number; contour: Contour } => {
    const nd = nodes[id];
    if (!nd) return { centerX: 0, contour: { left: [], right: [] } };

    const selfW = nodeW(nd.keys.length);
    const y = depth * (K_H + PAD_Y * 2 + LV_GAP) + 30;
    const nodeH = K_H + PAD_Y * 2;

    if (nd.children.length === 0) {
      const contour: Contour = {
        left: [-selfW / 2],
        right: [selfW / 2],
      };
      nodeData[id] = { x: 0, y, width: selfW, centerX: 0, contour, depth };
      return { centerX: 0, contour };
    }

    const childResults: { centerX: number; contour: Contour; id: string; width: number }[] = [];
    const childGaps: number[] = [0];
    let currentX = 0;

    for (let i = 0; i < nd.children.length; i++) {
      const cid = nd.children[i];
      const cr = layout(cid, depth + 1);
      const childNd = nodes[cid];
      const childW = nodeW(childNd ? childNd.keys.length : 1);
      
      if (i > 0) {
        const prev = childResults[i - 1];
        const checkDepth = Math.min(prev.contour.right.length, cr.contour.left.length);
        let maxOverlap = 0;
        for (let d = 0; d < checkDepth; d++) {
          const prevRight = prev.contour.right[d] + childGaps[i - 1];
          const currLeft = cr.contour.left[d];
          const overlap = prevRight + SIBLING_GAP - currLeft;
          if (overlap > maxOverlap) maxOverlap = overlap;
        }
        if (maxOverlap > 0) {
          const shift = maxOverlap + SUBTREE_GAP;
          currentX += shift;
        } else {
          currentX += SIBLING_GAP;
        }
      }
      
      childGaps.push(currentX);
      childResults.push({ centerX: cr.centerX + currentX, contour: cr.contour, id: cid, width: childW });
    }

    const firstChild = childResults[0];
    const lastChild = childResults[childResults.length - 1];
    const childrenCenter = (firstChild.centerX + lastChild.centerX) / 2;
    const selfCenterX = 0;
    const shift = selfCenterX - childrenCenter;

    for (let i = 0; i < childResults.length; i++) {
      const cr = childResults[i];
      const newX = cr.centerX + shift;
      const shiftedContour: Contour = {
        left: cr.contour.left.map(v => v + newX),
        right: cr.contour.right.map(v => v + newX),
      };
      nodeData[cr.id].centerX = newX;
      nodeData[cr.id].x = newX - nodeData[cr.id].width / 2;
      nodeData[cr.id].contour = shiftedContour;
      for (let d = 0; d < shiftedContour.left.length; d++) {
        shiftedContour.left[d] -= selfCenterX;
        shiftedContour.right[d] -= selfCenterX;
      }
      childResults[i] = { ...cr, centerX: newX, contour: shiftedContour };
    }

    const childContours = childResults.map(cr => cr.contour);
    const gapsForMerge = childResults.map((_, i) => 0);
    const mergedContour = mergeContours(childContours, gapsForMerge);
    
    const selfLeft = -selfW / 2;
    const selfRight = selfW / 2;
    const finalContour: Contour = {
      left: [selfLeft, ...mergedContour.left],
      right: [selfRight, ...mergedContour.right],
    };

    nodeData[id] = { x: -selfW / 2, y, width: selfW, centerX: 0, contour: finalContour, depth };
    return { centerX: 0, contour: finalContour };
  };

  layout(rootId, 0);

  let minX = Infinity;
  Object.values(nodeData).forEach((nd) => { minX = Math.min(minX, nd.x); });
  const xOffset = minX < 20 ? 20 - minX : 50;
  
  Object.keys(nodeData).forEach((id) => {
    const nd = nodeData[id];
    const laid: LaidOutNode = {
      ...nodes[id],
      x: nd.x + xOffset,
      y: nd.y,
      width: nd.width,
      centerX: nd.centerX + xOffset,
      subtreeWidth: nd.contour.right[0] - nd.contour.left[0],
    };
    result.push(laid);
  });

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
  const prevNodesRef = useRef<Set<string>>(new Set());

  const { laidOut, bounds, highlights, nodeMap } = useMemo(() => {
    if (!frame) return {
      laidOut: [] as LaidOutNode[],
      bounds: { w: 0, h: 0 },
      highlights: {} as Record<string, HighlightType>,
      nodeMap: {} as Record<string, LaidOutNode>,
    };
    const laid = layoutTree(frame.nodes, frame.rootId);
    let maxX = 0, maxY = 0;
    laid.forEach((n) => {
      maxX = Math.max(maxX, n.x + n.width + 40);
      maxY = Math.max(maxY, n.y + nodeH + 40);
    });
    const hl: Record<string, HighlightType> = {};
    if (frame.type && frame.nodeId && frame.nodes[frame.nodeId]) {
      hl[frame.nodeId] = frame.type;
    }
    if (frame.type === 'splitting' && frame.splitInfo) {
      if (frame.nodes[frame.splitInfo.leftId]) hl[frame.splitInfo.leftId] = 'splitting';
      if (frame.nodes[frame.splitInfo.rightId]) hl[frame.splitInfo.rightId] = 'splitting';
    }
    if (frame.type === 'inserting' && frame.splitInfo) {
      if (frame.nodes[frame.splitInfo.leftId]) hl[frame.splitInfo.leftId] = 'inserting';
      if (frame.nodes[frame.splitInfo.rightId]) hl[frame.splitInfo.rightId] = 'inserting';
    }
    if (frame.path) frame.path.forEach((p) => { if (frame.nodes[p] && !hl[p]) hl[p] = 'searching'; });
    const nm: Record<string, LaidOutNode> = {};
    laid.forEach((n) => { nm[n.id] = n; });
    return { laidOut: laid, bounds: { w: maxX, h: maxY }, highlights: hl, nodeMap: nm };
  }, [frame, nodeH]);

  useEffect(() => {
    prevNodesRef.current = new Set(laidOut.map((n) => n.id));
  }, [laidOut]);

  if (!frame) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        插入数据开始可视化
      </div>
    );
  }

  const svgW = Math.max(800, bounds.w);
  const svgH = Math.max(400, bounds.h);

  const splitNode = frame.type === 'splitting' && frame.nodeId ? nodeMap[frame.nodeId] : null;
  const hasSplitInfo = frame.splitInfo != null && frame.insertingKey != null;
  
  let upKeyStartY = 100;
  let upKeyX = 100;
  let upKeyEndY = 40;
  let upKeyEndX = 100;
  let hasValidUpKeyCoords = false;

  if (splitNode && typeof splitNode.y === 'number' && typeof splitNode.centerX === 'number') {
    upKeyStartY = splitNode.y + nodeH / 2;
    upKeyX = splitNode.centerX;
    upKeyEndY = splitNode.y - 32;
    upKeyEndX = splitNode.centerX;
    hasValidUpKeyCoords = true;
  } else if (hasSplitInfo) {
    const left = nodeMap[frame.splitInfo!.leftId];
    const right = nodeMap[frame.splitInfo!.rightId];
    if (left && right && 
        typeof left.y === 'number' && typeof left.centerX === 'number' &&
        typeof right.y === 'number' && typeof right.centerX === 'number') {
      upKeyStartY = (left.y + right.y) / 2;
      upKeyX = (left.centerX + right.centerX) / 2;
      upKeyEndY = Math.min(left.y, right.y) - LV_GAP / 2;
      upKeyEndX = upKeyX;
      hasValidUpKeyCoords = true;
    } else if (frame.nodeId && nodeMap[frame.nodeId]) {
      const node = nodeMap[frame.nodeId];
      if (typeof node.y === 'number' && typeof node.centerX === 'number') {
        upKeyStartY = node.y + nodeH / 2;
        upKeyX = node.centerX;
        upKeyEndY = node.y - 32;
        upKeyEndX = node.centerX;
        hasValidUpKeyCoords = true;
      }
    }
  }

  const showUpKey = hasValidUpKeyCoords && frame.insertingKey != null;

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
            <feGaussianBlur stdDeviation="5" result="b" />
            <feFlood floodColor="#ef4444" floodOpacity="0.9" result="red" />
            <feComposite in="red" in2="b" operator="in" result="redglow" />
            <feMerge>
              <feMergeNode in="redglow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="bt-glow-green" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
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
                  x1={exitX}
                  y1={node.y + nodeH}
                  x2={child.centerX}
                  y2={child.y}
                  stroke={onPath ? '#3b82f6' : '#94a3b8'}
                  strokeWidth={onPath ? 2.5 : 1.5}
                  markerEnd={onPath ? 'url(#bt-edge-blue)' : 'url(#bt-edge)'}
                  transition={{ duration: 0.45, ease: 'easeInOut' }}
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
                x1={from.x + from.width}
                y1={midY}
                x2={to.x - 2}
                y2={midY}
                stroke="#0ea5e9"
                strokeWidth={2}
                strokeDasharray="5 3"
                markerEnd="url(#bt-chain)"
                transition={{ duration: 0.45 }}
              />
            );
          })}
        </g>

        <g>
          {laidOut.map((node) => {
            const hl = highlights[node.id];
            const cs = colorsOf(hl);
            const isSelected = selectedId === node.id;
            const isSplitting = hl === 'splitting';
            const isFound = hl === 'found';
            const isInserting = hl === 'inserting';

            return (
              <g key={node.id}>
                <motion.rect
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={nodeH}
                  rx={8}
                  fill={cs.fill}
                  stroke={cs.stroke}
                  strokeWidth={isSplitting || isFound ? 3.5 : 2}
                  filter={isSplitting ? 'url(#bt-glow-red)' : isFound ? 'url(#bt-glow-green)' : 'none'}
                  style={{ cursor: 'pointer', transformOrigin: `${node.centerX}px ${node.y + nodeH / 2}px` }}
                  animate={{
                    scale: isSplitting ? [1, 1.1, 1, 1.1, 1] : 1,
                  }}
                  transition={{
                    x: { duration: 0.45, ease: 'easeInOut' },
                    y: { duration: 0.45, ease: 'easeInOut' },
                    width: { duration: 0.45, ease: 'easeInOut' },
                    height: { duration: 0.45, ease: 'easeInOut' },
                    fill: { duration: 0.3 },
                    stroke: { duration: 0.3 },
                    strokeWidth: { duration: 0.25 },
                    filter: { duration: 0.25 },
                    scale: { duration: isSplitting ? 0.7 : 0.3, repeat: isSplitting ? Infinity : 0, repeatType: 'loop' },
                  }}
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
                    transition={{ x: 0.45, y: 0.45, width: 0.45, height: 0.45 }}
                  />
                )}

                {node.keys.map((k, ki) => {
                  const kx = node.x + PAD_X + ki * (K_W + K_GAP);
                  const ky = node.y + PAD_Y;
                  const isKHi =
                    (hl === 'found' && frame.insertingKey != null && k === frame.insertingKey) ||
                    (hl === 'inserting' && frame.insertingKey != null && k === frame.insertingKey) ||
                    (isSplitting && frame.insertingKey != null && k === frame.insertingKey);

                  return (
                    <g key={`k-${node.id}-${ki}`}>
                      <motion.rect
                        x={kx}
                        y={ky}
                        width={K_W}
                        height={K_H}
                        rx={6}
                        fill={isKHi ? '#ef4444' : cs.key}
                        animate={{
                          scale: isKHi ? [1, 1.25, 1, 1.25, 1] : 1,
                        }}
                        transition={{
                          x: { duration: 0.45, ease: 'easeInOut' },
                          y: { duration: 0.45, ease: 'easeInOut' },
                          fill: { duration: 0.3 },
                          scale: { duration: isKHi ? 0.6 : 0.3, repeat: isKHi ? 2 : 0 },
                        }}
                        style={{ transformOrigin: `${kx + K_W / 2}px ${ky + K_H / 2}px` }}
                      />
                      <motion.text
                        x={kx + K_W / 2}
                        y={ky + K_H / 2 + 5}
                        textAnchor="middle"
                        fontSize="14"
                        fontWeight="600"
                        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                        fill={isKHi ? '#ffffff' : cs.keyText}
                        transition={{ x: 0.45, y: 0.45, fill: 0.3 }}
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
        </g>

        {showUpKey && (
          <g key={`upkey-${frame.insertingKey}-${frame.nodeId || 'split'}`}>
            <motion.circle
              cx={upKeyX}
              cy={upKeyStartY}
              r={18}
              fill="#ef4444"
              style={{ transformOrigin: `${upKeyEndX}px ${upKeyEndY}px` }}
              animate={{
                cx: upKeyEndX,
                cy: upKeyEndY,
                opacity: [0, 1, 1, 0.95],
              }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
            />
            <motion.text
              x={upKeyX}
              y={upKeyStartY + 5}
              textAnchor="middle"
              fontSize="14"
              fontWeight="700"
              fill="white"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              animate={{
                x: upKeyEndX,
                y: upKeyEndY + 5,
                opacity: [0, 1, 1, 0.95],
              }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
            >
              {frame.insertingKey}
            </motion.text>
            <motion.path
              d={`M ${upKeyX} ${upKeyStartY} Q ${upKeyX + 30} ${(upKeyStartY + upKeyEndY) / 2 - 20}, ${upKeyEndX} ${upKeyEndY + 18}`}
              stroke="#ef4444"
              strokeWidth={2.5}
              strokeDasharray="5 3"
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.6 }}
              transition={{ duration: 0.7, delay: 0.05 }}
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
            >
              ←
            </motion.text>
          );
        })()}
      </svg>

      {selectedId && frame.nodes[selectedId] && (
        <div className="absolute top-2 right-2 bg-white shadow-lg rounded-lg p-3 border border-slate-200 text-xs">
          <div className="font-semibold text-slate-700 mb-1">节点信息</div>
          <div className="text-slate-500 space-y-0.5">
            <div>ID: {frame.nodes[selectedId].id}</div>
            <div>层: {frame.nodes[selectedId].level}</div>
            <div>Keys: {frame.nodes[selectedId].keys.join(', ') || '空'}</div>
            <div>子节点: {frame.nodes[selectedId].children.length}</div>
            <div>类型: {frame.nodes[selectedId].isLeaf ? '叶子' : '内部'}</div>
          </div>
        </div>
      )}
    </div>
  );
}
