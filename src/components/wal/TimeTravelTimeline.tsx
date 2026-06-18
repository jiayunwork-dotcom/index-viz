import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { TimeTravelSnapshot, TimeTravelEventType } from '@/structures/wal/types';

interface TimeTravelTimelineProps {
  snapshots: TimeTravelSnapshot[];
  currentIndex: number;
  onTimeChange: (index: number) => void;
  isTimeTraveling: boolean;
}

const getEventTypeColor = (type: TimeTravelEventType): string => {
  switch (type) {
    case 'write':
      return '#10b981';
    case 'checkpoint':
      return '#3b82f6';
    case 'crash':
      return '#ef4444';
    case 'recovery':
      return '#a855f7';
    default:
      return '#64748b';
  }
};

const getEventTypeLabel = (type: TimeTravelEventType): string => {
  switch (type) {
    case 'write':
      return '写入';
    case 'checkpoint':
      return 'Checkpoint';
    case 'crash':
      return '崩溃';
    case 'recovery':
      return '恢复';
    default:
      return '未知';
  }
};

export default function TimeTravelTimeline({
  snapshots,
  currentIndex,
  onTimeChange,
  isTimeTraveling,
}: TimeTravelTimelineProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredMarker, setHoveredMarker] = useState<number | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const lastEmittedIndex = useRef(currentIndex);

  const maxIndex = snapshots.length - 1;
  const percentage = maxIndex > 0 ? (currentIndex / maxIndex) * 100 : 0;

  const handleSliderClick = (e: React.MouseEvent) => {
    if (!sliderRef.current || isDragging) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const index = Math.round((percentage / 100) * maxIndex);
    onTimeChange(index);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    handleSliderClick(e);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !sliderRef.current) return;

      const rect = sliderRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
      const index = Math.round((percentage / 100) * maxIndex);

      if (index !== lastEmittedIndex.current) {
        lastEmittedIndex.current = index;
        onTimeChange(index);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, maxIndex, onTimeChange]);

  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
          <span className="text-base">⏰</span>
          时间旅行
        </h4>
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          {(['write', 'checkpoint', 'crash', 'recovery'] as TimeTravelEventType[]).map((type) => (
            <div key={type} className="flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: getEventTypeColor(type) }}
              />
              <span>{getEventTypeLabel(type)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative px-2">
        <div
          ref={sliderRef}
          className="relative h-3 bg-slate-200 rounded-full cursor-pointer select-none"
          onClick={handleSliderClick}
        >
          <motion.div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.1 }}
          />

          {snapshots.map((snapshot, index) => {
            const markerPercentage = maxIndex > 0 ? (index / maxIndex) * 100 : 0;
            const isActive = index <= currentIndex;
            const isCurrent = index === currentIndex;
            const isHovered = hoveredMarker === index;

            return (
              <div
                key={snapshot.id}
                className="absolute top-1/2 -translate-y-1/2 cursor-pointer z-10"
                style={{ left: `calc(${markerPercentage}% - 4px)` }}
                onMouseEnter={() => setHoveredMarker(index)}
                onMouseLeave={() => setHoveredMarker(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onTimeChange(index);
                }}
              >
                <motion.div
                  className="w-2 h-2 rounded-full border-2 border-white shadow-sm"
                  animate={{
                    backgroundColor: isActive ? getEventTypeColor(snapshot.type) : '#cbd5e1',
                    scale: isCurrent || isHovered ? 1.5 : 1,
                  }}
                  transition={{ duration: 0.15 }}
                />
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0, y: 5, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 bg-slate-800 text-white text-[10px] rounded whitespace-nowrap z-50 pointer-events-none"
                  >
                    <div className="font-medium">{getEventTypeLabel(snapshot.type)}</div>
                    <div className="text-slate-300">{snapshot.description}</div>
                    <div
                      className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"
                    />
                  </motion.div>
                )}
              </div>
            );
          })}

          <div
            className="absolute top-1/2 -translate-y-1/2 z-20 cursor-grab active:cursor-grabbing"
            style={{ left: `calc(${percentage}% - 8px)` }}
            onMouseDown={handleMouseDown}
          >
            <motion.div
              className="w-4 h-4 bg-white border-2 border-slate-400 rounded-full shadow-lg"
              animate={{
                scale: isDragging ? 1.3 : 1,
                borderColor: isTimeTraveling ? '#a855f7' : '#64748b',
              }}
              transition={{ duration: 0.15 }}
            />
          </div>
        </div>

        <div className="flex justify-between mt-2 text-[9px] text-slate-400">
          <span>初始状态</span>
          <span>当前时刻</span>
        </div>

        {currentIndex >= 0 && currentIndex < snapshots.length && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-center text-[11px] text-slate-500"
          >
            <span className="font-medium" style={{ color: getEventTypeColor(snapshots[currentIndex].type) }}>
              {getEventTypeLabel(snapshots[currentIndex].type)}
            </span>
            <span className="mx-1">·</span>
            <span>{snapshots[currentIndex].description}</span>
            {isTimeTraveling && currentIndex < maxIndex && (
              <span className="ml-2 text-purple-500 font-medium">（历史回放中）</span>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
