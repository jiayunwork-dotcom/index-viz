import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMVCCStore } from '@/store/mvccStore';
import { INITIAL_ROWS } from '@/structures/mvcc/types';

interface Props {
  open: boolean;
  txnId: string | null;
  onClose: () => void;
}

export default function WriteDialog({ open, txnId, onClose }: Props) {
  const { versions, writeRow, transactions } = useMVCCStore();
  const [rowId, setRowId] = useState<number>(1);
  const [newName, setNewName] = useState('');
  const [newBalance, setNewBalance] = useState('');

  useEffect(() => {
    if (open && txnId) {
      const firstRow = INITIAL_ROWS[0].id;
      setRowId(firstRow);
      const rowVersions = versions.get(firstRow);
      if (rowVersions && rowVersions.length > 0) {
        const latest = rowVersions[0];
        setNewName(latest.name);
        setNewBalance(String(latest.balance));
      }
    }
  }, [open, txnId, versions]);

  const handleRowChange = (id: number) => {
    setRowId(id);
    const rowVersions = versions.get(id);
    if (rowVersions && rowVersions.length > 0) {
      const latest = rowVersions[0];
      setNewName(latest.name);
      setNewBalance(String(latest.balance));
    }
  };

  const handleConfirm = async () => {
    if (!txnId) return;
    const balance = parseInt(newBalance);
    await writeRow(txnId, rowId, newName || undefined, isNaN(balance) ? undefined : balance);
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
                <h3 className="text-lg font-bold text-slate-800">写入数据</h3>
                {txn && (
                  <p className="text-sm text-slate-500 mt-0.5">
                    事务 <span className="font-mono font-semibold">T{txn.txnNum}</span> 将创建新版本
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
                  onChange={(e) => handleRowChange(parseInt(e.target.value))}
                  className="input"
                >
                  {INITIAL_ROWS.map((r) => (
                    <option key={r.id} value={r.id}>
                      #{r.id} - {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Name (新值)</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="input"
                  placeholder="留空则保持不变"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Balance (新值)</label>
                <input
                  type="number"
                  value={newBalance}
                  onChange={(e) => setNewBalance(e.target.value)}
                  className="input"
                  placeholder="留空则保持不变"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-5">
              <button onClick={onClose} className="btn-secondary">取消</button>
              <button onClick={handleConfirm} className="btn-primary">确认写入</button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
