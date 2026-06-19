import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { useMVCCStore } from '@/store/mvccStore';
import type { Transaction, WriteDialogState, ReadDialogState } from '@/structures/mvcc/types';
import { INITIAL_ROWS } from '@/structures/mvcc/types';
import { cn } from '@/lib/utils';

interface Props {
  onOpenWrite: (txnId: string) => void;
  onOpenRead: (txnId: string) => void;
}

const statusConfig = {
  active: { label: '活跃', color: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  committed: { label: '已提交', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  aborted: { label: '已回滚', color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
};

export default function TransactionPanel({ onOpenWrite, onOpenRead }: Props) {
  const {
    transactions,
    createTransaction,
    commitTransaction,
    abortTransaction,
    reorderTransactions,
    isAnimating,
  } = useMVCCStore();

  const sorted = [...transactions].sort((a, b) => a.displayOrder - b.displayOrder);
  const dragItem = useRef<number | null>(null);

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnd = () => {
    dragItem.current = null;
  };

  const handleReorder = (newOrder: Transaction[]) => {
    const dragIndex = dragItem.current;
    if (dragIndex === null) return;
    const draggedTxn = sorted[dragIndex];
    const dropIndex = newOrder.findIndex((t) => t.txnId === draggedTxn.txnId);
    if (dropIndex !== -1 && dragIndex !== dropIndex) {
      reorderTransactions(dragIndex, dropIndex);
    }
    dragItem.current = null;
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">事务管理</h3>
        <button
          onClick={createTransaction}
          disabled={isAnimating}
          className="btn-primary text-xs"
        >
          + 创建事务
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-0">
        {sorted.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-sm">
            <div className="text-3xl mb-2">📋</div>
            暂无事务，点击上方按钮创建
          </div>
        )}

        <Reorder.Group
          axis="y"
          values={sorted}
          onReorder={handleReorder}
          className="space-y-2"
        >
          <AnimatePresence mode="popLayout">
            {sorted.map((txn, index) => {
              const cfg = statusConfig[txn.status];
              const isActive = txn.status === 'active';
              return (
                <Reorder.Item
                  key={txn.txnId}
                  value={txn}
                  onDragStart={() => handleDragStart(index)}
                  onDragEnd={handleDragEnd}
                  as="div"
                  dragListener={false}
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -20, scale: 0.9 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className={cn(
                    'card p-3 select-none',
                    'transition-shadow hover:shadow-md',
                    txn.status === 'aborted' && 'opacity-70'
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        data-drag-handle
                        className={cn(
                          'flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800 text-white font-bold text-sm',
                          !isAnimating && 'cursor-grab active:cursor-grabbing'
                        )}
                        title="拖拽可排序"
                      >
                        T{txn.txnNum}
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">事务 ID</div>
                        <div className="font-semibold text-slate-800 text-sm">T{txn.txnNum}</div>
                      </div>
                    </div>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full border flex items-center gap-1', cfg.color)}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot, isActive && 'animate-pulse')} />
                      {cfg.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                    <div className="bg-slate-50 rounded px-2 py-1.5">
                      <div className="text-slate-400">开始时间戳</div>
                      <div className="font-mono font-semibold text-slate-700">{txn.startTs}</div>
                    </div>
                    <div className="bg-slate-50 rounded px-2 py-1.5">
                      <div className="text-slate-400">快照时间戳</div>
                      <div className="font-mono font-semibold text-slate-700">{txn.snapshotTs}</div>
                    </div>
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      onClick={() => onOpenRead(txn.txnId)}
                      disabled={!isActive || isAnimating}
                      className="flex-1 btn-secondary text-xs py-1"
                    >
                      读取
                    </button>
                    <button
                      onClick={() => onOpenWrite(txn.txnId)}
                      disabled={!isActive || isAnimating}
                      className="flex-1 btn-secondary text-xs py-1"
                    >
                      写入
                    </button>
                    <button
                      onClick={() => commitTransaction(txn.txnId)}
                      disabled={!isActive || isAnimating}
                      className="flex-1 btn-success text-xs py-1"
                    >
                      提交
                    </button>
                    <button
                      onClick={() => abortTransaction(txn.txnId)}
                      disabled={!isActive || isAnimating}
                      className="flex-1 btn-danger text-xs py-1"
                    >
                      回滚
                    </button>
                  </div>

                  {txn.writes.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100">
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
            })}
          </AnimatePresence>
        </Reorder.Group>
      </div>
    </div>
  );
}
