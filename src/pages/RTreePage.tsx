import { useState, useRef } from 'react';
import { uid } from '@/lib/utils';

interface Rect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

interface RTreeNode {
  id: string;
  isLeaf: boolean;
  children: string[];
  rectIds: string[];
  mbr: { x: number; y: number; w: number; h: number };
  level: number;
}

const COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#f472b6', '#22d3ee', '#fb923c'];

export default function RTreePage() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [rects, setRects] = useState<Rect[]>([]);
  const [mode, setMode] = useState<'insert' | 'range' | 'knn'>('insert');
  const [query, setQuery] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [knnPoint, setKnnPoint] = useState<{ x: number; y: number } | null>(null);
  const [knnRadius, setKnnRadius] = useState(40);
  const [dragging, setDragging] = useState<{ startX: number; startY: number; curX: number; curY: number } | null>(null);

  const W = 600, H = 450;

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (mode === 'insert') {
      const w = 30 + Math.random() * 40;
      const h = 30 + Math.random() * 40;
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      setRects((prev) => [...prev, { id: uid(), x: Math.max(0, x - w / 2), y: Math.max(0, y - h / 2), w, h, color }]);
    } else if (mode === 'knn') {
      setKnnPoint({ x, y });
      setQuery(null);
    } else {
      setDragging({ startX: x, startY: y, curX: x, curY: y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || mode !== 'range') return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragging({ ...dragging, curX: e.clientX - rect.left, curY: e.clientY - rect.top });
  };

  const handleMouseUp = () => {
    if (dragging && mode === 'range') {
      const x = Math.min(dragging.startX, dragging.curX);
      const y = Math.min(dragging.startY, dragging.curY);
      const w = Math.abs(dragging.curX - dragging.startX);
      const h = Math.abs(dragging.curY - dragging.startY);
      if (w > 5 && h > 5) {
        setQuery({ x, y, w, h });
        setKnnPoint(null);
      }
    }
    setDragging(null);
  };

  const hitRects = query
    ? rects.filter((r) => r.x < query.x + query.w && r.x + r.w > query.x && r.y < query.y + query.h && r.y + r.h > query.y)
    : [];

  const knnHits = knnPoint
    ? rects.filter((r) => {
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        return Math.hypot(cx - knnPoint.x, cy - knnPoint.y) <= knnRadius;
      })
    : [];

  const reset = () => {
    setRects([]);
    setQuery(null);
    setKnnPoint(null);
  };

  return (
    <div className="h-full flex flex-col p-4 gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">📐 R树 空间索引可视化</h2>
          <p className="text-sm text-slate-500">二维空间数据, MBR 包围盒, 范围/最近邻查询</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <div className="flex rounded overflow-hidden border border-slate-300">
            {(['insert', 'range', 'knn'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); }}
                className={`px-3 py-1 ${mode === m ? 'bg-primary-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                {m === 'insert' ? '📍 插入' : m === 'range' ? '⬛ 范围查询' : '🎯 最近邻'}
              </button>
            ))}
          </div>
          {mode === 'knn' && (
            <label className="flex items-center gap-1 text-xs">
              半径
              <input type="number" min={10} max={300} value={knnRadius} onChange={(e) => setKnnRadius(parseInt(e.target.value) || 40)} className="input w-16" />
            </label>
          )}
          <button onClick={reset} className="btn-secondary">清空</button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <aside className="w-60 flex-shrink-0 space-y-4 overflow-y-auto">
          <div className="card p-4 text-xs text-slate-600 space-y-1.5">
            <p className="font-semibold text-slate-700">操作方式:</p>
            <p>📍 插入: 点击画布添加矩形</p>
            <p>⬛ 范围查询: 拖拽画框</p>
            <p>🎯 最近邻: 点击设查询点</p>
          </div>
          <div className="card p-4">
            <h3 className="font-semibold text-sm mb-2">对象列表 ({rects.length})</h3>
            <div className="space-y-1 max-h-64 overflow-auto">
              {rects.map((r) => (
                <div key={r.id} className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded" style={{ background: r.color }} />
                  <span className="font-mono text-slate-600">({r.x.toFixed(0)},{r.y.toFixed(0)}) {r.w.toFixed(0)}×{r.h.toFixed(0)}</span>
                </div>
              ))}
              {rects.length === 0 && <span className="text-xs text-slate-400">暂无</span>}
            </div>
          </div>
        </aside>

        <div className="flex-1 card overflow-hidden flex items-center justify-center bg-slate-50 relative p-4 min-h-0">
          <div
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="relative bg-white border border-slate-300 rounded cursor-crosshair"
            style={{ width: W, height: H }}
          >
            <svg width={W} height={H} className="absolute inset-0">
              {Array.from({ length: W / 50 + 1 }).map((_, i) => (
                <line key={`vx${i}`} x1={i * 50} y1={0} x2={i * 50} y2={H} stroke="#f1f5f9" />
              ))}
              {Array.from({ length: H / 50 + 1 }).map((_, i) => (
                <line key={`hy${i}`} x1={0} y1={i * 50} x2={W} y2={i * 50} stroke="#f1f5f9" />
              ))}
            </svg>

            {rects.map((r) => {
              const isHit = hitRects.some((h) => h.id === r.id) || knnHits.some((h) => h.id === r.id);
              return (
                <div
                  key={r.id}
                  className="absolute rounded border-2 transition-all"
                  style={{
                    left: r.x, top: r.y, width: r.w, height: r.h,
                    background: isHit ? r.color : `${r.color}66`,
                    borderColor: r.color,
                    boxShadow: isHit ? `0 0 0 3px ${r.color}44` : undefined,
                  }}
                />
              );
            })}

            {query && (
              <div
                className="absolute border-2 border-dashed border-blue-500 bg-blue-500/10 rounded pointer-events-none"
                style={{ left: query.x, top: query.y, width: query.w, height: query.h }}
              />
            )}

            {dragging && (
              <div
                className="absolute border-2 border-dashed border-blue-400 bg-blue-400/10 rounded pointer-events-none"
                style={{
                  left: Math.min(dragging.startX, dragging.curX),
                  top: Math.min(dragging.startY, dragging.curY),
                  width: Math.abs(dragging.curX - dragging.startX),
                  height: Math.abs(dragging.curY - dragging.startY),
                }}
              />
            )}

            {knnPoint && (
              <>
                <div
                  className="absolute rounded-full border-2 border-rose-500 bg-rose-500/10 pointer-events-none animate-pulse"
                  style={{
                    left: knnPoint.x - knnRadius,
                    top: knnPoint.y - knnRadius,
                    width: knnRadius * 2,
                    height: knnRadius * 2,
                  }}
                />
                <div
                  className="absolute w-3 h-3 rounded-full bg-rose-600 border-2 border-white pointer-events-none"
                  style={{ left: knnPoint.x - 6, top: knnPoint.y - 6 }}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
