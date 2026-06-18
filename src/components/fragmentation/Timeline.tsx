import { useState, useRef, useEffect, useCallback } from 'react';
import type { TimelineOperation } from '@/structures/fragmentation/types';

interface TimelineProps {
  operations: TimelineOperation[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  isPlaying?: boolean;
  onPlayPause?: () => void;
  onStepBack?: () => void;
  onStepForward?: () => void;
  speed: number;
  disabled?: boolean;
}

export default function Timeline({
  operations,
  currentIndex,
  onIndexChange,
  onDragStart,
  onDragEnd,
  isPlaying = false,
  onPlayPause,
  onStepBack,
  onStepForward,
  speed,
  disabled = false,
}: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredOp, setHoveredOp] = useState<TimelineOperation | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef({ startX: 0, startIndex: 0 });

  const getTickPosition = useCallback((index: number) => {
    if (operations.length <= 1) return 50;
    return (index / (operations.length - 1)) * 100;
  }, [operations.length]);

  const getIndexFromPosition = useCallback((clientX: number) => {
    if (!trackRef.current || operations.length === 0) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const index = Math.round(percentage * (operations.length - 1));
    return Math.max(0, Math.min(operations.length - 1, index));
  }, [operations.length]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (operations.length === 0 || disabled) return;
    e.preventDefault();
    setIsDragging(true);
    onDragStart?.();
    dragStartRef.current = {
      startX: e.clientX,
      startIndex: currentIndex,
    };
    const idx = getIndexFromPosition(e.clientX);
    onIndexChange(idx);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const idx = getIndexFromPosition(e.clientX);
      onIndexChange(idx);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      onDragEnd?.();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, getIndexFromPosition, onIndexChange, onDragEnd]);

  const handleTickHover = (op: TimelineOperation, e: React.MouseEvent) => {
    setHoveredOp(op);
    const rect = trackRef.current?.getBoundingClientRect();
    if (rect) {
      setHoverPos({
        x: e.clientX - rect.left,
        y: -8,
      });
    }
  };

  const handleTickLeave = () => {
    setHoveredOp(null);
  };

  const getOperationColor = (type: string) => {
    switch (type) {
      case 'insert':
        return '#10b981';
      case 'delete':
        return '#ef4444';
      case 'split':
        return '#f59e0b';
      case 'reindex':
        return '#3b82f6';
      default:
        return '#64748b';
    }
  };

  const operationCount = operations.length;
  const isDense = operationCount > 50;
  const isVeryDense = operationCount > 100;

  const getTickSize = (isReindex: boolean, isSplit: boolean) => {
    if (isReindex) return isVeryDense ? 10 : 12;
    if (isSplit) return isVeryDense ? 5 : 6;
    return isVeryDense ? 4 : isDense ? 5 : 7;
  };

  const getTickTop = (index: number, isReindex: boolean) => {
    if (isReindex) return '50%';
    if (isDense) {
      return index % 2 === 0 ? '25%' : '75%';
    }
    return '50%';
  };

  const renderTickMark = (op: TimelineOperation, index: number) => {
    const pos = getTickPosition(index);
    const isActive = index <= currentIndex;
    const color = getOperationColor(op.type);
    const isReindex = op.type === 'reindex';
    const isSplit = op.type === 'split';
    const size = getTickSize(isReindex, isSplit);
    const top = getTickTop(index, isReindex);
    const hitAreaSize = Math.max(16, size * 2.5);

    const tickElement = isReindex ? (
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor: color,
          transform: 'rotate(45deg)',
          opacity: isActive ? 1 : 0.5,
          boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
        }}
      />
    ) : isSplit ? (
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: `${size}px solid transparent`,
          borderRight: `${size}px solid transparent`,
          borderBottom: `${Math.floor(size * 1.4)}px solid ${color}`,
          opacity: isActive ? 1 : 0.5,
          filter: isActive ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' : 'none',
        }}
      />
    ) : (
      <div
        className="rounded-full"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor: color,
          opacity: isActive ? 1 : 0.5,
          boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
        }}
      />
    );

    return (
      <div
        key={op.id}
        className="absolute cursor-pointer transform -translate-x-1/2 z-10 flex items-center justify-center"
        style={{
          left: `${pos}%`,
          top,
          transform: 'translate(-50%, -50%)',
          width: `${hitAreaSize}px`,
          height: `${hitAreaSize}px`,
          zIndex: isReindex ? 20 : 10,
        }}
        onMouseEnter={(e) => handleTickHover(op, e)}
        onMouseLeave={handleTickLeave}
      >
        {tickElement}
      </div>
    );
  };

  const cursorPosition = getTickPosition(currentIndex);

  const timelineHeight = isDense ? 32 : 24;

  return (
    <div className="flex flex-col gap-2 w-full">
      <div
        ref={trackRef}
        className={`relative w-full bg-slate-100 rounded-full select-none ${disabled ? 'cursor-default' : 'cursor-pointer group'}`}
        style={{ height: `${timelineHeight}px` }}
        onMouseDown={handleMouseDown}
      >
        <div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary-400 to-primary-500 rounded-full transition-all duration-75"
          style={{ width: `${cursorPosition}%` }}
        />

        {operations.map((op, idx) => renderTickMark(op, idx))}

        <div
          className="absolute top-0 z-30 transform -translate-x-1/2"
          style={{ left: `${cursorPosition}%`, height: '100%' }}
        >
          <div className="relative w-0.5 h-full bg-primary-600">
            <div
              className="absolute -top-1.5 left-1/2 transform -translate-x-1/2"
              style={{
                width: 0,
                height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: '6px solid #2563eb',
              }}
            />
            <div
              className="absolute -bottom-1.5 left-1/2 transform -translate-x-1/2 rotate-180"
              style={{
                width: 0,
                height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: '6px solid #2563eb',
              }}
            />
          </div>
        </div>

        {hoveredOp && (
          <div
            className="absolute z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full"
            style={{ left: hoverPos.x, top: '-4px' }}
          >
            <div className="bg-slate-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
              {hoveredOp.description}
              <div
                className="absolute left-1/2 -bottom-1 w-2 h-2 bg-slate-800 transform -translate-x-1/2 rotate-45"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-2">
        <button
          onClick={onStepBack}
          disabled={disabled || operations.length === 0 || currentIndex <= 0}
          className="btn-secondary w-10 h-8 flex items-center justify-center text-sm disabled:opacity-50"
          title="后退一步"
        >
          ⏮
        </button>

        <button
          onClick={onPlayPause}
          disabled={disabled || operations.length === 0}
          className="btn-primary w-12 h-8 flex items-center justify-center text-sm disabled:opacity-50"
          title={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <button
          onClick={onStepForward}
          disabled={disabled || operations.length === 0 || currentIndex >= operations.length - 1}
          className="btn-secondary w-10 h-8 flex items-center justify-center text-sm disabled:opacity-50"
          title="前进一步"
        >
          ⏭
        </button>

        <div className="ml-3 text-xs text-slate-500">
          {operations.length > 0
            ? `${currentIndex + 1} / ${operations.length}`
            : '0 / 0'}
        </div>

        <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            插入
          </span>
          <span className="flex items-center gap-1">
            <span
              className="w-0 h-0"
              style={{
                borderLeft: '4px solid transparent',
                borderRight: '4px solid transparent',
                borderBottom: '6px solid #f59e0b',
              }}
            ></span>
            分裂
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            删除
          </span>
          <span className="flex items-center gap-1">
            <span
              style={{
                width: '8px',
                height: '8px',
                backgroundColor: '#3b82f6',
                transform: 'rotate(45deg)',
              }}
            ></span>
            REINDEX
          </span>
        </div>
      </div>
    </div>
  );
}
