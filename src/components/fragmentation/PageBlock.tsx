import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { PhysicalPage } from '@/structures/fragmentation/types';

interface PageBlockProps {
  page: PhysicalPage;
  onDragEnd?: (pageId: string, x: number, y: number) => void;
  isHighlighted?: boolean;
  isScanning?: boolean;
}

const PAGE_WIDTH = 180;
const PAGE_HEIGHT = 140;
const SLOT_HEIGHT = 20;
const HEADER_HEIGHT = 24;

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

  const usedCount = page.slots.filter((s) => s.status === 'used').length;
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

  const getSlotStyle = (status: string) => {
    switch (status) {
      case 'used':
        return 'bg-emerald-500';
      case 'deleted':
        return 'bg-red-500';
      default:
        return 'bg-slate-200';
    }
  };

  return (
    <motion.div
      className="absolute select-none"
      style={{
        left: currentX,
        top: currentY,
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        zIndex: isDragging ? 50 : page.isNew ? 40 : 10,
      }}
      initial={page.isNew ? { scale: 0.8, opacity: 0 } : false}
      animate={{
        scale: 1,
        opacity: page.isFading ? 0.3 : 1,
      }}
      transition={{ duration: 0.3 }}
    >
      <div
        className={`
          w-full h-full rounded-lg border-2 cursor-move
          flex flex-col overflow-hidden
          transition-colors duration-200
          ${isHighlighted || page.isHighlighted ? 'border-amber-400 bg-amber-50 shadow-lg shadow-amber-200' : 'border-slate-300 bg-white shadow-md'}
          ${isScanning ? 'ring-2 ring-sky-400 ring-offset-1' : ''}
          ${page.isSplitting ? 'animate-pulse' : ''}
          ${page.isFading ? 'opacity-30' : ''}
        `}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center justify-between px-2 py-1 bg-slate-100 border-b border-slate-200">
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
            <div
              key={idx}
              className={`
                relative rounded text-xs flex items-center justify-center
                ${getSlotStyle(slot.status)}
                ${slot.status === 'deleted' ? 'overflow-hidden' : ''}
                transition-all duration-300
              `}
              style={{ height: SLOT_HEIGHT }}
            >
              {slot.status === 'deleted' && (
                <div className="absolute inset-0 bg-red-500 opacity-50"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.6) 3px, rgba(255,255,255,0.6) 6px)',
                  }}
                />
              )}
              {slot.status === 'used' && slot.key !== null && (
                <span className="text-white text-[10px] font-medium z-10">
                  {slot.key}
                </span>
              )}
              {slot.status === 'deleted' && slot.key !== null && (
                <span className="text-white text-[10px] font-medium z-10 line-through">
                  {slot.key}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="px-2 pb-1.5">
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-emerald-500 rounded-full"
              initial={{ width: 0 }}
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
