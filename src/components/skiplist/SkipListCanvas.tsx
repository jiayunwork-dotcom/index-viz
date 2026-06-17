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
  const maxCount = levelCounts.length > 0 ? Math.max(...levelCounts, 1) : 1;

  return (
    <div className="h-full flex gap-4 overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
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
      </div>

      <div className="w-64 flex-shrink-0 border-l border-slate-200 bg-white p-4 overflow-y-auto">
        <h4 className="text-sm font-semibold text-slate-800 mb-3">📊 层节点数量分布</h4>
        <div className="space-y-2">
          {levelCounts.map((count, i) => {
            const pct = (count / maxCount) * 100;
            const theoretical = i === 0 ? 1 : Math.pow(frame.probability, i);
            const totalNodes = levelCounts[0] || 1;
            const theoreticalCount = Math.round(theoretical * totalNodes);
            return (
              <div key={i}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-mono text-slate-600 font-semibold">L{i}</span>
                  <span className="text-slate-500">
                    {count} 个
                    <span className="text-slate-400 ml-1">(理论≈{theoreticalCount})</span>
                  </span>
                </div>
                <div className="h-5 bg-slate-100 rounded-full overflow-hidden relative">
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    style={{
                      background: `linear-gradient(90deg, #8b5cf6 ${0}%, #a78bfa ${100}%)`,
                    }}
                  />
                  {count > 0 && pct < 40 && (
                    <span className="absolute right-1 top-0.5 text-xs font-mono text-slate-500">{count}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-200">
          <h4 className="text-sm font-semibold text-slate-800 mb-2">概率分布</h4>
          <div className="text-xs text-slate-500 space-y-1">
            <p>升层概率 p = {frame.probability}</p>
            <p>Lk 层节点数 ≈ n·p<sup>k</sup></p>
            <div className="mt-2 flex items-end gap-1 h-20">
              {levelCounts.map((_, i) => {
                const theoretical = Math.pow(frame.probability, i);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-purple-300 rounded-t"
                      style={{ height: `${theoretical * 100}%`, minHeight: 2 }}
                    />
                    <span className="text-xs text-slate-400 mt-1">L{i}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-slate-400 mt-1">理论概率分布 (1, p, p², p³, ...)</p>
          </div>
        </div>

        {levelCounts[0] > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <h4 className="text-sm font-semibold text-slate-800 mb-2">统计摘要</h4>
            <div className="text-xs text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span>总节点数</span>
                <span className="font-mono font-semibold">{levelCounts.reduce((a, b) => a + b, 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>底层节点数</span>
                <span className="font-mono font-semibold">{levelCounts[0]}</span>
              </div>
              <div className="flex justify-between">
                <span>最大层高</span>
                <span className="font-mono font-semibold">L{levelCounts.length - 1}</span>
              </div>
              <div className="flex justify-between">
                <span>期望层高</span>
                <span className="font-mono font-semibold">{(Math.log2(levelCounts[0]) * Math.log(1 / frame.probability)).toFixed(1)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
