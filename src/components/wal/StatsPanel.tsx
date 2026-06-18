import type { WALStats } from '@/structures/wal/types';

interface StatsPanelProps {
  stats: WALStats;
}

export default function StatsPanel({ stats }: StatsPanelProps) {
  const statItems = [
    {
      label: 'WAL 总条目',
      value: stats.totalEntries,
      color: 'text-slate-700',
      bg: 'bg-slate-100',
    },
    {
      label: '已刷盘条目',
      value: stats.flushedEntries,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Buffer Pool 脏页',
      value: stats.dirtyPages,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: '磁盘页面',
      value: stats.diskPages,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Checkpoint LSN',
      value: stats.checkpointLSN,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: '当前 Flush LSN',
      value: stats.currentFlushLSN,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
  ];

  return (
    <div className="card p-3">
      <div className="grid grid-cols-6 gap-3">
        {statItems.map((item) => (
          <div
            key={item.label}
            className={`${item.bg} rounded-lg px-3 py-2 text-center`}
          >
            <div className={`text-xl font-bold ${item.color}`}>
              {item.value}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
