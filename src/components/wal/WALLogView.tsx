import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { WALLogEntry } from '@/structures/wal/types';

interface WALLogViewProps {
  entries: WALLogEntry[];
  flushLSN: number;
  checkpointLSN: number;
  onEntryClick: (entry: WALLogEntry) => void;
  onDragReorder: (dragIndex: number, dropIndex: number) => void;
  isAnimating: boolean;
}

const getOperationColor = (operation: string) => {
  switch (operation) {
    case 'INSERT':
      return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    case 'UPDATE':
      return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'DELETE':
      return 'text-red-600 bg-red-50 border-red-200';
    default:
      return 'text-slate-600 bg-slate-50 border-slate-200';
  }
};

const getEntryBgClass = (entry: WALLogEntry) => {
  if (entry.isCheckpointed) {
    return 'bg-slate-200 border-slate-300';
  }
  if (entry.isFlushed) {
    return 'bg-slate-100 border-slate-200';
  }
  return 'bg-white border-slate-300';
};

interface FloatingDragItemProps {
  entry: WALLogEntry;
  position: { x: number; y: number };
  offset: { x: number; y: number };
}

function FloatingDragItem({ entry, position, offset }: FloatingDragItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0.9, scale: 1.05 }}
      animate={{ opacity: 0.85, scale: 1.05 }}
      exit={{ opacity: 0 }}
      className="fixed z-[9999] pointer-events-none shadow-2xl"
      style={{
        left: position.x - offset.x,
        top: position.y - offset.y,
        width: 260,
      }}
    >
      <div
        className={`
          p-2 rounded-lg border cursor-grabbing
          ${getEntryBgClass(entry)}
          ${entry.isHighlighted ? 'ring-2 ring-amber-400 ring-offset-1' : ''}
          ${entry.isScanning ? 'ring-2 ring-amber-400' : ''}
        `}
        style={{
          backdropFilter: 'blur(4px)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(59,130,246,0.2)',
        }}
      >
        <div className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-400">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <circle cx="3" cy="3" r="1.5" />
            <circle cx="3" cy="9" r="1.5" />
            <circle cx="9" cy="3" r="1.5" />
            <circle cx="9" cy="9" r="1.5" />
          </svg>
        </div>
        <div className="flex items-center justify-between gap-2 mb-1 pl-4">
          <span className="text-xs font-mono font-bold text-slate-600">
            LSN {entry.lsn}
          </span>
          <span
            className={`
              text-[10px] px-1.5 py-0.5 rounded border font-medium
              ${getOperationColor(entry.operation)}
            `}
          >
            {entry.operation}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-500 pl-4">
          <span>页面 #{entry.pageId}</span>
          <span className="truncate max-w-[100px]">{entry.content}</span>
        </div>
        {entry.isCheckpointed && (
          <div className="mt-1 text-[9px] text-slate-400 flex items-center gap-1 pl-4">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            已 Checkpoint
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function WALLogView({
  entries,
  flushLSN,
  checkpointLSN,
  onEntryClick,
  onDragReorder,
  isAnimating,
}: WALLogViewProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [clickSuppressed, setClickSuppressed] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const didMoveRef = useRef(false);

  const sortedEntries = [...entries].sort((a, b) => a.displayOrder - b.displayOrder);
  const totalLSN = entries.length > 0 ? entries[entries.length - 1].lsn : 0;
  const maxLSN = Math.max(totalLSN, 1);

  const flushPosition = totalLSN > 0 ? (flushLSN / maxLSN) * 100 : 0;
  const checkpointPosition = totalLSN > 0 ? (checkpointLSN / maxLSN) * 100 : 0;

  const canDrag = !isAnimating && entries.length > 1;

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      didMoveRef.current = true;
      setMousePosition({ x: e.clientX, y: e.clientY });

      if (draggedIndex === null || !listRef.current) return;

      const listRect = listRef.current.getBoundingClientRect();
      const localY = e.clientY - listRect.top + listRef.current.scrollTop;

      let foundInsertIndex = sortedEntries.length;
      for (let i = 0; i < sortedEntries.length; i++) {
        if (i === draggedIndex) continue;
        const item = itemRefs.current[i];
        if (!item) continue;
        const rect = item.getBoundingClientRect();
        const itemMidY = rect.top + rect.height / 2;
        if (e.clientY < itemMidY) {
          foundInsertIndex = i;
          break;
        }
      }

      if (foundInsertIndex !== dragOverIndex) {
        setDragOverIndex(foundInsertIndex);
      }
    };

    const handleMouseUp = () => {
      document.body.style.userSelect = '';

      if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
        const dropIndex = dragOverIndex > draggedIndex ? dragOverIndex - 1 : dragOverIndex;
        setClickSuppressed(true);
        setTimeout(() => setClickSuppressed(false), 50);
        onDragReorder(draggedIndex, dropIndex);
      }

      setDraggedIndex(null);
      setDragOverIndex(null);
      setIsDragging(false);
      setTimeout(() => {
        didMoveRef.current = false;
      }, 0);
    };

    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, draggedIndex, dragOverIndex, sortedEntries.length, onDragReorder]);

  const handlePointerDown = (index: number, e: React.MouseEvent) => {
    if (!canDrag || e.button !== 0) return;
    e.preventDefault();

    const item = itemRefs.current[index];
    if (!item) return;

    const rect = item.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setMousePosition({ x: e.clientX, y: e.clientY });
    setDraggedIndex(index);
    setDragOverIndex(index);
    setIsDragging(true);
    didMoveRef.current = false;
  };

  const handleEntryClick = (entry: WALLogEntry) => {
    if (clickSuppressed || didMoveRef.current) return;
    onEntryClick(entry);
  };

  const draggedEntry = draggedIndex !== null ? sortedEntries[draggedIndex] : null;

  return (
    <div className="h-full flex flex-col">
      <AnimatePresence>
        {isDragging && draggedEntry && (
          <FloatingDragItem
            entry={draggedEntry}
            position={mousePosition}
            offset={dragOffset}
          />
        )}
      </AnimatePresence>

      <h3 className="text-sm font-semibold text-slate-700 mb-2">
        📝 WAL 预写日志
      </h3>

      <div className="flex-1 flex gap-3 min-h-0">
        <div className="w-10 flex-shrink-0 flex flex-col items-center py-2">
          <div className="text-[10px] text-slate-400 mb-1">LSN</div>
          <div className="flex-1 w-1.5 bg-slate-200 rounded-full relative">
            <motion.div
              className="absolute w-3 h-3 -left-[5px] rounded-full bg-emerald-500 z-20 shadow-md"
              initial={{ top: '0%' }}
              animate={{ top: `${flushPosition}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              title="Flush 位置"
            />
            <motion.div
              className="absolute left-0 right-0 h-0.5 bg-emerald-400 z-10"
              initial={{ top: '0%' }}
              animate={{ top: `${flushPosition}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />

            <motion.div
              className="absolute w-3 h-3 -left-[5px] rounded-full bg-blue-500 z-20 shadow-md"
              initial={{ top: '0%' }}
              animate={{ top: `${checkpointPosition}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              title="Checkpoint 位置"
            />
            <motion.div
              className="absolute left-0 right-0 h-0.5 bg-blue-400 z-10"
              initial={{ top: '0%' }}
              animate={{ top: `${checkpointPosition}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          <div className="text-[10px] text-slate-400 mt-1">0</div>
        </div>

        <div
          ref={listRef}
          className="flex-1 min-h-0 overflow-y-auto border border-slate-200 rounded-lg bg-slate-50 p-2 space-y-1.5 relative"
        >
          <AnimatePresence initial={false}>
            {sortedEntries.map((entry, index) => (
              <div key={entry.id} className="relative">
                {dragOverIndex === index && draggedIndex !== index && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-2 border-dashed border-blue-500 bg-blue-50/50 rounded-lg mb-1.5 h-16 flex items-center justify-center"
                  >
                    <span className="text-xs text-blue-500 font-medium">释放到此处</span>
                  </motion.div>
                )}
                <motion.div
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  layout
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{
                    opacity: draggedIndex === index ? 0.35 : 1,
                    y: 0,
                    scale: 1,
                    backgroundColor: entry.isScanning
                      ? '#fef3c7'
                      : undefined,
                  }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  onMouseDown={(e) => handlePointerDown(index, e)}
                  onClick={() => handleEntryClick(entry)}
                  className={`
                    p-2 rounded-lg border
                    transition-all duration-200
                    ${getEntryBgClass(entry)}
                    ${entry.isHighlighted ? 'ring-2 ring-amber-400 ring-offset-1' : ''}
                    ${entry.isNew ? 'shadow-lg shadow-amber-200' : 'hover:shadow-md'}
                    ${entry.isScanning ? 'ring-2 ring-amber-400' : ''}
                    ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
                    ${draggedIndex === index ? 'opacity-35' : ''}
                  `}
                >
                  {canDrag && (
                    <div className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-400 cursor-grab">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                        <circle cx="3" cy="3" r="1.5" />
                        <circle cx="3" cy="9" r="1.5" />
                        <circle cx="9" cy="3" r="1.5" />
                        <circle cx="9" cy="9" r="1.5" />
                      </svg>
                    </div>
                  )}
                  <div className={`flex items-center justify-between gap-2 mb-1 ${canDrag ? 'pl-4' : ''}`}>
                    <span className="text-xs font-mono font-bold text-slate-600">
                      LSN {entry.lsn}
                    </span>
                    <span
                      className={`
                        text-[10px] px-1.5 py-0.5 rounded border font-medium
                        ${getOperationColor(entry.operation)}
                      `}
                    >
                      {entry.operation}
                    </span>
                  </div>
                  <div className={`flex items-center justify-between text-[11px] text-slate-500 ${canDrag ? 'pl-4' : ''}`}>
                    <span>页面 #{entry.pageId}</span>
                    <span className="truncate max-w-[100px]">{entry.content}</span>
                  </div>
                  {entry.isCheckpointed && (
                    <div className={`mt-1 text-[9px] text-slate-400 flex items-center gap-1 ${canDrag ? 'pl-4' : ''}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      已 Checkpoint
                    </div>
                  )}
                </motion.div>
              </div>
            ))}
          </AnimatePresence>
          {dragOverIndex === sortedEntries.length && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-2 border-dashed border-blue-500 bg-blue-50/50 rounded-lg h-16 flex items-center justify-center"
            >
              <span className="text-xs text-blue-500 font-medium">释放到此处</span>
            </motion.div>
          )}

          {entries.length === 0 && (
            <div className="h-full flex items-center justify-center text-sm text-slate-400">
              暂无日志记录
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Flush 位置</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span>Checkpoint 位置</span>
        </div>
      </div>
    </div>
  );
}
