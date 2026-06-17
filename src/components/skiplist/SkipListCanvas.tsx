import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { SkipListState } from '@/structures/skiplist/types';
import { cn } from '@/lib/utils';

interface Props { frame: SkipListState | null; }

const NODE_W = 48, NODE_H = 32, GAP_X = 50, GAP_Y = 48;

export default function SkipListCanvas({ frame }: Props) {
  const layout = useMemo(() => {
    if (!frame) return null;
    const { nodes, headId, maxLevel } = frame;
    const order: string[] = [];
    let cur: string | null = headId;
    while (cur) {
      order.push(cur);
      cur = nodes[cur]?.forward[0] ?? null;
    }
    const positions: Record<string, { x: number; y: number }> = {};
    order.forEach((id, idx) => {
      const n = nodes[id];
      if (!n) return;
      positions[id] = { x: idx * (NODE_W + GAP_X), y: (maxLevel - 1 - n.level) * (NODE_H + GAP_Y) };
    });
    return { order, positions, maxLevel, width: (order.length + 1) * (NODE_W + GAP_X), height: maxLevel * (NODE_H + GAP_Y) + 80 };
  }, [frame]);

  if (!frame || !layout) {
    return <div className="flex items-center justify-center h-full text-slate-400">插入数据开始可视化</div>;
  }

  const { nodes, headId, maxLevel, highlighting, levelCounts } = frame;
  const pathSet = new Set((highlighting.path || []).map((p) => `${p.nodeId}-${p.level}`));

  return (
    <div className="h-full overflow-auto p-6">
      {highlighting.coinFlip && (
        <div className="mb-4 inline-flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-300 rounded-lg">
          <span className="text-2xl">{highlighting.coinFlip === 'heads' ? '🪙 正面' : '🪙 反面'}</span>
          <span className="text-sm text-yellow-800">上升到 L{highlighting.newLevels || 1} 层</span>
        </div>
      )}

      <svg width={Math.max(600, layout.width)} height={Math.max(400, layout.height)} className="block">
        {Array.from({ length: maxLevel }).map((_, li) => {
          const lvl = maxLevel - 1 - li;
          return (
            <g key={`layer-${lvl}`}>
              <text x={0} y={li * (NODE_H + GAP_Y) + NODE_H / 2 + 4} fontSize={11} fill="#94a3b8">L{lvl}</text>
              {layout.order.map((id) => {
                const n = nodes[id];
                if (!n || n.level < lvl) return null;
                const nextId = n.forward[lvl];
                if (!nextId) return null;
                const from = layout.positions[id];
                const to = layout.positions[nextId];
                if (!from || !to) return null;
                const inPath = pathSet.has(`${id}-${lvl}`);
                return (
                  <line
                    key={`${id}-${lvl}`}
                    x1={from.x + NODE_W}
                    y1={li * (NODE_H + GAP_Y) + NODE_H / 2}
                    x2={to.x}
                    y2={li * (NODE_H + GAP_Y) + NODE_H / 2}
                    stroke={inPath ? '#2563eb' : '#cbd5e1'}
                    strokeWidth={inPath ? 2.5 : 1.5}
                    markerEnd={inPath ? 'url(#arr-blue)' : undefined}
                  />
                );
              })}
            </g>
          );
        })}

        <defs>
          <marker id="arr-blue" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="#2563eb" />
          </marker>
        </defs>
      </svg>

      <div className="relative" style={{ width: Math.max(600, layout.width), height: Math.max(400, layout.height), marginTop: -Math.max(400, layout.height) }}>
        {layout.order.map((id) => {
          const n = nodes[id];
          const pos = layout.positions[id];
          if (!n || !pos) return null;
          const isHead = id === headId;
          const isFound = highlighting.foundNodeId === id;
          const inPath = (highlighting.path || []).some((p) => p.nodeId === id);

          return (
            <motion.div
              key={id}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={cn(
                'absolute rounded-md border-2 flex items-center justify-center font-mono text-sm font-semibold',
                isHead ? 'bg-slate-800 text-white border-slate-900' : '',
                !isHead && isFound ? 'bg-green-500 text-white border-green-600' : '',
                !isHead && !isFound && inPath ? 'bg-blue-100 text-blue-800 border-blue-400' : '',
                !isHead && !isFound && !inPath ? 'bg-white text-slate-700 border-slate-300' : ''
              )}
              style={{ left: pos.x, top: pos.y, width: NODE_W, height: (n.level + 1) * NODE_H + n.level * GAP_Y }}
            >
              {isHead ? 'HEAD' : n.key === -Infinity ? '-∞' : n.key}
            </motion.div>
          );
        })}
      </div>

      <div className="mt-8 card p-4 max-w-md">
        <h4 className="text-sm font-semibold mb-2">节点层高分布</h4>
        <div className="flex items-end gap-1 h-32">
          {levelCounts.map((c, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-purple-500 rounded-t"
                style={{ height: `${(c / Math.max(1, ...levelCounts)) * 100}%`, minHeight: c > 0 ? 4 : 0 }}
                title={`${c} 个`}
              />
              <span className="text-xs text-slate-500">L{i}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
