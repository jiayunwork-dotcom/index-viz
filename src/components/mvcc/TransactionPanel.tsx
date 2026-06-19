import { useRef } from 'react';
import { AnimatePresence, Reorder } from 'framer-motion';
import { useMVCCStore } from '@/store/mvccStore';
import type { Transaction } from '@/structures/mvcc/types';
import TxnCard from './TxnCard';

interface Props {
  onOpenWrite: (txnId: string) => void;
  onOpenRead: (txnId: string) => void;
}

export default function TransactionPanel({ onOpenWrite, onOpenRead }: Props) {
  const {
    transactions,
    createTransaction,
    reorderTransactions,
    isAnimating,
  } = useMVCCStore();

  const sorted = [...transactions].sort((a, b) => a.displayOrder - b.displayOrder);
  const dragIndexRef = useRef<number | null>(null);

  const handleReorder = (newOrder: Transaction[]) => {
    const dragIndex = dragIndexRef.current;
    if (dragIndex === null) return;
    const draggedTxn = sorted[dragIndex];
    const dropIndex = newOrder.findIndex((t) => t.txnId === draggedTxn.txnId);
    if (dropIndex !== -1 && dragIndex !== dropIndex) {
      reorderTransactions(dragIndex, dropIndex);
    }
    dragIndexRef.current = null;
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
            {sorted.map((txn, index) => (
              <TxnCard
                key={txn.txnId}
                txn={txn}
                index={index}
                dragIndexRef={dragIndexRef}
                onOpenWrite={onOpenWrite}
                onOpenRead={onOpenRead}
              />
            ))}
          </AnimatePresence>
        </Reorder.Group>
      </div>
    </div>
  );
}
