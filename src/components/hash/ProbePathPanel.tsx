import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { HashState } from '@/structures/hash/types';

interface Props {
  frame: HashState | null;
  totalProbeCount: number;
  totalOperations: number;
}

export default function ProbePathPanel({ frame, totalProbeCount, totalOperations }: Props) {
  if (!frame || frame.strategy === 'chaining') {
    return null;
  }

  const { highlighting } = frame;
  const probePath = highlighting.probePath || [];
  const action = highlighting.action;

  if (probePath.length === 0 || !action || action === 'rehash' || action === 'delete') {
    return (
      <div className="card p-4">
        <h3 className="font-semibold text-slate-800 mb-2 text-sm">🔍 探测路径</h3>
        <div className="text-xs text-slate-400 text-center py-4">
          执行插入或搜索操作后显示探测路径
        </div>
      </div>
    );
  }

  const currentBucket = highlighting.bucketIndex;
  const probeCount = probePath.length;
  const avgProbe = totalOperations > 0 ? (totalProbeCount / totalOperations).toFixed(2) : '0.00';

  const getBucketStatus = (bucketIndex: number, index: number): 'collision' | 'target' | 'current' => {
    const isLast = index === probePath.length - 1;
    
    if (bucketIndex === currentBucket && isLast) {
      return 'target';
    }
    if (bucketIndex === currentBucket) {
      return 'current';
    }
    return 'collision';
  };

  const actionLabel = action === 'insert' ? '插入' : action === 'search' ? '搜索' : '操作';

  return (
    <div className="card p-4">
      <h3 className="font-semibold text-slate-800 mb-3 text-sm flex items-center justify-between">
        <span>🔍 探测路径</span>
        <span className="text-xs font-normal text-slate-500">{actionLabel}中</span>
      </h3>

      <div className="mb-3">
        <div className="text-xs text-slate-500 mb-2">探测序列 ({probeCount} 步)</div>
        <div className="flex flex-wrap items-center gap-1">
          <AnimatePresence mode="popLayout">
            {probePath.map((bucketIdx, i) => {
              const status = getBucketStatus(bucketIdx, i);
              const isLast = i === probePath.length - 1;
              
              return (
                <motion.div
                  key={`${bucketIdx}-${i}`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ delay: i * 0.05, type: 'spring', stiffness: 500, damping: 30 }}
                  className="flex items-center"
                >
                  <div
                    className={cn(
                      'w-10 h-8 rounded flex items-center justify-center font-mono text-xs font-bold border-2',
                      status === 'target' && 'bg-green-100 border-green-500 text-green-700',
                      status === 'current' && !isLast && 'bg-red-100 border-red-500 text-red-700',
                      status === 'collision' && 'bg-red-50 border-red-300 text-red-600'
                    )}
                  >
                    {bucketIdx}
                  </div>
                  {!isLast && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 + 0.03 }}
                      className="text-slate-400 mx-0.5 text-sm"
                    >
                      →
                    </motion.span>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3 text-xs">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-100 border border-red-300"></span>
          <span className="text-slate-500">碰撞桶</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-100 border border-green-500"></span>
          <span className="text-slate-500">最终位置</span>
        </span>
      </div>

      <div className="border-t border-slate-100 pt-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-50 rounded p-2 text-center">
            <div className="text-xs text-slate-500">本次探测</div>
            <div className="text-lg font-bold text-blue-600 font-mono">{probeCount}</div>
          </div>
          <div className="bg-slate-50 rounded p-2 text-center">
            <div className="text-xs text-slate-500">累计平均</div>
            <div className="text-lg font-bold text-purple-600 font-mono">{avgProbe}</div>
          </div>
        </div>
        <div className="mt-2 text-xs text-slate-400 text-center">
          共 {totalOperations} 次探测操作
        </div>
      </div>
    </div>
  );
}
