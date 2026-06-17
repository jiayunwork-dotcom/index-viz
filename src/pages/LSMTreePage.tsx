import { useState, useCallback, useEffect } from 'react';
import { LSMTree } from '@/structures/lsm/lsm';
import { useAnimationStore } from '@/store/animationStore';
import AnimationControls from '@/components/AnimationControls';
import type { LSMState, Strategy } from '@/structures/lsm/types';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function LSMTreePage() {
  const [memCap, setMemCap] = useState(5);
  const [strategy, setStrategy] = useState<Strategy>('size-tiered');
  const [lsm, setLsm] = useState(() => new LSMTree(5, 4, 'size-tiered'));
  const [writeKey, setWriteKey] = useState('');
  const [readKey, setReadKey] = useState('');
  const { frames, currentFrame, setFrames } = useAnimationStore();

  useEffect(() => {
    setLsm(new LSMTree(memCap, 4, strategy));
    setFrames([]);
  }, [memCap, strategy, setFrames]);

  const handleWrite = useCallback(() => {
    const k = parseInt(writeKey);
    if (!isNaN(k)) {
      const fs = lsm.write(k);
      setWriteKey('');
      if (fs.length > 0) setFrames(fs);
    }
  }, [lsm, writeKey, setFrames]);

  const handleWriteBatch = useCallback((keys: number[]) => {
    const all: any[] = [];
    keys.forEach((k) => all.push(...lsm.write(k)));
    if (all.length > 0) setFrames(all);
  }, [lsm, setFrames]);

  const handleRead = useCallback(() => {
    const k = parseInt(readKey);
    if (!isNaN(k)) {
      const fs = lsm.read(k);
      setReadKey('');
      if (fs.length > 0) setFrames(fs);
    }
  }, [lsm, readKey, setFrames]);

  const handleDelete = useCallback(() => {
    const k = parseInt(readKey);
    if (!isNaN(k)) {
      const fs = lsm.delete(k);
      setReadKey('');
      if (fs.length > 0) setFrames(fs);
    }
  }, [lsm, readKey, setFrames]);

  const handleClear = useCallback(() => {
    setLsm(new LSMTree(memCap, 4, strategy));
    setFrames([]);
  }, [memCap, strategy, setFrames]);

  const frame: LSMState | null = frames[currentFrame]?.data ?? null;

  return (
    <div className="h-full flex flex-col p-4 gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">📚 LSM-Tree 可视化</h2>
          <p className="text-sm text-slate-500">写优化存储结构, MemTable → SSTable → Compaction</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap text-sm">
          <label className="flex items-center gap-2">策略:
            <select value={strategy} onChange={(e) => setStrategy(e.target.value as Strategy)} className="input w-32">
              <option value="size-tiered">Size-Tiered</option>
              <option value="leveled">Leveled</option>
            </select>
          </label>
          <label className="flex items-center gap-2">MemTable容量:
            <input type="number" min={2} max={20} value={memCap} onChange={(e) => setMemCap(Math.max(2, parseInt(e.target.value) || 5))} className="input w-20" />
          </label>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <aside className="w-72 flex-shrink-0 space-y-4 overflow-y-auto">
          <div className="card p-4 space-y-3">
            <h3 className="font-semibold text-slate-800">操作</h3>
            <div>
              <label className="block text-xs text-slate-600 mb-1">写入 key</label>
              <div className="flex gap-2">
                <input type="number" value={writeKey} onChange={(e) => setWriteKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleWrite()} className="input flex-1" placeholder="整数" />
                <button onClick={handleWrite} className="btn-primary">写入</button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">读取/删除 key</label>
              <div className="flex gap-2">
                <input type="number" value={readKey} onChange={(e) => setReadKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRead()} className="input flex-1" placeholder="整数" />
                <button onClick={handleRead} className="btn-success">读</button>
                <button onClick={handleDelete} className="btn-danger">删</button>
              </div>
            </div>
            <div className="border-t pt-3 flex gap-2 flex-wrap">
              <button onClick={() => handleWriteBatch([10, 20, 30, 40, 50, 60, 70])} className="btn-secondary text-xs">顺序写入7个</button>
              <button onClick={() => handleWriteBatch([5, 15, 3, 25, 7, 35, 9])} className="btn-secondary text-xs">随机写入7个</button>
            </div>
            <button onClick={handleClear} className="btn-secondary w-full">清空</button>
          </div>

          <div className="card p-4 text-xs text-slate-600 space-y-1.5">
            <p className="font-semibold text-slate-700">说明:</p>
            <p>• 写入先到内存 MemTable (红黑树有序)</p>
            <p>• 满了刷盘成 L0 SSTable</p>
            <p>• SSTable 积累触发 Compaction</p>
            <p>• 删除用墓碑标记, Compaction 时清除</p>
            <p>• 读取: MemTable → 逐层 SSTable + 布隆过滤器</p>
          </div>
        </aside>

        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <div className="card flex-1 overflow-auto min-h-0 p-4">
            {frame ? <LSMCanvas state={frame} /> : (
              <div className="flex items-center justify-center h-full text-slate-400">写入数据开始可视化</div>
            )}
          </div>
          <AnimationControls />
        </div>
      </div>
    </div>
  );
}

