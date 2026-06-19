import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMVCCStore } from '@/store/mvccStore';
import { INITIAL_ROWS, NODE_WIDTH, NODE_HEIGHT, NODE_GAP, SVG_PADDING } from '@/structures/mvcc/types';
import type { Version, TxnStatus } from '@/structures/mvcc/types';
import { cn } from '@/lib/utils';

const xminColors: Record<TxnStatus, string> = {
  active: '#3b82f6',
  committed: '#10b981',
  aborted: '#ef4444',
};

const xminBgColors: Record<TxnStatus, string> = {
  active: '#eff6ff',
  committed: '#ecfdf5',
  aborted: '#fef2f2',
};

function getNodeX(index: number) {
  return SVG_PADDING + index * (NODE_WIDTH + NODE_GAP);
}

function getRowY(rowIdx: number) {
  return SVG_PADDING + rowIdx * (NODE_HEIGHT + 50) + 30;
}

function VersionNode({
  version,
  x,
  y,
  isFirst,
  isLast,
}: {
  version: Version;
  x: number;
  y: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  const rx = 10;
  const borderColor = xminColors[version.xminStatus];
  const bgColor = version.isHighlighted ? '#fef3c7' : xminBgColors[version.xminStatus];

  return (
    <motion.g
      initial={version.isNew ? { x: x - NODE_WIDTH - NODE_GAP, opacity: 0 } : false}
      animate={{
        x: 0,
        opacity: version.isRemoving ? 0 : 1,
        scale: version.isRemoving ? 0.8 : 1,
      }}
      exit={{ opacity: 0, scale: 0.8, x: x + NODE_WIDTH + NODE_GAP }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{ transformOrigin: `${x + NODE_WIDTH / 2}px ${y + NODE_HEIGHT / 2}px` }}
    >
      <motion.rect
        x={x}
        y={y}
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        rx={rx}
        fill={bgColor}
        stroke={borderColor}
        strokeWidth={version.isHighlighted ? 3 : 2}
        initial={false}
        animate={{
          strokeWidth: version.isHighlighted ? 3 : 2,
          fill: version.isHighlighted ? '#fef3c7' : xminBgColors[version.xminStatus],
        }}
        transition={{ duration: 0.3 }}
        filter={version.isHighlighted ? 'url(#highlight-shadow)' : undefined}
      />

      {isFirst && (
        <g>
          <rect x={x + 6} y={y + 6} width={48} height={18} rx={4} fill={borderColor} opacity={0.9} />
          <text x={x + 30} y={y + 19} textAnchor="middle" fontSize="10" fill="white" fontWeight="bold">
            最新版本
          </text>
        </g>
      )}

      <text x={x + NODE_WIDTH / 2} y={y + 38} textAnchor="middle" fontSize="13" fontWeight="bold" fill="#1e293b">
        {version.name}
      </text>
      <text x={x + NODE_WIDTH / 2} y={y + 56} textAnchor="middle" fontSize="14" fontWeight="bold" fill="#0f172a">
        ¥{version.balance.toLocaleString()}
      </text>

      <line x1={x + 10} y1={y + 68} x2={x + NODE_WIDTH - 10} y2={y + 68} stroke="#cbd5e1" strokeWidth={1} />

      <text x={x + 12} y={y + 84} fontSize="10" fill="#64748b">
        <tspan fill="#94a3b8">创建:</tspan>
        <tspan fill={borderColor} fontWeight="bold"> T{version.xmin}</tspan>
        <tspan fill="#94a3b8"> · </tspan>
        <tspan
          fill={xminColors[version.xminStatus]}
          fontWeight="600"
        >
          {version.xminStatus === 'active' ? '活跃' : version.xminStatus === 'committed' ? '已提交' : '已回滚'}
        </tspan>
      </text>

      <text x={x + 12} y={y + 99} fontSize="10" fill="#64748b">
        <tspan fill="#94a3b8">[{version.xmin},</tspan>
        <tspan fill={version.xmax ? '#f59e0b' : '#94a3b8'} fontWeight="600">
          {version.xmax ? ` T${version.xmax}` : ' ∞'}
        </tspan>
        <tspan fill="#94a3b8">)</tspan>
        {version.xmax && (
          <tspan
            fill={version.xmaxStatus ? xminColors[version.xmaxStatus] : '#94a3b8'}
            fontWeight="500"
          >
            {' '}{version.xmaxStatus === 'active' ? '活跃' : version.xmaxStatus === 'committed' ? '已删' : '回滚'}
          </tspan>
        )}
      </text>
    </motion.g>
  );
}

function Arrow({ fromX, fromY, toX, toY }: { fromX: number; fromY: number; toX: number; toY: number }) {
  const midY = fromY;
  return (
    <g>
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <polygon points="0 0, 8 4, 0 8" fill="#94a3b8" />
        </marker>
      </defs>
      <line
        x1={fromX}
        y1={midY}
        x2={toX}
        y2={midY}
        stroke="#94a3b8"
        strokeWidth={2}
        markerEnd="url(#arrowhead)"
      />
    </g>
  );
}

export default function VersionChainView() {
  const { versions } = useMVCCStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [maxWidth, setMaxWidth] = useState(800);

  useEffect(() => {
    let maxLen = 0;
    for (const vList of versions.values()) {
      maxLen = Math.max(maxLen, vList.length);
    }
    const w = SVG_PADDING * 2 + maxLen * NODE_WIDTH + Math.max(0, maxLen - 1) * NODE_GAP;
    setMaxWidth(Math.max(800, w));
  }, [versions]);

  const svgHeight = SVG_PADDING * 2 + INITIAL_ROWS.length * (NODE_HEIGHT + 50) - 20;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">版本链可视化</h3>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> 活跃事务创建
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> 已提交
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> 已回滚
          </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto overflow-y-hidden rounded-lg border border-slate-200 bg-slate-50/50 min-h-0"
      >
        <svg
          width={maxWidth}
          height={svgHeight}
          className="block"
          style={{ minWidth: '100%' }}
        >
          <defs>
            <filter id="highlight-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#f59e0b" floodOpacity="0.6" />
            </filter>
            <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <polygon points="0 0, 8 4, 0 8" fill="#94a3b8" />
            </marker>
          </defs>

          {INITIAL_ROWS.map((row, rowIdx) => {
            const versionList = versions.get(row.id) || [];
            const rowY = getRowY(rowIdx);

            return (
              <g key={row.id}>
                <rect
                  x={0}
                  y={rowY - 28}
                  width={maxWidth}
                  height={NODE_HEIGHT + 40}
                  fill={rowIdx % 2 === 0 ? '#fafafa' : '#ffffff'}
                />
                <text
                  x={SVG_PADDING}
                  y={rowY - 8}
                  fontSize="12"
                  fontWeight="bold"
                  fill="#475569"
                >
                  #{row.id} {row.name} 的版本链
                </text>
                <text
                  x={SVG_PADDING + 120}
                  y={rowY - 8}
                  fontSize="10"
                  fill="#94a3b8"
                >
                  （共 {versionList.length} 个版本，从新→旧）
                </text>

                {versionList.map((v, i) => {
                  const nodeX = getNodeX(i);
                  const isFirst = i === 0;
                  const isLast = i === versionList.length - 1;

                  return (
                    <g key={v.versionId}>
                      <VersionNode
                        version={v}
                        x={nodeX}
                        y={rowY}
                        isFirst={isFirst}
                        isLast={isLast}
                      />
                      {!isLast && (
                        <Arrow
                          fromX={nodeX + NODE_WIDTH}
                          fromY={rowY + NODE_HEIGHT / 2}
                          toX={getNodeX(i + 1) - 10}
                          toY={rowY + NODE_HEIGHT / 2}
                        />
                      )}
                    </g>
                  );
                })}

                {versionList.length === 0 && (
                  <text
                    x={SVG_PADDING}
                    y={rowY + NODE_HEIGHT / 2}
                    fontSize="12"
                    fill="#cbd5e1"
                    fontStyle="italic"
                  >
                    暂无版本数据
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
        <span>← 新（链表头）　　旧（链表尾） →</span>
        <span>水平滚动查看长版本链</span>
      </div>
    </div>
  );
}
