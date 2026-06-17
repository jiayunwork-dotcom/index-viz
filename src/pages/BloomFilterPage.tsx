import { useState, useCallback, useEffect } from 'react';
import { BloomFilter } from '@/structures/bloom/bloom';
import { useAnimationStore } from '@/store/animationStore';
import AnimationControls from '@/components/AnimationControls';
import BloomCanvas from '@/components/bloom/BloomCanvas';

export default function BloomFilterPage() {
  const [m, setM] = useState(64);
  const [k, setK] = useState(4);
  const [bf, setBf] = useState(() => new BloomFilter(64, 4));
  const [inputVal, setInputVal] = useState('');
  const [queryVal, setQueryVal] = useState('');
  const { frames, currentFrame, setFrames } = useAnimationStore();

  useEffect(() => {
    setBf(new BloomFilter(m, k));
    setFrames([]);
  }, [m, k, setFrames]);

  const handleInsert = useCallback(() => {
    if (!inputVal.trim()) return;
    const fs = bf.insert(inputVal.trim());
    setInputVal('');
    if (fs.length > 0) setFrames(fs);
  }, [bf, inputVal, setFrames]);

  const handleQuery = useCallback(() => {
    if (!queryVal.trim()) return;
    const fs = bf.query(queryVal.trim());
    setQueryVal('');
    if (fs.length > 0) setFrames(fs);
  }, [bf, queryVal, setFrames]);

  const handleInsertNumbers = useCallback((keys: number[]) => {
    const all: any[] = [];
    keys.forEach((k) => all.push(...bf.insert(String(k))));
    if (all.length > 0) setFrames(all);
  }, [bf, setFrames]);

  const handleClear = useCallback(() => {
    setBf(new BloomFilter(m, k));
    setFrames([]);
  }, [m, k, setFrames]);

  return (
    <div className="h-full flex flex-col p-4 gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">🌸 布隆过滤器可视化</h2>
          <p className="text-sm text-slate-500">概率型数据结构, 空间效率极高</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap text-sm">
          <label className="flex items-center gap-2">位数组 m:
            <input type="number" min={8} max={512} value={m} onChange={(e) => setM(Math.max(8, parseInt(e.target.value) || 8))} className="input w-20" />
          </label>
          <label className="flex items-center gap-2">哈希函数 k:
            <input type="number" min={1} max={12} value={k} onChange={(e) => setK(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))} className="input w-20" />
          </label>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <aside className="w-72 flex-shrink-0 space-y-4 overflow-y-auto">
          <div className="card p-4 space-y-3">
            <h3 className="font-semibold text-slate-800">数据操作</h3>
            <div>
              <label className="block text-xs text-slate-600 mb-1">插入元素</label>
              <div className="flex gap-2">
                <input type="text" value={inputVal} onChange={(e) => setInputVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleInsert()} placeholder="任意字符串/数字" className="input flex-1" />
                <button onClick={handleInsert} className="btn-primary">插入</button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">查询元素</label>
              <div className="flex gap-2">
                <input type="text" value={queryVal} onChange={(e) => setQueryVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleQuery()} placeholder="任意字符串/数字" className="input flex-1" />
                <button onClick={handleQuery} className="btn-success">查询</button>
              </div>
            </div>
            <div className="border-t border-slate-200 pt-3">
              <label className="block text-xs text-slate-600 mb-1">批量插入数字 (预设)</label>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => handleInsertNumbers([10, 20, 30, 40, 50])} className="btn-secondary text-xs">插入示例</button>
                <button onClick={() => handleInsertNumbers(Array.from({ length: 10 }, (_, i) => i + 1))} className="btn-secondary text-xs">1-10</button>
              </div>
            </div>
            <button onClick={handleClear} className="btn-secondary w-full mt-2">清空</button>
          </div>

          <div className="card p-4 text-xs text-slate-600 space-y-1.5">
            <p className="font-semibold text-slate-700">说明:</p>
            <p>• k 个哈希函数独立计算位置</p>
            <p>• 支持"可能存在"和"一定不存在"</p>
            <p>• FPR 随元素增多单调上升</p>
            <p>• 无法删除元素 (标准布隆过滤器)</p>
          </div>
        </aside>

        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <div className="card flex-1 overflow-hidden min-h-0">
            <BloomCanvas frame={frames[currentFrame]?.data ?? null} />
          </div>
          <AnimationControls />
        </div>
      </div>
    </div>
  );
}
