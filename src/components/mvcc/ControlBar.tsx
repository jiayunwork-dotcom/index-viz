import { useMVCCStore } from '@/store/mvccStore';
import type { IsolationLevel } from '@/structures/mvcc/types';
import { cn } from '@/lib/utils';

export default function ControlBar() {
  const {
    isolationLevel,
    setIsolationLevel,
    animationSpeed,
    setAnimationSpeed,
    reset,
    isAnimating,
    transactions,
    versions,
    nextTs,
  } = useMVCCStore();

  const totalVersions = Array.from(versions.values()).reduce((sum, v) => sum + v.length, 0);

  const isolationOptions: { value: IsolationLevel; label: string; desc: string; icon: string }[] = [
    {
      value: 'read-committed',
      label: '读已提交',
      desc: '每次读取都获取最新快照',
      icon: '📖',
    },
    {
      value: 'repeatable-read',
      label: '可重复读',
      desc: '事务开始时的快照，读取一致',
      icon: '🔒',
    },
  ];

  return (
    <div className="card p-3">
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="text-xs font-medium text-slate-600">动画速度</div>
          <div className="flex items-center gap-2 w-48">
            <span className="text-xs text-slate-400">慢</span>
            <input
              type="range"
              min={0.3}
              max={3}
              step={0.1}
              value={animationSpeed}
              onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
              className="flex-1 h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-primary-600"
              disabled={isAnimating}
            />
            <span className="text-xs text-slate-400">快</span>
            <span className="text-xs font-mono font-semibold text-slate-600 w-8 text-right">
              {animationSpeed.toFixed(1)}x
            </span>
          </div>
        </div>

        <div className="h-8 w-px bg-slate-200" />

        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-600">隔离级别</span>
          <div className="flex p-0.5 bg-slate-100 rounded-lg border border-slate-200">
            {isolationOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setIsolationLevel(opt.value)}
                disabled={isAnimating}
                title={opt.desc}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  isolationLevel === opt.value
                    ? 'bg-white text-primary-700 shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
          <div className="text-[10px] text-slate-400 max-w-[180px]">
            {isolationOptions.find((o) => o.value === isolationLevel)?.desc}
          </div>
        </div>

        <div className="h-8 w-px bg-slate-200" />

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md border border-blue-100">
            <span>📋</span>
            <span>事务:</span>
            <span className="font-mono font-semibold">{transactions.length}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-md border border-amber-100">
            <span>📚</span>
            <span>版本:</span>
            <span className="font-mono font-semibold">{totalVersions}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 text-slate-600 rounded-md border border-slate-200">
            <span>⏱️</span>
            <span>时间戳:</span>
            <span className="font-mono font-semibold">{nextTs}</span>
          </div>
        </div>

        <div className="flex-1" />

        <button
          onClick={reset}
          disabled={isAnimating}
          className="btn-danger text-xs"
        >
          🔄 重置全部
        </button>
      </div>
    </div>
  );
}
