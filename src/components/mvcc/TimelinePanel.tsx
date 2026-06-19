import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMVCCStore } from '@/store/mvccStore';
import type { TimelineEvent, TimelineEventType } from '@/structures/mvcc/types';

const eventConfig: Record<TimelineEventType, { icon: string; color: string; bgColor: string; shape: 'circle' | 'square' | 'triangle' | 'diamond' | 'cross' | 'gc'; label: string }> = {
  create: { icon: '●', color: '#3b82f6', bgColor: '#eff6ff', shape: 'circle', label: '创建事务' },
  write: { icon: '■', color: '#f59e0b', bgColor: '#fffbeb', shape: 'square', label: '写入' },
  read: { icon: '▲', color: '#8b5cf6', bgColor: '#f5f3ff', shape: 'triangle', label: '读取' },
  commit: { icon: '◆', color: '#10b981', bgColor: '#ecfdf5', shape: 'diamond', label: '提交' },
  abort: { icon: '✕', color: '#ef4444', bgColor: '#fef2f2', shape: 'cross', label: '回滚' },
  gc: { icon: '🗑', color: '#6366f1', bgColor: '#eef2ff', shape: 'gc', label: 'GC清理' },
};

function EventShape({ type, x, y, size }: { type: TimelineEventType; x: number; y: number; size: number }) {
  const cfg = eventConfig[type];
  const half = size / 2;

  switch (cfg.shape) {
    case 'circle':
      return <circle cx={x} cy={y} r={half} fill={cfg.color} stroke="white" strokeWidth={2} />;
    case 'square':
      return <rect x={x - half} y={y - half} width={size} height={size} fill={cfg.color} stroke="white" strokeWidth={2} rx={2} />;
    case 'triangle':
      return <polygon points={`${x},${y - half} ${x + half},${y + half} ${x - half},${y + half}`} fill={cfg.color} stroke="white" strokeWidth={2} />;
    case 'diamond':
      return <polygon points={`${x},${y - half} ${x + half},${y} ${x},${y + half} ${x - half},${y}`} fill={cfg.color} stroke="white" strokeWidth={2} />;
    case 'cross':
      return (
        <g>
          <circle cx={x} cy={y} r={half} fill={cfg.color} stroke="white" strokeWidth={2} />
          <line x1={x - half * 0.5} y1={y - half * 0.5} x2={x + half * 0.5} y2={y + half * 0.5} stroke="white" strokeWidth={2.5} strokeLinecap="round" />
          <line x1={x + half * 0.5} y1={y - half * 0.5} x2={x - half * 0.5} y2={y + half * 0.5} stroke="white" strokeWidth={2.5} strokeLinecap="round" />
        </g>
      );
    case 'gc':
      return <circle cx={x} cy={y} r={half} fill={cfg.color} stroke="white" strokeWidth={2} />;
    default:
      return <circle cx={x} cy={y} r={half} fill={cfg.color} />;
  }
}

