import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PhysicalPage, Slot } from '@/structures/fragmentation/types';

interface PageBlockProps {
  page: PhysicalPage;
  onDragEnd?: (pageId: string, x: number, y: number) => void;
  onDragMove?: (pageId: string, x: number, y: number) => void;
  isHighlighted?: boolean;
  isScanning?: boolean;
  isAnimated?: boolean;
}

const PAGE_WIDTH = 180;
const PAGE_HEIGHT = 140;
const SLOT_HEIGHT = 20;

export default function PageBlock({
  page,
  onDragEnd,
  onDragMove,
  isHighlighted = false,
  isScanning = false,
  isAnimated = false,
}: PageBlockProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, pageX: 0, pageY: 0 });
  const [currentX, setCurrentX] = useState(page.x);
  const [currentY, setCurrentY] = useState(page.y);

  useEffect(() => {
    if (!isDragging) {
      setCurrentX(page.x);
      setCurrentY(page.y);
    }
  }, [page.x, page.y, isDragging]);

  const totalSlots = page.slots.length;
  const halfSplitIndex = Math.floor(totalSlots / 2);

  const visibleSlots = page.splitHalf === 'left'
    ? page.slots.slice(0, halfSplitIndex)
    : page.splitHalf === 'right'
    ? page.slots.slice(halfSplitIndex)
    : page.slots;

  const usedCount = visibleSlots.filter((s) => s.status === 'used' || s.status === 'deleting' || s.status === 'scanning').length;
  const totalVisibleSlots = visibleSlots.filter((s) => s.status !== 'free' || page.splitHalf).length;
  const fillRate = page.splitHalf
    ? (usedCount / (totalSlots / 2)) * 100
    : (usedCount / page.maxSlots) * 100;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (page.isTearing || page.splitHalf) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: currentX,
      y: currentY,
      pageX: e.clientX,
      pageY: e.clientY,
    };

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.pageX;
      const dy = e.clientY - dragStartRef.current.pageY;
      const newX = dragStartRef.current.x + dx;
      const newY = dragStartRef.current.y + dy;
      setCurrentX(newX);
      setCurrentY(newY);
      onDragMove?.(page.id, newX, newY);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.pageX;
      const dy = e.clientY - dragStartRef.current.pageY;
      const finalX = dragStartRef.current.x + dx;
      const finalY = dragStartRef.current.y + dy;
      setCurrentX(finalX);
      setCurrentY(finalY);
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      onDragEnd?.(page.id, finalX, finalY);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const getSlotBgColor = (slot: Slot) => {
    if (slot.isCollapsed) {
      return '#f1f5f9';
    }
    switch (slot.status) {
      case 'used':
        return '#10b981';
      case 'deleting':
        return '#f59e0b';
      case 'deleted':
        return '#ef4444';
      case 'scanning':
        return '#0ea5e9';
      default:
        return '#e2e8f0';
    }
  };

  const hasSplitAnimation = page.isNew && page.splitFromX !== undefined && page.splitFromY !== undefined;
  const isSplitHalf = page.splitHalf === 'left' || page.splitHalf === 'right';
  const isExpanding = page.isExpanding === true;
  const expandProgress = page.expandProgress || 0;

  let blockWidth: number;
  let blockOffset: number;
  let innerWidth: string | number;
  let innerMarginLeft: number;

  if (isExpanding) {
    const progress = Math.max(0, Math.min(1, expandProgress));
    if (page.splitHalf === 'left') {
      blockWidth = PAGE_WIDTH / 2 + (PAGE_WIDTH / 2) * progress;
      blockOffset = 0;
      innerWidth = PAGE_WIDTH;
      innerMarginLeft = 0;
    } else if (page.splitHalf === 'right') {
      blockWidth = PAGE_WIDTH / 2 + (PAGE_WIDTH / 2) * progress;
      blockOffset = PAGE_WIDTH / 2 - (PAGE_WIDTH / 2) * progress;
      innerWidth = PAGE_WIDTH;
      innerMarginLeft = -PAGE_WIDTH / 2 + (PAGE_WIDTH / 2) * progress;
    } else {
      blockWidth = PAGE_WIDTH;
      blockOffset = 0;
      innerWidth = '100%';
      innerMarginLeft = 0;
    }
  } else if (isSplitHalf) {
    blockWidth = PAGE_WIDTH / 2;
    blockOffset = page.splitHalf === 'right' ? PAGE_WIDTH / 2 : 0;
    innerWidth = PAGE_WIDTH;
    innerMarginLeft = page.splitHalf === 'right' ? -PAGE_WIDTH / 2 : 0;
  } else {
    blockWidth = PAGE_WIDTH;
    blockOffset = 0;
    innerWidth = '100%';
    innerMarginLeft = 0;
  }

  const getGridCols = (totalSlots: number): number => {
    if (totalSlots <= 4) return 2;
    if (totalSlots <= 6) return 3;
    if (totalSlots <= 8) return 3;
    if (totalSlots <= 9) return 3;
    if (totalSlots <= 12) return 4;
    return 4;
  };

  const visibleSlotCount = visibleSlots.length;
  const gridCols = getGridCols(visibleSlotCount);

  const splitOffsetX = page.splitOffset || 0;
  const isCollapsed = page.isCollapsed === true;

  return (
    <motion.div
      className="absolute select-none"
      style={{
        left: currentX + blockOffset + splitOffsetX,
        top: currentY,
        width: blockWidth,
        height: PAGE_HEIGHT,
        zIndex: isDragging ? 50 : page.isNew ? 40 : page.isTearing || isSplitHalf || isExpanding ? 45 : 10,
        overflow: 'hidden',
        transition: isAnimated && !isDragging ? 'left 300ms ease-out, top 300ms ease-out' : 'none',
      }}
      initial={
        hasSplitAnimation && !isSplitHalf && !isExpanding
          ? {
              x: page.splitFromX! - page.x,
              y: page.splitFromY! - page.y,
              scaleX: 0.5,
              opacity: 0.8,
            }
          : page.isNew && !isSplitHalf && !isExpanding
          ? { scale: 0.8, opacity: 0 }
          : false
      }
      animate={{
        width: blockWidth,
        x: isSplitHalf || isExpanding ? (page.splitHalf === 'right' ? splitOffsetX : 0) : 0,
        y: 0,
        scaleX: 1,
        scale: isCollapsed ? 0 : 1,
        opacity: isCollapsed ? 0 : page.isFading ? 0.3 : 1,
      }}
      transition={{
        width: isExpanding ? { duration: 0.4, ease: 'easeOut' } : { duration: 0 },
        scale: isCollapsed ? { duration: 0.3, ease: 'easeIn' } : { duration: 0.3 },
        opacity: isCollapsed ? { duration: 0.3, ease: 'easeIn' } : { duration: 0.3 },
        duration: hasSplitAnimation && !isSplitHalf && !isExpanding ? 0.6 : isSplitHalf ? 0.8 : 0.3,
        ease: hasSplitAnimation && !isSplitHalf && !isExpanding ? [0.34, 1.56, 0.64, 1] : 'easeOut',
      }}
    >
      <motion.div
        style={{
          width: innerWidth,
          marginLeft: innerMarginLeft,
        }}
        animate={{
          marginLeft: innerMarginLeft,
        }}
        transition={{
          marginLeft: isExpanding ? { duration: 0.4, ease: 'easeOut' } : { duration: 0 },
        }}
        className={`
          h-full rounded-lg border-2 cursor-move
          flex flex-col overflow-hidden relative
          ${isHighlighted || page.isHighlighted ? 'border-amber-400 bg-amber-50 shadow-lg shadow-amber-200' : 'border-slate-300 bg-white shadow-md'}
          ${isScanning ? 'ring-2 ring-sky-400 ring-offset-1' : ''}
          ${page.isSplitting ? 'animate-pulse' : ''}
          ${page.isFading ? 'opacity-30' : ''}
          ${isSplitHalf ? 'border-red-400' : ''}
          transition-colors duration-200
        `}
        onMouseDown={handleMouseDown}
      >
        {page.isTearing && (
          <motion.div
            className="absolute top-0 bottom-0 w-1 z-30"
            style={{
              left: '50%',
              background: 'linear-gradient(180deg, #ef4444, #f97316, #ef4444)',
              boxShadow: '0 0 10px rgba(239, 68, 68, 0.8), 0 0 20px rgba(239, 68, 68, 0.4)',
            }}
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: [0, 1, 1], scaleY: [0, 1, 1] }}
            transition={{ duration: 0.5, times: [0, 0.3, 1] }}
          />
        )}

        {isSplitHalf && (
          <div
            className="absolute top-0 bottom-0 w-1 bg-red-500 z-30"
            style={{
              left: page.splitHalf === 'left' ? '100%' : '0%',
              boxShadow: page.splitHalf === 'left' ? '2px 0 8px rgba(239, 68, 68, 0.6)' : '-2px 0 8px rgba(239, 68, 68, 0.6)',
            }}
          />
        )}

        <div className="flex items-center justify-between px-2 py-1 bg-slate-100 border-b border-slate-200 z-10">
          <span className="text-xs font-medium text-slate-700 truncate">
            {isSplitHalf ? (page.splitHalf === 'left' ? '左半' : '右半') : `页面 #${page.pageIndex}`}
          </span>
          <span className="text-xs text-slate-500">
            {usedCount}/{isSplitHalf ? totalSlots / 2 : page.maxSlots}
          </span>
        </div>

        <div className="flex-1 p-1.5 grid gap-1" style={{
          gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
        }}>
          {visibleSlots.map((slot, idx) => {
            const actualIdx = page.splitHalf === 'right' ? idx + halfSplitIndex : idx;
            const isSlotCollapsed = slot.isCollapsed === true;
            const isSlotDeleted = slot.status === 'deleted';

            return (
              <motion.div
                key={actualIdx}
                className="relative rounded text-xs flex items-center justify-center overflow-hidden"
                style={{ height: SLOT_HEIGHT }}
                animate={{
                  backgroundColor: getSlotBgColor(slot),
                  scale: isSlotCollapsed ? 0.6 : 1,
                  opacity: isSlotCollapsed ? 0.4 : 1,
                  borderWidth: isSlotDeleted && !isSlotCollapsed ? 2 : 0,
                  borderColor: isSlotDeleted && !isSlotCollapsed ? '#dc2626' : 'transparent',
                  borderStyle: 'solid',
                }}
                transition={{
                  duration: 0.4,
                  ease: 'easeInOut',
                }}
              >
                <AnimatePresence>
                  {(slot.status === 'deleted' || slot.status === 'deleting') && !isSlotCollapsed && (
                    <motion.div
                      className="absolute inset-0 z-10"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: slot.status === 'deleted' ? 1 : 0.5 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      style={{
                        backgroundImage:
                          'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.6) 3px, rgba(255,255,255,0.6) 6px)',
                      }}
                    />
                  )}
                </AnimatePresence>

                {slot.status === 'scanning' && (
                  <motion.div
                    className="absolute inset-0 z-10 bg-white"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.7, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity, repeatType: 'loop' }}
                  />
                )}

                {(slot.status === 'used' || slot.status === 'deleting' || slot.status === 'scanning') && slot.key !== null && (
                  <motion.span
                    className="text-white text-[10px] font-medium z-20"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    {slot.key}
                  </motion.span>
                )}
                {slot.status === 'deleted' && slot.key !== null && !isSlotCollapsed && (
                  <span className="text-white text-[10px] font-medium z-10 line-through">
                    {slot.key}
                  </span>
                )}
                {isSlotCollapsed && (
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="w-2 h-2 rounded-full bg-slate-300" />
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>

        <div className="px-2 pb-1.5 z-10">
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-emerald-500 rounded-full"
              animate={{ width: `${fillRate}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <div className="text-[10px] text-slate-500 text-right mt-0.5">
            {fillRate.toFixed(0)}% 填充
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
