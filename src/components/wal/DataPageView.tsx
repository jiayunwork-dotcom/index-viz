import { motion, AnimatePresence } from 'framer-motion';
import type { DataPage, WALLogEntry } from '@/structures/wal/types';

interface DataPageViewProps {
  pages: DataPage[];
  entries: WALLogEntry[];
  onPageClick: (page: DataPage) => void;
}

const PAGE_WIDTH = 140;
const PAGE_HEIGHT = 90;
const PAGE_GAP = 16;
const PAGES_PER_ROW = 5;

interface PageBlockProps {
  page: DataPage;
  onClick: () => void;
  layer: 'buffer' | 'disk';
  index: number;
}

function PageBlock({ page, onClick, layer, index }: PageBlockProps) {
  const col = index % PAGES_PER_ROW;
  const row = Math.floor(index / PAGES_PER_ROW);
  const x = col * (PAGE_WIDTH + PAGE_GAP);
  const y = row * (PAGE_HEIGHT + PAGE_GAP);

  const isDirty = layer === 'buffer';
  const isOnDisk = layer === 'disk';

  return (
    <motion.div
      layoutId={`page-${page.pageId}`}
      initial={page.isNew ? { scale: 0.8, opacity: 0 } : false}
      animate={{
        x,
        y,
        scale: 1,
        opacity: 1,
      }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{
        x: { duration: 0.5, ease: 'easeInOut' },
        y: { duration: 0.5, ease: 'easeInOut' },
        scale: { duration: 0.3 },
        opacity: { duration: 0.3 },
      }}
      onClick={onClick}
      className={`
        absolute cursor-pointer rounded-lg border-2 p-2
        flex flex-col justify-between
        transition-shadow duration-200
        ${isDirty
          ? 'bg-white border-red-400 hover:shadow-md'
          : 'bg-emerald-50 border-emerald-400 hover:shadow-md'
        }
        ${page.isHighlighted ? 'ring-2 ring-amber-400 ring-offset-2 shadow-lg' : ''}
        ${page.isRecovering ? 'z-50' : ''}
      `}
      style={{
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
      }}
    >
      {isDirty && (
        <motion.div
          className="absolute inset-0 rounded-lg border-2 border-red-400 pointer-events-none"
          animate={{
            opacity: [0.6, 0.2, 0.6],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700">
          页面 #{page.pageId}
        </span>
        <span
          className={`
            text-[9px] px-1.5 py-0.5 rounded font-medium
            ${isDirty
              ? 'bg-red-100 text-red-600'
              : 'bg-emerald-100 text-emerald-600'
            }
          `}
        >
          {isDirty ? '脏页' : '已持久化'}
        </span>
      </div>

      <div className="text-[11px] text-slate-600 truncate">
        {page.content}
      </div>

      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${isDirty ? 'bg-red-400' : 'bg-emerald-500'}`}
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </motion.div>
  );
}

export default function DataPageView({ pages, entries, onPageClick }: DataPageViewProps) {
  const pageDisplayOrderMap = new Map<number, number>();
  entries.forEach((entry) => {
    if (!pageDisplayOrderMap.has(entry.pageId) || entry.displayOrder < pageDisplayOrderMap.get(entry.pageId)!) {
      pageDisplayOrderMap.set(entry.pageId, entry.displayOrder);
    }
  });

  const bufferPages = pages
    .filter((p) => p.isDirty && !p.isOnDisk)
    .sort((a, b) => {
      const orderA = pageDisplayOrderMap.get(a.pageId) ?? Number.MAX_SAFE_INTEGER;
      const orderB = pageDisplayOrderMap.get(b.pageId) ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });
  const diskPages = pages.filter((p) => p.isOnDisk);

  const bufferHeight = Math.max(
    180,
    Math.ceil(bufferPages.length / PAGES_PER_ROW) * (PAGE_HEIGHT + PAGE_GAP) + 40
  );
  const diskHeight = Math.max(
    180,
    Math.ceil(diskPages.length / PAGES_PER_ROW) * (PAGE_HEIGHT + PAGE_GAP) + 40
  );

  return (
    <div className="h-full flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-slate-700">
        💾 数据页面视图
      </h3>

      <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-auto">
        <div className="card p-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Buffer Pool (内存)
            </h4>
            <span className="text-[10px] text-slate-400">
              {bufferPages.length} 个脏页
            </span>
          </div>
          <div
            className="relative bg-slate-50 rounded-lg border border-dashed border-red-200"
            style={{ height: bufferHeight }}
          >
            <AnimatePresence>
              {bufferPages.map((page, index) => (
                <PageBlock
                  key={page.id}
                  page={page}
                  layer="buffer"
                  index={index}
                  onClick={() => onPageClick(page)}
                />
              ))}
            </AnimatePresence>
            {bufferPages.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                缓冲池为空
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center">
          <div className="flex items-center gap-2 text-slate-400">
            <div className="w-16 h-px bg-slate-300" />
            <span className="text-[10px]">⬇ FLUSH 刷盘 ⬇</span>
            <div className="w-16 h-px bg-slate-300" />
          </div>
        </div>

        <div className="card p-3 flex-1 min-h-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              磁盘
            </h4>
            <span className="text-[10px] text-slate-400">
              {diskPages.length} 个持久化页面
            </span>
          </div>
          <div
            className="relative bg-emerald-50/50 rounded-lg border border-dashed border-emerald-200 overflow-visible"
            style={{ minHeight: diskHeight }}
          >
            <AnimatePresence>
              {diskPages.map((page, index) => (
                <PageBlock
                  key={`disk-${page.id}`}
                  page={page}
                  layer="disk"
                  index={index}
                  onClick={() => onPageClick(page)}
                />
              ))}
            </AnimatePresence>
            {diskPages.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400" style={{ height: diskHeight }}>
                磁盘为空
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
