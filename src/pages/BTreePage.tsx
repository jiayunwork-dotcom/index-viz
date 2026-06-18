import { useState, useCallback, useEffect } from 'react';
import { BTree } from '@/structures/btree/btree';
import { useAnimationStore } from '@/store/animationStore';
import AnimationControls from '@/components/AnimationControls';
import DataInput from '@/components/DataInput';
import BTreeCanvas from '@/components/btree/BTreeCanvas';
import OperationHistory from '@/components/OperationHistory';
import type { OperationRecord } from '@/components/OperationHistory';
import { uid } from '@/lib/utils';

export default function BTreePage() {
  const [order, setOrder] = useState(4);
  const [isPlus, setIsPlus] = useState(false);
  const [tree, setTree] = useState(() => new BTree(4, false));
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [operationHistory, setOperationHistory] = useState<OperationRecord[]>([]);

  const { frames, currentFrame, setFrames, goToFrame } = useAnimationStore();

  useEffect(() => {
    const newTree = new BTree(order, isPlus);
    setTree(newTree);
    setFrames([]);
    setOperationHistory([]);
  }, [order, isPlus, setFrames]);

  const handleInsert = useCallback(
    (keys: number[]) => {
      const allFrames: any[] = [];
      const newRecords: OperationRecord[] = [];
      let frameOffset = frames.length;

      keys.forEach((k) => {
        const startFrame = frameOffset;
        const fs = tree.insert(k);
        allFrames.push(...fs);
        const endFrame = frameOffset + fs.length - 1;
        newRecords.push({
          id: uid(),
          type: 'insert',
          key: k,
          startFrame,
          endFrame,
          timestamp: Date.now() + k,
        });
        frameOffset += fs.length;
      });

      setTree(new BTree(order, isPlus));
      if (allFrames.length > 0) {
        setFrames(allFrames);
        setOperationHistory(newRecords);
      }
    },
    [tree, order, isPlus, setFrames, frames.length]
  );

  const handleSearch = useCallback(
    (key: number) => {
      const fs = tree.search(key);
      if (fs.length > 0) {
        setFrames(fs);
        setOperationHistory([{
          id: uid(),
          type: 'search',
          key,
          startFrame: 0,
          endFrame: fs.length - 1,
          timestamp: Date.now(),
        }]);
      }
    },
    [tree, setFrames]
  );

  const handleDelete = useCallback(
    (key: number) => {
      const fs = tree.delete(key);
      if (fs.length > 0) {
        setFrames(fs);
        setOperationHistory([{
          id: uid(),
          type: 'delete',
          key,
          startFrame: 0,
          endFrame: fs.length - 1,
          timestamp: Date.now(),
        }]);
      }
    },
    [tree, setFrames]
  );

  const handleRange = useCallback(() => {
    const s = parseInt(rangeStart), e = parseInt(rangeEnd);
    if (!isNaN(s) && !isNaN(e) && isPlus) {
      const fs = tree.rangeQuery(s, e);
      if (fs.length > 0) setFrames(fs);
    }
  }, [tree, rangeStart, rangeEnd, isPlus, setFrames]);

  const handleClear = useCallback(() => {
    setTree(new BTree(order, isPlus));
    setFrames([]);
    setOperationHistory([]);
  }, [order, isPlus, setFrames]);

  const currentFrameData = frames[currentFrame]?.data ?? null;

  return (
    <div className="h-full flex flex-col p-4 gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            🌳 {isPlus ? 'B+树' : 'B树'} 可视化
          </h2>
          <p className="text-sm text-slate-500">支持插入/搜索/删除动画展示</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPlus}
              onChange={(e) => setIsPlus(e.target.checked)}
              className="accent-primary-600"
            />
            B+树模式
          </label>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-600">阶数 M:</span>
            <input
              type="range"
              min={3}
              max={7}
              value={order}
              onChange={(e) => setOrder(parseInt(e.target.value))}
              className="accent-primary-600 w-24"
            />
            <span className="font-semibold w-6">{order}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <aside className="w-72 flex-shrink-0 space-y-4 overflow-y-auto">
          <DataInput
            onInsert={handleInsert}
            onSearch={handleSearch}
            onDelete={handleDelete}
            onClear={handleClear}
          />
          {isPlus && (
            <div className="card p-4">
              <h3 className="font-semibold text-slate-800 mb-3 text-sm">范围查询</h3>
              <div className="flex gap-2 items-center mb-2">
                <input
                  type="number"
                  placeholder="起始"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  className="input w-24"
                />
                <span className="text-slate-400">~</span>
                <input
                  type="number"
                  placeholder="结束"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  className="input w-24"
                />
              </div>
              <button onClick={handleRange} className="btn-primary w-full">
                范围查询
              </button>
            </div>
          )}
          <div className="card p-4 text-xs text-slate-600 space-y-1.5">
            <p className="font-semibold text-slate-700">说明:</p>
            <p>• 最大 key 数: M-1 = {order - 1}</p>
            <p>• 最小 key 数: ⌈M/2⌉-1 = {Math.ceil(order / 2) - 1}</p>
            <p>• {isPlus ? 'B+树: 所有数据在叶节点，叶间链表相连' : 'B树: 数据分布在所有节点'}</p>
          </div>
        </aside>

        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <div className="card flex-1 overflow-hidden p-2 min-h-0">
            <BTreeCanvas frame={currentFrameData} />
          </div>
          <AnimationControls />
          <OperationHistory
            records={operationHistory}
            currentFrame={currentFrame}
            onJump={goToFrame}
          />
        </div>
      </div>
    </div>
  );
}
