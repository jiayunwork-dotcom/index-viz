import { useState, useMemo } from 'react';
import { BTree } from '@/structures/btree/btree';
import { HashTable } from '@/structures/hash/hash';
import { SkipList } from '@/structures/skiplist/skiplist';
import { LSMTree } from '@/structures/lsm/lsm';
import { generateSequence } from '@/lib/utils';
import { cn } from '@/lib/utils';

type Metric = 'insert' | 'search' | 'range' | 'space';
type ViewMode = 'chart' | 'table';

interface MetricResult {
  name: string;
  color: string;
  values: Record<Metric, number>;
}

export default function ComparisonPage() {
  const [dataSize, setDataSize] = useState(50);
  const [dataType, setDataType] = useState<'increasing' | 'decreasing' | 'random' | 'duplicates' | 'normal'>('random');
  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [runId, setRunId] = useState(0);

  const results = useMemo<MetricResult[]>(() => {
    const seq = generateSequence(dataType, dataSize, 1, dataSize * 2);
    const searchKeys = seq.slice(0, Math.min(10, seq.length));

    const benchmarks: MetricResult[] = [];

    const btree = new BTree(4, true);
    let bSteps = 0;
    seq.forEach((k) => { bSteps += btree.insert(k).length; });
    let bSearch = 0;
    searchKeys.forEach((k) => { bSearch += btree.search(k).length; });
    benchmarks.push({
      name: 'B+树',
      color: '#22c55e',
      values: { insert: bSteps, search: bSearch, range: Math.log2(dataSize) * 2, space: dataSize * 1.5 },
    });

    const hash = new HashTable(Math.max(16, dataSize * 2), 'modulo', 'chaining');
    let hSteps = 0;
    seq.forEach((k) => { hSteps += hash.insert(k).length; });
    let hSearch = 0;
    searchKeys.forEach((k) => { hSearch += hash.search(k).length; });
    benchmarks.push({
      name: 'Hash表',
      color: '#3b82f6',
      values: { insert: hSteps, search: hSearch, range: dataSize, space: dataSize * 2.5 },
    });

    const sl = new SkipList(8, 0.5);
    let sSteps = 0;
    seq.forEach((k) => { sSteps += sl.insert(k).length; });
    let sSearch = 0;
    searchKeys.forEach((k) => { sSearch += sl.search(k).length; });
    benchmarks.push({
      name: '跳表',
      color: '#a855f7',
      values: { insert: sSteps, search: sSearch, range: Math.log2(dataSize) * 3, space: dataSize * 2 },
    });

    const lsm = new LSMTree(Math.max(3, Math.floor(dataSize / 10)), 4, 'size-tiered');
    let lSteps = 0;
    seq.forEach((k) => { lSteps += lsm.write(k).length; });
    let lSearch = 0;
    searchKeys.forEach((k) => { lSearch += lsm.read(k).length; });
    benchmarks.push({
      name: 'LSM-Tree',
      color: '#f97316',
      values: { insert: lSteps, search: lSearch, range: Math.log2(dataSize) * 5, space: dataSize * 1.2 },
    });

    return benchmarks;
  }, [runId, dataSize, dataType]);

  const metricLabels: Record<Metric, string> = {
    insert: '插入时间 (操作步数)',
    search: '查找时间 (比较次数)',
    range: '范围查询效率',
    space: '空间占用 (相对)',
  };

  const runBenchmark = () => setRunId((x) => x + 1);

  return (
    <div className="h-full flex flex-col p-4 gap-4 overflow-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">📊 性能对比面板</h2>
          <p className="text-sm text-slate-500">相同数据序列在各索引结构上的性能对比</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap text-sm">
          <label className="flex items-center gap-2">
            数据量 N:
            <input type="number" min={5} max={200} value={dataSize} onChange={(e) => setDataSize(Math.max(5, parseInt(e.target.value) || 50))} className="input w-20" />
          </label>
          <label className="flex items-center gap-2">
            分布:
            <select value={dataType} onChange={(e) => setDataType(e.target.value as any)} className="input w-32">
              <option value="increasing">顺序递增</option>
              <option value="decreasing">顺序递减</option>
              <option value="random">随机分布</option>
              <option value="duplicates">大量重复</option>
              <option value="normal">正态分布</option>
            </select>
          </label>
          <div className="flex rounded overflow-hidden border border-slate-300">
            <button onClick={() => setViewMode('chart')} className={cn('px-3 py-1', viewMode === 'chart' ? 'bg-primary-600 text-white' : 'bg-white')}>📊 柱状图</button>
            <button onClick={() => setViewMode('table')} className={cn('px-3 py-1', viewMode === 'table' ? 'bg-primary-600 text-white' : 'bg-white')}>📋 表格</button>
          </div>
          <button onClick={runBenchmark} className="btn-primary">▶ 运行对比</button>
        </div>
      </div>

      {viewMode === 'chart' ? (
        <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
          {(Object.keys(metricLabels) as Metric[]).map((metric) => {
            const max = Math.max(...results.map((r) => r.values[metric]));
            return (
              <div key={metric} className="card p-4 flex flex-col">
                <h4 className="font-semibold text-sm text-slate-700 mb-3">{metricLabels[metric]}</h4>
                <div className="flex-1 flex items-end gap-3 min-h-[160px]">
                  {results.map((r) => (
                    <div key={r.name} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-xs font-mono font-bold text-slate-700">{r.values[metric].toFixed(0)}</div>
                      <div
                        className="w-full rounded-t transition-all"
                        style={{ height: `${(r.values[metric] / max) * 100}%`, minHeight: 4, background: r.color }}
                      />
                      <div className="text-xs text-slate-600 font-medium">{r.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">数据结构</th>
                {(Object.keys(metricLabels) as Metric[]).map((m) => (
                  <th key={m} className="text-right px-4 py-2 font-semibold">{metricLabels[m]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={r.name} className={cn(i % 2 === 0 && 'bg-slate-50')}>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-3 h-3 rounded" style={{ background: r.color }} />
                      {r.name}
                    </span>
                  </td>
                  {(Object.keys(metricLabels) as Metric[]).map((m) => (
                    <td key={m} className="text-right px-4 py-2 font-mono">{r.values[m].toFixed(1)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card p-4 text-xs text-slate-600">
        <h4 className="font-semibold text-slate-700 mb-2">分析说明</h4>
        <ul className="space-y-1 list-disc pl-5">
          <li><b>Hash表</b>: 等值查询最快 O(1), 但不支持范围查询, 空间占用较大</li>
          <li><b>B+树</b>: 平衡多路搜索树, 支持范围查询, 磁盘友好, O(log n)</li>
          <li><b>跳表</b>: 基于概率的多层链表, 实现简单, 期望 O(log n)</li>
          <li><b>LSM-Tree</b>: 写优化结构, 高写入吞吐, 读放大较高, 适合写密集场景</li>
        </ul>
      </div>
    </div>
  );
}
