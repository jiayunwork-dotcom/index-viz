import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMVCCStore } from '@/store/mvccStore';
import { INITIAL_ROWS } from '@/structures/mvcc/types';

interface Props {
  open: boolean;
  txnId: string | null;
  onClose: () => void;
}

export default function ReadDialog({ open, txnId, onClose }: Props) {
  const { readRow, transactions } = useMVCCStore();
  const [rowId, setRowId] = useState<number>(1);

  useEffect(() => {
    if (open) {
      setRowId(INITIAL_ROWS[0].id);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!txnId) return;
    await readRow(txnId, rowId);
    onClose();
  };

  const txn = transactions.find((t) => t.txnId === txnId);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, type: 'spring', damping: 25 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[400px] card p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">读取数据</h3>
                {txn && (
                  <p className="text-sm text-slate-500 mt-0.5">
                    事务 <span className="font-mono font-semibold">T{txn.txnNum}</span> 将基于快照时间戳判断可见性
                  </p>
                )}
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">选择行</label>
                <select
                  value={rowId}
                  onChange={(e) => setRowId(parseInt(e.target.value))}
                  className="input"
                >
                  {INITIAL_ROWS.map((r) => (
                    <option key={r.id} value={r.id}>
                      #{r.id} - {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                <div className="font-semibold mb-1">💡 可见性规则</div>
                <ul className="space-y-0.5 list-disc list-inside text-blue-600/90">
                  <li>从最新版本开始，沿版本链逐个检查</li>
                  <li>xmin 未提交或大于快照 → 不可见</li>
                  <li>xmax 已提交且小于等于快照 → 不可见</li>
                  <li>找到第一个可见版本即停止</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-5">
              <button onClick={onClose} className="btn-secondary">取消</button>
              <button onClick={handleConfirm} className="btn-primary">开始读取</button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
