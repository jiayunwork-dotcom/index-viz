import { useRef, useEffect, useState } from 'react';
import PageBlock from './PageBlock';
import PointerLines from './PointerLines';
import type { PhysicalPage } from '@/structures/fragmentation/types';

interface PhysicalPageViewProps {
  pages: Record<string, PhysicalPage>;
  leafChain: string[];
  highlightedPageId: string | null;
  scanningPageIds: string[];
  onPageDragEnd: (pageId: string, x: number, y: number) => void;
  isAnimated?: boolean;
}

export default function PhysicalPageView({
  pages,
  leafChain,
  highlightedPageId,
  scanningPageIds,
  onPageDragEnd,
  isAnimated = false,
}: PhysicalPageViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }>>({});

  const handleDragMove = (pageId: string, x: number, y: number) => {
    setDragPositions((prev) => ({
      ...prev,
      [pageId]: { x, y },
    }));
  };

  const handleDragEnd = (pageId: string, x: number, y: number) => {
    setDragPositions((prev) => {
      const next = { ...prev };
      delete next[pageId];
      return next;
    });
    onPageDragEnd(pageId, x, y);
  };

  const getEffectivePages = () => {
    const effective = { ...pages };
    Object.entries(dragPositions).forEach(([id, pos]) => {
      if (effective[id]) {
        effective[id] = { ...effective[id], x: pos.x, y: pos.y };
      }
    });
    return effective;
  };

  const effectivePages = getEffectivePages();
  const pageList = Object.values(effectivePages);
  const maxX = Math.max(...pageList.map((p) => p.x + 200), 300);
  const maxY = Math.max(...pageList.map((p) => p.y + 160), 200);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-auto bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg"
    >
      <div
        className="relative"
        style={{ width: maxX + 40, height: maxY + 40, minWidth: '100%', minHeight: '100%' }}
      >
        <PointerLines pages={effectivePages} leafChain={leafChain} />

        {Object.values(pages).map((page) => (
          <PageBlock
            key={page.id}
            page={page}
            onDragEnd={handleDragEnd}
            onDragMove={handleDragMove}
            isHighlighted={highlightedPageId === page.id}
            isScanning={scanningPageIds.includes(page.id)}
            isAnimated={isAnimated}
          />
        ))}
      </div>

      <div className="absolute top-2 left-2 text-xs text-slate-500 bg-white/80 px-2 py-1 rounded z-20">
        物理页面视图 · 可拖拽
      </div>

      <div className="absolute bottom-2 left-2 text-xs text-slate-500 bg-white/80 px-2 py-1 rounded z-20 flex gap-3">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-500 inline-block"></span>
          已用
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-slate-200 inline-block"></span>
          空闲
        </span>
        <span className="flex items-center gap-1">
          <span
            className="w-3 h-3 rounded inline-block bg-red-500"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 4px)',
            }}
          ></span>
          已删除
        </span>
      </div>
    </div>
  );
}
