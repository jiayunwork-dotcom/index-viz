import { useState, useRef } from 'react';
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
  const [isDragging, setIsDragging] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const sortedEntries = [...entries].sort((a, b) => a.displayOrder - b.displayOrder);
  const totalLSN = entries.length > 0 ? entries[entries.length - 1].lsn : 0;
  const maxLSN = Math.max(totalLSN, 1);

  const flushPosition = totalLSN > 0 ? (flushLSN / maxLSN) * 100 : 0;
  const checkpointPosition = totalLSN > 0 ? (checkpointLSN / maxLSN) * 100 : 0;

  const canDrag = !isAnimating && entries.length > 1;

  const handleDragStart = (index: number, e: React.DragEvent<HTMLDivElement>) => {
    if (!canDrag) {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());

    const item = itemRefs.current[index];
    if (item) {
      const rect = item.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleDragOver = (index: number, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (draggedIndex === null || !canDrag) return;

    const item = itemRefs.current[index];
    if (!item) return;

    const rect = item.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const clientY = 'clientY' in e ? e.clientY : (e as unknown as MouseEvent).clientY;
    const newDragOverIndex = clientY < midY ? index : index + 1;

    if (newDragOverIndex !== dragOverIndex && newDragOverIndex !== draggedIndex) {
      setDragOverIndex(newDragOverIndex);
    }
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const dropIndex = dragOverIndex > draggedIndex ? dragOverIndex - 1 : dragOverIndex;
      onDragReorder(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
    setIsDragging(false);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  return (
    <div className="h-full flex flex-col">
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
          onDragLeave={handleDragLeave}
          onDragEnd={handleDragEnd}
        >
          <AnimatePresence initial={false}>
            {sortedEntries.map((entry, index) => (
              <div key={entry.id} className="relative">
                {dragOverIndex === index && (
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
                  draggable={canDrag}
                  onDragStart={(e) => handleDragStart(index, e as unknown as React.DragEvent<HTMLDivElement>)}
                  onDragOver={(e) => handleDragOver(index, e as unknown as React.DragEvent<HTMLDivElement>)}
                  layout
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{
                    opacity: draggedIndex === index ? 0.4 : 1,
                    y: 0,
                    scale: 1,
                    backgroundColor: entry.isScanning
                      ? '#fef3c7'
                      : undefined,
                  }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => onEntryClick(entry)}
                  className={`
                    p-2 rounded-lg border
                    transition-all duration-200
                    ${getEntryBgClass(entry)}
                    ${entry.isHighlighted ? 'ring-2 ring-amber-400 ring-offset-1' : ''}
                    ${entry.isNew ? 'shadow-lg shadow-amber-200' : 'hover:shadow-md'}
                    ${entry.isScanning ? 'ring-2 ring-amber-400' : ''}
                    ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
                    ${draggedIndex === index ? 'opacity-40' : ''}
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
