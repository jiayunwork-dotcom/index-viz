import { useState, useCallback, useEffect } from 'react';
import { SkipList } from '@/structures/skiplist/skiplist';
import { useAnimationStore } from '@/store/animationStore';
import AnimationControls from '@/components/AnimationControls';
import DataInput from '@/components/DataInput';
import SkipListCanvas from '@/components/skiplist/SkipListCanvas';

export default function SkipListPage() {
  const [maxLevel, setMaxLevel] = useState(6);
  const [prob, setProb] = useState(0.5);
  const [list, setList] = useState(() => new SkipList(6, 0.5));
  const { frames, currentFrame, setFrames } = useAnimationStore();

  useEffect(() => {
    setList(new SkipList(maxLevel, prob));
    setFrames([]);
  }, [maxLevel, prob, setFrames]);

  const handleInsert = useCallback((keys: number[]) => {
    const all: any[] = [];
    keys.forEach((k) => all.push(...list.insert(k)));
    if (all.length > 0) setFrames(all);
  }, [list, setFrames]);

  const handleSearch = useCallback((key: number) => {
    const fs = list.search(key);
    if (fs.length > 0) setFrames(fs);
  }, [list, setFrames]);

  const handleDelete = useCallback((key: number) => {
    const fs = list.delete(key);
    if (fs.length > 0) setFrames(fs);
  }, [list, setFrames]);

  const handleClear = useCallback(() => {
    setList(new SkipList(maxLevel, prob));
    setFrames([]);
  }, [maxLevel, prob, setFrames]);

  return (
    <div className="h-full flex flex-col p-4 gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">🎿 跳表可视化</h2>
          <p className="text-sm text-slate-500">多层链表索引，概率层高分布</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap text-sm">
          <label className="flex items-center gap-2">
            最大层数:
            <input type="number" min={2} max={16} value={maxLevel} onChange={(e) => setMaxLevel(Math.max(2, parseInt(e.target.value) || 2))} className="input w-20" />
          </label>
          <label className="flex items-center gap-2">
            升层概率:
            <input type="number" step={0.1} min={0.1} max={0.9} value={prob} onChange={(e) => setProb(parseFloat(e.target.value) || 0.5)} className="input w-20" />
          </label>
        </div>
      </div>
      <div className="flex-1 flex gap-4 min-h-0">
        <aside className="w-72 flex-shrink-0 space-y-4 overflow-y-auto">
          <DataInput onInsert={handleInsert} onSearch={handleSearch} onDelete={handleDelete} onClear={handleClear} />
          <div className="card p-4 text-xs text-slate-600 space-y-1.5">
            <p className="font-semibold text-slate-700">说明:</p>
            <p>• 底层是完整有序链表</p>
            <p>• 每个节点以概率 {prob} 上升一层</p>
            <p>• 搜索从最高层开始, 向下收敛</p>
            <p>• 时间复杂度期望 O(log n)</p>
          </div>
        </aside>
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <div className="card flex-1 overflow-hidden min-h-0">
            <SkipListCanvas frame={frames[currentFrame]?.data ?? null} />
          </div>
          <AnimationControls />
        </div>
      </div>
    </div>
  );
}
