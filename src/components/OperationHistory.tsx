import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface OperationRecord {
  id: string;
  type: 'insert' | 'delete' | 'search';
  key: number | string;
  startFrame: number;
  endFrame: number;
  timestamp: number;
}

interface Props {
  records: OperationRecord[];
  currentFrame: number;
  onJump: (frameIndex: number) => void;
}

const typeConfig = {
  insert: { icon: '➕', label: '插入', color: 'emerald', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', textColor: 'text-emerald-700', dotColor: 'bg-emerald-500' },
  delete: { icon: '🗑️', label: '删除', color: 'red', bgColor: 'bg-red-50', borderColor: 'border-red-200', textColor: 'text-red-700', dotColor: 'bg-red-500' },
  search: { icon: '🔍', label: '搜索', color: 'blue', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', textColor: 'text-blue-700', dotColor: 'bg-blue-500' },
};

export default function OperationHistory({ records, currentFrame, onJump }: Props) {
  if (records.length === 0) {
    return (
      <div className="card p-4">
        <h3 className="font-semibold text-slate-800 mb-2 text-sm">📋 操作历史</h3>
        <div className="text-xs text-slate-400 text-center py-6">暂无操作记录</div>
      </div>
    );
  }

  const getCurrentOperationIndex = () => {
    for (let i = records.length - 1; i >= 0; i--) {
      if (currentFrame >= records[i].startFrame) return i;
    }
    return -1;
  };

  const currentOpIndex = getCurrentOperationIndex();

  return (
    <div className="card p-4">
      <h3 className="font-semibold text-slate-800 mb-3 text-sm flex items-center justify-between">
        <span>📋 操作历史</span>
        <span className="text-xs font-normal text-slate-500">{records.length} 条记录</span>
      </h3>
      <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
        {records.map((record, index) => {
          const config = typeConfig[record.type];
          const isActive = index === currentOpIndex;
          const isPast = currentFrame > record.endFrame;
          const isCurrent = currentFrame >= record.startFrame && currentFrame <= record.endFrame;

          return (
            <motion.div
              key={record.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.02 }}
              onClick={() => onJump(record.startFrame)}
              className={cn(
                'relative pl-6 pr-3 py-2 rounded-lg cursor-pointer transition-all border',
                isActive ? `${config.bgColor} ${config.borderColor}` : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
              )}
            >
              <div className={cn(
                'absolute left-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white',
                config.dotColor,
                isCurrent ? 'ring-2 ring-offset-1 ' + config.dotColor.replace('bg-', 'ring-') : '',
                isPast ? 'opacity-60' : ''
              )} />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm">{config.icon}</span>
                  <span className={cn('text-xs font-medium', config.textColor)}>{config.label}</span>
                  <span className="font-mono text-sm font-semibold text-slate-800 truncate">
                    {record.key}
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-mono flex-shrink-0">
                  帧 {record.startFrame}-{record.endFrame}
                </span>
              </div>
              {isCurrent && (
                <motion.div
                  className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full"
                  initial={{ height: 0 }}
                  animate={{ height: '100%' }}
                  style={{ background: config.dotColor.replace('bg-', '') }}
                />
              )}
            </motion.div>
          );
        })}
      </div>
      <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
        💡 点击任意记录可跳转到对应帧
      </div>
    </div>
  );
}
