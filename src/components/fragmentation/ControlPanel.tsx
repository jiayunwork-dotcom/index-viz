import { useState } from 'react';

interface ControlPanelProps {
  maxSlots: number;
  onMaxSlotsChange: (value: number) => void;
  onSimulateFragmentation: () => void;
  onReindex: () => void;
  onReset: () => void;
  isAnimating: boolean;
  animationPhase: string;
  speed: number;
  onSpeedChange: (speed: number) => void;
  currentOperation: string | null;
}

export default function ControlPanel({
  maxSlots,
  onMaxSlotsChange,
  onSimulateFragmentation,
  onReindex,
  onReset,
  isAnimating,
  animationPhase,
  speed,
  onSpeedChange,
  currentOperation,
}: ControlPanelProps) {
  const getPhaseText = () => {
    switch (animationPhase) {
      case 'inserting':
        return '插入中...';
      case 'splitting':
        return '页面分裂中...';
      case 'deleting':
        return '删除中...';
      case 'reindex_scan':
        return 'REINDEX: 扫描阶段';
      case 'reindex_compact':
        return 'REINDEX: 紧凑阶段';
      case 'reindex_relink':
        return 'REINDEX: 重链阶段';
      case 'complete':
        return '完成';
      default:
        return '空闲';
    }
  };

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-white rounded-lg border border-slate-200">
      <div className="flex items-center gap-3">
        <button
          onClick={onSimulateFragmentation}
          disabled={isAnimating}
          className="btn-primary"
        >
          🔥 模拟碎片化
        </button>

        <button
          onClick={onReindex}
          disabled={isAnimating}
          className="btn-success"
        >
          🔄 REINDEX
        </button>

        <button
          onClick={onReset}
          disabled={isAnimating}
          className="btn-secondary"
        >
          🔃 重置
        </button>
      </div>

      <div className="w-px h-8 bg-slate-200"></div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-600 whitespace-nowrap">每页slot数:</span>
        <input
          type="range"
          min={4}
          max={16}
          value={maxSlots}
          onChange={(e) => onMaxSlotsChange(parseInt(e.target.value))}
          disabled={isAnimating}
          className="accent-primary-600 w-28"
        />
        <span className="font-semibold w-6 text-slate-700">{maxSlots}</span>
      </div>

      <div className="w-px h-8 bg-slate-200"></div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-600 whitespace-nowrap">动画速度:</span>
        <input
          type="range"
          min={1}
          max={10}
          value={speed}
          onChange={(e) => onSpeedChange(parseInt(e.target.value))}
          className="accent-primary-600 w-24"
        />
        <span className="font-semibold w-6 text-slate-700">{speed}x</span>
      </div>

      <div className="flex-1"></div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500">状态:</span>
        <span
          className={`font-medium ${
            isAnimating ? 'text-sky-600' : 'text-slate-600'
          }`}
        >
          {getPhaseText()}
        </span>
        {currentOperation && (
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            {currentOperation}
          </span>
        )}
      </div>
    </div>
  );
}
