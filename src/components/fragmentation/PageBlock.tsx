import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PhysicalPage, Slot } from '@/structures/fragmentation/types';

interface PageBlockProps {
  page: PhysicalPage;
  onDragEnd?: (pageId: string, x: number, y: number) => void;
  isHighlighted?: boolean;
  isScanning?: boolean;
}

const PAGE_WIDTH = 180;
const PAGE_HEIGHT = 140;
const SLOT_HEIGHT = 20;

export default function PageBlock({
  page,
  onDragEnd,
  isHighlighted = false,
  isScanning = false,
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

  const usedCount = page.slots.filter((s) => s.status === 'used' || s.status === 'deleting' || s.status === 'scanning').length;
  const fillRate = (usedCount / page.maxSlots) * 100;

  const handleMouseDown = (e: React.MouseEvent) => {
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
      setCurrentX(dragStartRef.current.x + dx);
      setCurrentY(dragStartRef.current.y + dy);
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

  return (
    <motion.div
      className="absolute select-none"
      style={{
        left: currentX,
        top: currentY,
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        zIndex: isDragging ? 50 : page.isNew ? 40 : page.isTearing ? 45 : 10,
      }}
      initial={
        hasSplitAnimation
          ? {
              x: page.splitFromX! - page.x,
              y: page.splitFromY! - page.y,
              scaleX: 0.5,
              opacity: 0.8,
            }
          : page.isNew
          ? { scale: 0.8, opacity: 0 }
          : false
      }
      animate={{
        x: 0,
        y: 0,
        scaleX: 1,
        scale: 1,
        opacity: page.isFading ? 0.3 : 1,
      }}
      transition={{
        duration: hasSplitAnimation ? 0.6 : 0.3,
        ease: hasSplitAnimation ? [0.34, 1.56, 0.64, 1] : 'easeOut',
      }}
    >
      <div
        className={`
          w-full h-full rounded-lg border-2 cursor-move
          flex flex-col overflow-hidden relative
          ${isHighlighted || page.isHighlighted ? 'border-amber-400 bg-amber-50 shadow-lg shadow-amber-200' : 'border-slate-300 bg-white shadow-md'}
          ${isScanning ? 'ring-2 ring-sky-400 ring-offset-1' : ''}
          ${page.isSplitting ? 'animate-pulse' : ''}
          ${page.isFading ? 'opacity-30' : ''}
          transition-colors duration-200
        `}
        onMouseDown={handleMouseDown}
      >
        {page.isTearing && (
          <motion.div
            className="absolute top-0 bottom-0 w-1 bg-red-400 z-20"
            style={{ left: '50%' }}
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: [0, 1, 1, 0], scaleY: [0, 1, 1, 0] }}
            transition={{ duration: 0.6, times: [0, 0.3, 0.7, 1] }}
          />
        )}

        <div className="flex items-center justify-between px-2 py-1 bg-slate-100 border-b border-slate-200 z-10">
          <span className="text-xs font-medium text-slate-700 truncate">
            页面 #{page.pageIndex}
          </span>
          <span className="text-xs text-slate-500">
            {usedCount}/{page.maxSlots}
          </span>
        </div>

        <div className="flex-1 p-1.5 grid gap-1" style={{
          gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(page.maxSlots))}, 1fr)`,
        }}>
          {page.slots.map((slot, idx) => (
            <motion.div
              key={idx}
              className="relative rounded text-xs flex items-center justify-center overflow-hidden"
              style={{ height: SLOT_HEIGHT }}
              animate={{
                backgroundColor: getSlotBgColor(slot),
              }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
            >
              <AnimatePresence>
                {(slot.status === 'deleted' || slot.status === 'deleting') && (
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
              {slot.status === 'deleted' && slot.key !== null && (
                <span className="text-white text-[10px] font-medium z-10 line-through">
                  {slot.key}
                </span>
              )}
            </motion.div>
          ))}
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
      </div>
    </motion.div>
  );
}
