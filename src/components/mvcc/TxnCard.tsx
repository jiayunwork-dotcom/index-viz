import { forwardRef } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { useMVCCStore } from '@/store/mvccStore';
import type { Transaction } from '@/structures/mvcc/types';
import { cn } from '@/lib/utils';
import type { MutableRefObject } from 'react';

interface TxnCardProps {
  txn: Transaction;
  index: number;
  dragIndexRef: MutableRefObject<number | null>;
  onOpenWrite: (txnId: string) => void;
  onOpenRead: (txnId: string) => void;
}

const statusConfig = {
  active: { label: '活跃', color: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  committed: { label: '已提交', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  aborted: { label: '已回滚', color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
};

const TxnCard = forwardRef<HTMLDivElement, TxnCardProps>(function TxnCard(
  { txn, index, dragIndexRef, onOpenWrite, onOpenRead },
  ref
) {
  const { commitTransaction, abortTransaction, isAnimating } = useMVCCStore();
  const controls = useDragControls();
  const cfg = statusConfig[txn.status];
  const isActive = txn.status === 'active';

  return (
    <Reorder.Item
      value={txn}
      dragListener={false}
      dragControls={controls}
      onDragStart={() => {
        dragIndexRef.current = index;
      }}
      onDragEnd={() => {
        dragIndexRef.current = null;
      }}
      ref={ref}
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -20, scale: 0.9 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn(
        'card p-3 transition-shadow hover:shadow-md',
        txn.status === 'aborted' && 'opacity-70'
      )}
      style={{ position: 'relative' }}
    >
      <div className="flex items-start justify-between mb-2" style={{ pointerEvents: 'auto' }}>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800 text-white font-bold text-sm select-none',
              !isAnimating && 'cursor-grab active:cursor-grabbing'
            )}
            title="拖拽此方块可排序"
            onPointerDown={(e) => {
              if (isAnimating) return;
              dragIndexRef.current = index;
              controls.start(e);
            }}
          >
            T{txn.txnNum}
          </div>
          <div className="select-none">
            <div className="text-xs text-slate-500">事务 ID</div>
            <div className="font-semibold text-slate-800 text-sm">T{txn.txnNum}</div>
          </div>
        </div>
        <span className={cn('text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 select-none', cfg.color)}>
          <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot, isActive && 'animate-pulse')} />
          {cfg.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3 text-xs select-none" style={{ pointerEvents: 'auto' }}>
        <div className="bg-slate-50 rounded px-2 py-1.5">
          <div className="text-slate-400">开始时间戳</div>
          <div className="font-mono font-semibold text-slate-700">{txn.startTs}</div>
        </div>
        <div className="bg-slate-50 rounded px-2 py-1.5">
          <div className="text-slate-400">快照时间戳</div>
          <div className="font-mono font-semibold text-slate-700">{txn.snapshotTs}</div>
        </div>
      </div>

      <div className="flex gap-1.5" style={{ pointerEvents: 'auto', position: 'relative', zIndex: 10 }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onOpenRead(txn.txnId);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={!isActive || isAnimating}
          className="flex-1 btn-secondary text-xs py-1"
          style={{ pointerEvents: 'auto' }}
        >
          读取
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onOpenWrite(txn.txnId);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={!isActive || isAnimating}
          className="flex-1 btn-secondary text-xs py-1"
          style={{ pointerEvents: 'auto' }}
        >
          写入
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            commitTransaction(txn.txnId);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={!isActive || isAnimating}
          className="flex-1 btn-success text-xs py-1"
          style={{ pointerEvents: 'auto' }}
        >
          提交
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            abortTransaction(txn.txnId);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={!isActive || isAnimating}
          className="flex-1 btn-danger text-xs py-1"
          style={{ pointerEvents: 'auto' }}
        >
          回滚
        </button>
      </div>

      {txn.writes.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-100" style={{ pointerEvents: 'auto' }}>
          <div className="text-xs text-slate-400 mb-1">已写入行:</div>
          <div className="flex flex-wrap gap-1">
            {txn.writes.map((w) => (
              <span key={w.versionId} className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">
                #{w.rowId}
              </span>
            ))}
          </div>
        </div>
      )}
    </Reorder.Item>
  );
});

export default TxnCard;