function LSMCanvas({ state }: { state: LSMState }) {
  const { memtable, levels, highlighting } = state;

  return (
    <div className="space-y-4">
      <div className="card p-4 border-2 border-emerald-300 bg-emerald-50">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-emerald-800">🧠 MemTable (内存)</h4>
          <span className="text-xs text-emerald-700">{memtable.entries.length} / {memtable.capacity}</span>
        </div>
        <div className="h-2 bg-emerald-200 rounded mb-2 overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(memtable.entries.length / memtable.capacity) * 100}%` }} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <AnimatePresence>
            {memtable.entries.map((e, i) => (
              <motion.div
                key={`mem-${e.key}-${i}`}
                initial={{ scale: 0, x: -20 }}
                animate={{ scale: 1, x: 0 }}
                exit={{ scale: 0 }}
                className={cn(
                  'px-2 py-1 rounded text-xs font-mono border',
                  e.tombstone ? 'bg-red-100 text-red-700 border-red-300 line-through' : 'bg-white border-slate-300 text-slate-700',
                  highlighting.writingEntry?.key === e.key && 'ring-2 ring-emerald-500'
                )}
              >
                {e.key}:{e.value || '×'}
              </motion.div>
            ))}
          </AnimatePresence>
          {memtable.entries.length === 0 && <span className="text-xs text-emerald-500">空</span>}
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-semibold text-slate-700 text-sm">💾 磁盘 SSTable 层级</h4>
        {levels.map((lvl, i) => (
          <div key={i} className="card p-3">
            <div className="text-xs font-semibold text-slate-600 mb-2">L{i}</div>
            <div className="flex flex-wrap gap-2">
              {lvl.length === 0 && <span className="text-xs text-slate-400">空</span>}
              <AnimatePresence>
                {lvl.map((sst) => {
                  const isCompact = highlighting.compaction?.tables.includes(sst.id);
                  const isNew = highlighting.compaction?.newTableId === sst.id;
                  const readInfo = highlighting.readPath?.checkedLevels?.find((c) => c.tableId === sst.id);
                  return (
                    <motion.div
                      key={sst.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: isCompact ? [1, 1.05, 1] : 1,
                      }}
                      transition={{ duration: 0.3 }}
                      className={cn(
                        'px-3 py-2 rounded border-2 bg-white min-w-[140px]',
                        isCompact && 'border-orange-400 bg-orange-50 animate-pulse',
                        isNew && 'border-green-400 bg-green-50',
                        readInfo?.result === 'found' && 'border-green-500 bg-green-50',
                        readInfo?.result === 'miss' && 'border-slate-300',
                        readInfo?.result === 'tombstone' && 'border-red-400 bg-red-50',
                        !isCompact && !isNew && !readInfo && 'border-slate-200'
                      )}
                    >
                      <div className="text-xs font-mono text-slate-500 mb-1">{sst.id.slice(0, 6)}</div>
                      <div className="text-xs text-slate-700 font-semibold">{sst.minKey} ~ {sst.maxKey}</div>
                      <div className="flex gap-0.5 mt-1 flex-wrap">
                        {sst.entries.slice(0, 5).map((e) => (
                          <span key={e.key} className="px-1 bg-slate-100 rounded text-[10px] font-mono">
                            {e.key}{e.tombstone && '×'}
                          </span>
                        ))}
                        {sst.entries.length > 5 && <span className="text-[10px] text-slate-400">+{sst.entries.length - 5}</span>}
                      </div>
                      {readInfo && (
                        <div className="mt-1 text-[10px]">
                          布隆: {readInfo.bloom ? '✅' : '❌'} | {readInfo.result === 'found' ? '命中' : readInfo.result === 'tombstone' ? '墓碑' : '未命中'}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
