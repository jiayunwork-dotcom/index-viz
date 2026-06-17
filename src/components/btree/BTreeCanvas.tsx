import { useMemo, useState } from 'react';
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
  leafChain: { from: string; to: string }[];
}

interface BTreeCanvasProps {
  frame: FrameData | null;
}

interface LaidOutNode extends BTreeNodeData {
  x: number;
  y: number;
  width: number;
}

const NODE_PADDING_X = 12;
const NODE_PADDING_Y = 10;
const KEY_WIDTH = 36;
const KEY_GAP = 4;
const LEVEL_GAP = 90;
const NODE_GAP = 30;

function nodeWidth(keys: number[]): number {
  return NODE_PADDING_X * 2 + keys.length * KEY_WIDTH + (keys.length - 1) * KEY_GAP;
}

function layoutTree(
  nodes: Record<string, BTreeNodeData>,
  rootId: string | null
): LaidOutNode[] {
  if (!rootId) return [];

  const result: LaidOutNode[] = [];

  const layout = (nodeId: string, depth: number, offsetX: number): { width: number; offset: number } => {
    const node = nodes[nodeId];
    if (!node) return { width: 0, offset: 0 };

    let totalWidth = 0;
    const childOffsets: number[] = [];

    node.children.forEach((childId, i) => {
      const r = layout(childId, depth + 1, offsetX + totalWidth);
      childOffsets.push(r.offset);
      if (i > 0) totalWidth += NODE_GAP;
      totalWidth += r.width;
    });

    const selfWidth = nodeWidth(node.keys);
    const finalWidth = Math.max(totalWidth, selfWidth);

    let centerX: number;
    if (totalWidth === 0) {
      centerX = offsetX + finalWidth / 2;
    } else {
      const childCenter = (childOffsets[0] + childOffsets[childOffsets.length - 1]) / 2;
      centerX = childCenter;
    }

    result.push({
      ...node,
      x: centerX - selfWidth / 2,
      y: depth * (60 + LEVEL_GAP) + 30,
      width: selfWidth,
    });

    return { width: finalWidth, offset: centerX };
  };

  layout(rootId, 0, 0);
  return result;
}

function highlightColor(type: HighlightType | undefined): string {
  switch (type) {
    case 'searching': return 'border-blue-500 bg-blue-50 shadow-[0_0_0_3px_rgba(59,130,246,0.3)]';
    case 'splitting': return 'border-red-500 bg-red-50 shadow-[0_0_0_3px_rgba(239,68,68,0.3)] animate-pulse';
    case 'merging': return 'border-orange-500 bg-orange-50 shadow-[0_0_0_3px_rgba(249,115,22,0.3)]';
    case 'borrowing': return 'border-amber-500 bg-amber-50 shadow-[0_0_0_3px_rgba(245,158,11,0.3)]';
    case 'found': return 'border-green-500 bg-green-50 shadow-[0_0_0_3px_rgba(34,197,94,0.4)]';
    case 'inserting': return 'border-emerald-500 bg-emerald-50 shadow-[0_0_0_3px_rgba(16,185,129,0.3)]';
    default: return 'border-slate-300 bg-white';
  }
}

export default function BTreeCanvas({ frame }: BTreeCanvasProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { laidOut, bounds, highlights } = useMemo(() => {
    if (!frame) return { laidOut: [] as LaidOutNode[], bounds: { w: 0, h: 0 }, highlights: {} as Record<string, HighlightType> };
    const laid = layoutTree(frame.nodes, frame.rootId);
    let maxX = 0, maxY = 0;
    laid.forEach((n) => {
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + 60);
    });
    const hl: Record<string, HighlightType> = {};
    if (frame.type && frame.nodeId) hl[frame.nodeId] = frame.type;
    if (frame.path) frame.path.forEach((p) => { if (!hl[p]) hl[p] = 'searching'; });
    return { laidOut: laid, bounds: { w: maxX + 40, h: maxY + 40 }, highlights: hl };
  }, [frame]);

  if (!frame) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        插入数据开始可视化
      </div>
    );
  }

  const selectedNode = selectedId ? frame.nodes[selectedId] : null;

  return (
    <div className="relative h-full overflow-auto bg-slate-50">
      <svg
        width={Math.max(800, bounds.w)}
        height={Math.max(400, bounds.h)}
        className="block"
      >
        {frame.leafChain?.map((link, i) => {
          const from = laidOut.find((n) => n.id === link.from);
          const to = laidOut.find((n) => n.id === link.to);
          if (!from || !to) return null;
          const y1 = from.y + 30;
          const y2 = to.y + 30;
          return (
            <line
              key={`chain-${i}`}
              x1={from.x + from.width}
              y1={y1}
              x2={to.x}
              y2={y2}
              stroke="#0ea5e9"
              strokeWidth={2}
              strokeDasharray="6 4"
              markerEnd="url(#arrow-sky)"
            />
          );
        })}

        {laidOut.map((node) =>
          node.children.map((childId, i) => {
            const child = laidOut.find((n) => n.id === childId);
            if (!child) return null;
            return (
              <line
                key={`${node.id}-${i}`}
                x1={node.x + (node.width / (node.children.length + 1)) * (i + 1)}
                y1={node.y + 48}
                x2={child.x + child.width / 2}
                y2={child.y}
                stroke="#94a3b8"
                strokeWidth={1.5}
              />
            );
          })
        )}

        <defs>
          <marker id="arrow-sky" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#0ea5e9" />
          </marker>
        </defs>
      </svg>

      <div className="absolute inset-0 pointer-events-none">
        <AnimatePresence>
          {laidOut.map((node) => {
            const hl = highlights[node.id];
            const isSelected = selectedId === node.id;
            return (
              <motion.div
                key={node.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1, x: node.x + 20, y: node.y }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.35 }}
                className={cn(
                  'absolute border-2 rounded-lg flex items-center gap-1 px-3 py-2 pointer-events-auto cursor-pointer',
                  'transition-shadow',
                  highlightColor(hl),
                  isSelected && 'ring-2 ring-primary-500'
                )}
                style={{ width: node.width }}
                onClick={() => setSelectedId(isSelected ? null : node.id)}
              >
                {node.keys.map((k, i) => (
                  <motion.div
                    key={`${node.id}-${k}-${i}`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={cn(
                      'w-9 h-9 flex items-center justify-center rounded font-mono text-sm font-semibold',
                      hl === 'found' ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-800'
                    )}
                  >
                    {k}
                  </motion.div>
                ))}
                {node.keys.length === 0 && (
                  <div className="w-full text-center text-xs text-slate-400">空</div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {selectedNode && (
        <div className="absolute right-4 top-4 card p-4 text-sm pointer-events-auto max-w-xs">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold">节点详情</h4>
            <button onClick={() => setSelectedId(null)} className="text-slate-400 hover:text-slate-600">✕</button>
          </div>
          <div className="space-y-1 text-slate-600">
            <div>ID: <span className="font-mono text-slate-800">{selectedNode.id}</span></div>
            <div>层级: <span className="text-slate-800">L{selectedNode.level}</span></div>
            <div>类型: <span className="text-slate-800">{selectedNode.isLeaf ? '叶子节点' : '内部节点'}</span></div>
            <div>Key数量: <span className="text-slate-800">{selectedNode.keys.length} / {frame.order - 1}</span></div>
            <div>Keys: <span className="font-mono text-slate-800">[{selectedNode.keys.join(', ')}]</span></div>
            <div>子节点数: <span className="text-slate-800">{selectedNode.children.length}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
