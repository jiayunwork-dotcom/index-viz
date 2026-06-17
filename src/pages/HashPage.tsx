import { useState, useCallback, useEffect } from 'react';
import { HashTable } from '@/structures/hash/hash';
import { useAnimationStore } from '@/store/animationStore';
import AnimationControls from '@/components/AnimationControls';
import DataInput from '@/components/DataInput';
import HashCanvas from '@/components/hash/HashCanvas';
import type { CollisionStrategy, HashMethod } from '@/structures/hash/types';

export default function HashPage() {
  const [size, setSize] = useState(8);
  const [method, setMethod] = useState<HashMethod>('modulo');
  const [strategy, setStrategy] = useState<CollisionStrategy>('chaining');
  const [table, setTable] = useState(() => new HashTable(8, 'modulo', 'chaining'));

  const { frames, currentFrame, setFrames } = useAnimationStore();

  useEffect(() => {
    setTable(new HashTable(size, method, strategy));
    setFrames([]);
  }, [size, method, strategy, setFrames]);

  const handleInsert = useCallback(
    (keys: number[]) => {
      const all: any[] = [];
      keys.forEach((k) => all.push(...table.insert(k)));
      if (all.length > 0) setFrames(all);
    },
    [table, setFrames]
  );

  const handleSearch = useCallback(
    (key: number) => {
      const fs = table.search(key);
      if (fs.length > 0) setFrames(fs);
    },
    [table, setFrames]
  );

  const handleDelete = useCallback(
    (key: number) => {
      const fs = table.delete(key);
      if (fs.length > 0) setFrames(fs);
    },
    [table, setFrames]
  );

  const handleClear = useCallback(() => {
    setTable(new HashTable(size, method, strategy));
    setFrames([]);
  }, [size, method, strategy, setFrames]);

  const currentFrameData = frames[currentFrame]?.data ?? null;

  return (
    <div className="h-full flex flex-col p-4 gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">🔑 Hash 索引可视化</h2>
          <p className="text-sm text-slate-500">支持开放寻址与链式寻址</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-600">哈希函数:</span>
            <select value={method} onChange={(e) => setMethod(e.target.value as HashMethod)} className="input w-32">
              <option value="modulo">取模法</option>
              <option value="multiplication">乘法散列</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-600">碰撞处理:</span>
            <select value={strategy} onChange={(e) => setStrategy(e.target.value as CollisionStrategy)} className="input w-32">
              <option value="chaining">链式法</option>
              <option value="linear">线性探测</option>
              <option value="quadratic">二次探测</option>
              <option value="double">双重散列</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-600">桶数量:</span>
            <input type="number" min={2} max={64} value={size} onChange={(e) => setSize(Math.max(2, parseInt(e.target.value) || 2))} className="input w-20" />
          </label>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <aside className="w-72 flex-shrink-0 space-y-4 overflow-y-auto">
          <DataInput onInsert={handleInsert} onSearch={handleSearch} onDelete={handleDelete} onClear={handleClear} />
          <div className="card p-4 space-y-2 text-sm">
            <h3 className="font-semibold text-slate-800">实时统计</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 rounded p-2 text-center">
                <div className="text-xs text-slate-500">负载因子</div>
                <div className="text-lg font-bold text-blue-600">
                  {currentFrameData?.loadFactor?.toFixed(2) ?? (table.loadFactor).toFixed(2)}
                </div>
              </div>
              <div className="bg-slate-50 rounded p-2 text-center">
                <div className="text-xs text-slate-500">碰撞次数</div>
                <div className="text-lg font-bold text-orange-600">
                  {currentFrameData?.collisionCount ?? table.collisionCount}
                </div>
              </div>
              <div className="bg-slate-50 rounded p-2 text-center col-span-2">
                <div className="text-xs text-slate-500">最长链长度</div>
                <div className="text-lg font-bold text-purple-600">
                  {currentFrameData?.maxChainLength ?? table.maxChainLength}
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <div className="card flex-1 overflow-hidden min-h-0">
            <HashCanvas frame={currentFrameData} />
          </div>
          <AnimationControls />
        </div>
      </div>
    </div>
  );
}
