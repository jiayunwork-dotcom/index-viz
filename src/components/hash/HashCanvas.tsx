import { motion, AnimatePresence } from 'framer-motion';
import type { HashState } from '@/structures/hash/types';
import { cn } from '@/lib/utils';

interface Props {
  frame: HashState | null;
}

export default function HashCanvas({ frame }: Props) {
  if (!frame) {
    return <div className="flex items-center justify-center h-full text-slate-400">插入数据开始可视化</div>;
  }

  const { buckets, highlighting } = frame;
  const isChaining = frame.strategy === 'chaining';

  return (
    <div className="h-full overflow-auto p-6">
      <div className="flex flex-col gap-2">
        {buckets.map((bucket) => {
          const isHlBucket = highlighting.bucketIndex === bucket.index;
          const inProbePath = highlighting.probePath?.includes(bucket.index);
          const isEmpty = bucket.entries.length === 0;

          return (
            <div key={bucket.index} className="flex items-start gap-3">
              <div className="w-10 text-right text-xs text-slate-400 font-mono pt-2">
                [{bucket.index}]
              </div>

              <div className="flex items-start gap-2 flex-1">
                <motion.div
                  className={cn(
                    'w-16 h-12 rounded border-2 flex items-center justify-center font-mono text-sm',
                    isHlBucket && frame.highlighting.action === 'insert' && 'border-emerald-500 bg-emerald-50',
                    isHlBucket && frame.highlighting.action === 'search' && 'border-blue-500 bg-blue-50',
                    isHlBucket && frame.highlighting.action === 'delete' && 'border-red-500 bg-red-50',
                    inProbePath && !isHlBucket && 'border-amber-400 bg-amber-50',
                    !isHlBucket && !inProbePath && (isEmpty ? 'border-dashed border-slate-300 bg-slate-50' : 'border-slate-300 bg-white')
                  )}
                  layout
                >
                  {bucket.entries.length > 0 && !isChaining && !bucket.entries[0].isTombstone && (
                    <span className="font-semibold">{bucket.entries[0].key}</span>
                  )}
                  {bucket.entries.length > 0 && !isChaining && bucket.entries[0].isTombstone && (
                    <span className="text-slate-400 line-through">{bucket.entries[0].key}</span>
                  )}
                  {bucket.entries.length === 0 && <span className="text-slate-300 text-xs">空</span>}
                </motion.div>

                {isChaining && bucket.entries.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {bucket.entries.map((entry, i) => {
                      const isHlEntry = isHlBucket && highlighting.chainIndex === i;
                      const isInserting = isHlEntry && highlighting.action === 'insert';
                      return (
                        <div key={entry.id} className="flex items-center">
                          {i > 0 && <span className="text-slate-400 mx-0.5">→</span>}
                          <motion.div
                            initial={isInserting ? { scale: 0, x: -20 } : false}
                            animate={{ scale: 1, x: 0 }}
                            className={cn(
                              'w-12 h-10 rounded border-2 flex items-center justify-center font-mono text-sm font-semibold',
                              isHlEntry && highlighting.action === 'insert' && 'border-emerald-500 bg-emerald-100 text-emerald-800',
                              isHlEntry && highlighting.action === 'search' && 'border-green-500 bg-green-100 text-green-800',
                              isHlEntry && highlighting.action === 'delete' && 'border-red-500 bg-red-100 text-red-800 line-through',
                              !isHlEntry && 'border-slate-300 bg-white text-slate-700'
                            )}
                          >
                            {entry.key}
                          </motion.div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {highlighting.rehashing && highlighting.oldBuckets && (
        <div className="mt-8 p-4 border-2 border-dashed border-slate-400 rounded-lg bg-slate-50">
          <h4 className="text-sm font-semibold text-slate-600 mb-2">旧哈希表 (rehash 中...)</h4>
          <div className="flex flex-wrap gap-1">
            {highlighting.oldBuckets.map((b) => (
              <div key={b.index} className="text-xs">
                {b.entries.length > 0 && (
                  <div className="px-2 py-1 bg-orange-100 border border-orange-300 rounded font-mono">
                    {b.entries.map((e) => e.key).join(',')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
