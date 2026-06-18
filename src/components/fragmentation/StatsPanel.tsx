import type { Stats } from '@/structures/fragmentation/types';

interface StatsPanelProps {
  stats: Stats;
  maxSlots: number;
}

export default function StatsPanel({ stats, maxSlots }: StatsPanelProps) {
  const fragPercent = Math.min(stats.fragmentationIndex * 100, 100);
  const fragColor =
    stats.fragmentationIndex < 0.2
      ? 'text-emerald-600'
      : stats.fragmentationIndex < 0.5
      ? 'text-amber-600'
      : 'text-red-600';

  const fillColor =
    stats.avgFillRate > 80
      ? 'text-emerald-600'
      : stats.avgFillRate > 50
      ? 'text-amber-600'
      : 'text-red-600';

  return (
    <div className="flex items-center gap-6 px-4 py-3 bg-white rounded-lg border border-slate-200">
      <div className="flex items-center gap-2">
        <span className="text-slate-500 text-sm">总页面数:</span>
        <span className="font-semibold text-slate-800">{stats.totalPages}</span>
      </div>

      <div className="w-px h-6 bg-slate-200"></div>

      <div className="flex items-center gap-2">
        <span className="text-slate-500 text-sm">已用:</span>
        <span className="font-semibold text-emerald-600">{stats.usedPages}</span>
      </div>

      <div className="w-px h-6 bg-slate-200"></div>

      <div className="flex items-center gap-2">
        <span className="text-slate-500 text-sm">空闲:</span>
        <span className="font-semibold text-slate-400">{stats.emptyPages}</span>
      </div>

      <div className="w-px h-6 bg-slate-200"></div>

      <div className="flex items-center gap-2">
        <span className="text-slate-500 text-sm">平均填充率:</span>
        <span className={`font-semibold ${fillColor}`}>
          {stats.avgFillRate.toFixed(1)}%
        </span>
        <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              stats.avgFillRate > 80
                ? 'bg-emerald-500'
                : stats.avgFillRate > 50
                ? 'bg-amber-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${stats.avgFillRate}%` }}
          />
        </div>
      </div>

      <div className="w-px h-6 bg-slate-200"></div>

      <div className="flex items-center gap-2">
        <span className="text-slate-500 text-sm">碎片化指数:</span>
        <span className={`font-semibold ${fragColor}`}>
          {(stats.fragmentationIndex * 100).toFixed(1)}%
        </span>
        <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              stats.fragmentationIndex < 0.2
                ? 'bg-emerald-500'
                : stats.fragmentationIndex < 0.5
                ? 'bg-amber-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${fragPercent}%` }}
          />
        </div>
      </div>

      <div className="w-px h-6 bg-slate-200"></div>

      <div className="flex items-center gap-2">
        <span className="text-slate-500 text-sm">最长指针跳转:</span>
        <span className="font-semibold text-sky-600">
          {stats.maxPointerJump} 页
        </span>
      </div>

      <div className="w-px h-6 bg-slate-200"></div>

      <div className="flex items-center gap-2">
        <span className="text-slate-500 text-sm">页大小:</span>
        <span className="font-semibold text-slate-700">{maxSlots} slots</span>
      </div>
    </div>
  );
}