function Tooltip({ event, x, y }: { event: TimelineEvent; x: number; y: number }) {
  const cfg = eventConfig[event.type];
  return (
    <motion.div
      initial={{ opacity: 0, y: 5, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 5, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="absolute z-50 pointer-events-none"
      style={{ left: x, top: y, transform: 'translateX(-50%)' }}
    >
      <div className="bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
          {event.txnNum > 0 && <span className="text-slate-400">T{event.txnNum}</span>}
        </div>
        <div className="text-slate-300 max-w-[250px] break-all">{event.detail}</div>
        <div className="text-slate-500 mt-1 text-[10px]">时间戳: {event.timestamp}</div>
      </div>
      <div className="w-2 h-2 bg-slate-800 rotate-45 mx-auto -mt-1" />
    </motion.div>
  );
}

export default function TimelinePanel() {
  const { timelineEvents, isReplaying, replayIndex, replaySpeed, startReplay, stopReplay, setReplaySpeed } = useMVCCStore();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const PADDING_LEFT = 40;
  const PADDING_RIGHT = 40;
  const EVENT_GAP = 80;
  const SVG_HEIGHT = 120;
  const AXIS_Y = 60;
  const EVENT_SIZE = 14;

  const svgWidth = Math.max(800, PADDING_LEFT + PADDING_RIGHT + timelineEvents.length * EVENT_GAP);

  useEffect(() => {
    if (isReplaying && scrollRef.current) {
      const targetX = replayIndex * EVENT_GAP;
      scrollRef.current.scrollTo({ left: Math.max(0, targetX - 200), behavior: 'smooth' });
    }
  }, [replayIndex, isReplaying]);

  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-700">操作时间线</h3>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {(['create', 'write', 'read', 'commit', 'abort'] as TimelineEventType[]).map((type) => {
              const cfg = eventConfig[type];
              return (
                <span key={type} className="flex items-center gap-1">
                  <span style={{ color: cfg.color }}>{cfg.icon}</span>
                  <span>{cfg.label}</span>
                </span>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">速度</span>
            <input
              type="range"
              min={0.3}
              max={3}
              step={0.1}
              value={replaySpeed}
              onChange={(e) => setReplaySpeed(parseFloat(e.target.value))}
              className="w-20 h-1 bg-slate-200 rounded-full appearance-none cursor-pointer accent-primary-600"
            />
            <span className="text-xs font-mono text-slate-500 w-8">{replaySpeed.toFixed(1)}x</span>
          </div>
          {isReplaying ? (
            <button onClick={stopReplay} className="btn-danger text-xs">
              ⏹ 停止回放
            </button>
          ) : (
            <button
              onClick={startReplay}
              disabled={timelineEvents.length === 0}
              className="btn-primary text-xs"
            >
              ▶ 回放时间线
            </button>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/50 relative"
        style={{ height: SVG_HEIGHT }}
      >
        <svg
          ref={svgRef}
          width={svgWidth}
          height={SVG_HEIGHT}
          className="block"
          style={{ minWidth: '100%' }}
        >
          <line
            x1={PADDING_LEFT}
            y1={AXIS_Y}
            x2={svgWidth - PADDING_RIGHT}
            y2={AXIS_Y}
            stroke="#cbd5e1"
            strokeWidth={2}
          />
          <polygon
            points={`${svgWidth - PADDING_RIGHT},${AXIS_Y} ${svgWidth - PADDING_RIGHT - 8},${AXIS_Y - 4} ${svgWidth - PADDING_RIGHT - 8},${AXIS_Y + 4}`}
            fill="#cbd5e1"
          />

          {timelineEvents.map((event, idx) => {
            const x = PADDING_LEFT + idx * EVENT_GAP + EVENT_GAP / 2;
            const isReplayActive = isReplaying && replayIndex === idx;
            const isReplayPast = isReplaying && idx < replayIndex;

            return (
              <g
                key={event.id}
                onMouseEnter={(e) => {
                  setHoveredIdx(idx);
                  const rect = (e.currentTarget as SVGGElement).getBoundingClientRect();
                  const containerRect = scrollRef.current?.getBoundingClientRect();
                  if (containerRect) {
                    setTooltipPos({
                      x: rect.left - containerRect.left + rect.width / 2,
                      y: -8,
                    });
                  }
                }}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                <line
                  x1={x}
                  y1={AXIS_Y - EVENT_SIZE - 4}
                  x2={x}
                  y2={AXIS_Y}
                  stroke={eventConfig[event.type].color}
                  strokeWidth={1.5}
                  strokeDasharray={isReplayPast ? '0' : '3,3'}
                  opacity={isReplayPast || isReplayActive ? 1 : 0.4}
                />
                <text
                  x={x}
                  y={AXIS_Y + 20}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#94a3b8"
                >
                  T{event.txnNum || '-'}
                </text>
                <text
                  x={x}
                  y={AXIS_Y + 32}
                  textAnchor="middle"
                  fontSize="8"
                  fill="#cbd5e1"
                >
                  ts:{event.timestamp}
                </text>

                <EventShape
                  type={event.type}
                  x={x}
                  y={AXIS_Y - EVENT_SIZE - 8}
                  size={EVENT_SIZE}
                />

                {isReplayActive && (
                  <circle
                    cx={x}
                    cy={AXIS_Y - EVENT_SIZE - 8}
                    r={EVENT_SIZE + 4}
                    fill="none"
                    stroke={eventConfig[event.type].color}
                    strokeWidth={2}
                    opacity={0.6}
                  >
                    <animate
                      attributeName="r"
                      from={EVENT_SIZE}
                      to={EVENT_SIZE + 8}
                      dur="0.8s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      from="0.8"
                      to="0"
                      dur="0.8s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
              </g>
            );
          })}

          {timelineEvents.length === 0 && (
            <text x="50%" y={AXIS_Y} textAnchor="middle" fontSize="13" fill="#cbd5e1">
              暂无操作事件，执行事务操作后将在此显示时间线
            </text>
          )}
        </svg>

        <AnimatePresence>
          {hoveredIdx !== null && timelineEvents[hoveredIdx] && (
            <Tooltip
              event={timelineEvents[hoveredIdx]}
              x={tooltipPos.x}
              y={tooltipPos.y}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
