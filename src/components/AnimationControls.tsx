import { useEffect } from 'react';
import { useAnimationStore } from '@/store/animationStore';
import { cn } from '@/lib/utils';

export default function AnimationControls() {
  const {
    isPlaying,
    currentFrame,
    speed,
    frames,
    setPlaying,
    setSpeed,
    nextFrame,
    prevFrame,
    reset,
    goToFrame,
  } = useAnimationStore();

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      nextFrame();
    }, 1000 / speed);
    return () => clearInterval(interval);
  }, [isPlaying, speed, nextFrame]);

  const totalFrames = frames.length;
  const progress = totalFrames > 0 ? ((currentFrame + 1) / totalFrames) * 100 : 0;

  const currentDescription = frames[currentFrame]?.description || '';

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={reset}
          disabled={totalFrames === 0}
          className="btn-secondary"
          title="重置"
        >
          ⏮
        </button>
        <button
          onClick={prevFrame}
          disabled={currentFrame === 0 || totalFrames === 0}
          className="btn-secondary"
          title="上一步"
        >
          ◀
        </button>
        <button
          onClick={() => setPlaying(!isPlaying)}
          disabled={totalFrames === 0 || currentFrame >= totalFrames - 1}
          className={cn(isPlaying ? 'btn-danger' : 'btn-primary')}
          title={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? '⏸ 暂停' : '▶ 播放'}
        </button>
        <button
          onClick={nextFrame}
          disabled={currentFrame >= totalFrames - 1 || totalFrames === 0}
          className="btn-secondary"
          title="下一步"
        >
          ▶
        </button>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">速度:</span>
          <select
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="input w-20"
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
            <option value={3}>3x</option>
            <option value={4}>4x</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {currentFrame + 1} / {totalFrames || 0}
        </span>
        <input
          type="range"
          min={0}
          max={Math.max(0, totalFrames - 1)}
          value={currentFrame}
          onChange={(e) => goToFrame(parseInt(e.target.value))}
          disabled={totalFrames === 0}
          className="flex-1 accent-primary-600"
        />
      </div>

      <div className="mt-2 h-1 bg-slate-200 rounded overflow-hidden">
        <div
          className="h-full bg-primary-500 transition-all duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      {currentDescription && (
        <div className="mt-3 px-3 py-2 bg-primary-50 border border-primary-200 rounded text-sm text-primary-800">
          {currentDescription}
        </div>
      )}
    </div>
  );
}
