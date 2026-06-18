import type { AnimationPhase } from '@/structures/wal/types';

interface ControlPanelProps {
  onWrite: () => void;
  onCheckpoint: () => void;
  onCrash: () => void;
  onRecovery: () => void;
  onReset: () => void;
  isAnimating: boolean;
  animationPhase: AnimationPhase;
  speed: number;
  onSpeedChange: (speed: number) => void;
  currentOperation: string | null;
  canCrash: boolean;
  canRecovery: boolean;
  isSingleStepMode: boolean;
  onSingleStepModeChange: (enabled: boolean) => void;
  recoveryProgress: { current: number; total: number };
  isTimeTraveling: boolean;
}

export default function ControlPanel({
  onWrite,
  onCheckpoint,
  onCrash,
  onRecovery,
  onReset,
  isAnimating,
  animationPhase,
  speed,
  onSpeedChange,
  currentOperation,
  canCrash,
  canRecovery,
  isSingleStepMode,
  onSingleStepModeChange,
  recoveryProgress,
  isTimeTraveling,
}: ControlPanelProps) {
  const isRecoveryPhase = animationPhase === 'recovery';
  const showRecoveryProgress = isRecoveryPhase && isSingleStepMode && recoveryProgress.total > 0;
  const allDisabled = isAnimating || isTimeTraveling;
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onWrite}
            disabled={allDisabled}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium text-sm
                       hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors flex items-center gap-2"
          >
            ✍️ 写入数据
          </button>

          <button
            onClick={onCheckpoint}
            disabled={allDisabled || animationPhase === 'crash'}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium text-sm
                       hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors flex items-center gap-2"
          >
            📌 Checkpoint
          </button>

          <button
            onClick={onCrash}
            disabled={allDisabled || !canCrash}
            className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium text-sm
                       hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors flex items-center gap-2"
          >
            💥 模拟崩溃
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onRecovery}
              disabled={allDisabled || !canRecovery}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg font-medium text-sm
                         hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors flex items-center gap-2"
            >
              {isSingleStepMode && isRecoveryPhase ? '⏭️ 下一步' : '🔄 恢复'}
            </button>
            {showRecoveryProgress && (
              <span className="text-sm font-mono text-amber-700 bg-amber-50 px-2 py-1 rounded">
                {recoveryProgress.current}/{recoveryProgress.total}
              </span>
            )}
          </div>

          <button
            onClick={onReset}
            disabled={allDisabled}
            className="px-4 py-2 bg-slate-500 text-white rounded-lg font-medium text-sm
                       hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors flex items-center gap-2"
          >
            🔃 重置
          </button>

          <div className="flex items-center gap-2 ml-4 pl-4 border-l border-slate-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isSingleStepMode}
                onChange={(e) => onSingleStepModeChange(e.target.checked)}
                disabled={isTimeTraveling}
                className="w-4 h-4 accent-amber-500"
              />
              <span className="text-xs text-slate-600">单步恢复</span>
            </label>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">速度</span>
            <input
              type="range"
              min="1"
              max="10"
              value={speed}
              onChange={(e) => onSpeedChange(Number(e.target.value))}
              className="w-24 accent-primary-500"
            />
            <span className="text-xs text-slate-600 w-6">{speed}x</span>
          </div>

          {isTimeTraveling && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium">
              <span className="animate-pulse">⏰</span>
              历史回放中
            </div>
          )}

          {!isTimeTraveling && currentOperation && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-100 text-sky-700 rounded-lg text-sm font-medium">
              <span className="animate-pulse">⏳</span>
              {currentOperation}
            </div>
          )}

          {!isTimeTraveling && !isAnimating && !currentOperation && (
            <div className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs">
              空闲
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
