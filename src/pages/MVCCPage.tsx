import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import TransactionPanel from '@/components/mvcc/TransactionPanel';
import DataTableView from '@/components/mvcc/DataTableView';
import VersionChainView from '@/components/mvcc/VersionChainView';
import VisibilityPanel from '@/components/mvcc/VisibilityPanel';
import ControlBar from '@/components/mvcc/ControlBar';
import WriteDialog from '@/components/mvcc/WriteDialog';
import ReadDialog from '@/components/mvcc/ReadDialog';
import type { WriteDialogState, ReadDialogState } from '@/structures/mvcc/types';

export default function MVCCPage() {
  const [writeDialog, setWriteDialog] = useState<WriteDialogState>({ open: false, txnId: null });
  const [readDialog, setReadDialog] = useState<ReadDialogState>({ open: false, txnId: null });

  const handleOpenWrite = useCallback((txnId: string) => {
    setWriteDialog({ open: true, txnId });
  }, []);

  const handleCloseWrite = useCallback(() => {
    setWriteDialog({ open: false, txnId: null });
  }, []);

  const handleOpenRead = useCallback((txnId: string) => {
    setReadDialog({ open: true, txnId });
  }, []);

  const handleCloseRead = useCallback(() => {
    setReadDialog({ open: false, txnId: null });
  }, []);

  return (
    <div className="h-full flex flex-col p-4 gap-3 min-h-0">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between flex-shrink-0"
      >
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            🔄 MVCC 多版本并发控制
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            通过版本链与快照时间戳，直观理解数据库如何实现事务隔离与并发读写
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded">
            <span>xmin</span><span className="text-slate-400">创建版本的事务</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 rounded">
            <span>xmax</span><span className="text-slate-400">删除版本的事务</span>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex-1 flex gap-3 min-h-0"
      >
        <div className="w-80 flex-shrink-0 card p-3 flex flex-col min-h-0 overflow-hidden">
          <TransactionPanel onOpenWrite={handleOpenWrite} onOpenRead={handleOpenRead} />
        </div>

        <div className="flex-1 card p-3 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            <div className="flex-shrink-0">
              <DataTableView />
            </div>
            <div className="flex-1 min-h-0 border-t border-slate-200 pt-3">
              <VersionChainView />
            </div>
          </div>
        </div>

        <div className="w-96 flex-shrink-0 card p-3 flex flex-col min-h-0 overflow-hidden">
          <VisibilityPanel />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="flex-shrink-0"
      >
        <ControlBar />
      </motion.div>

      <WriteDialog
        open={writeDialog.open}
        txnId={writeDialog.txnId}
        onClose={handleCloseWrite}
      />
      <ReadDialog
        open={readDialog.open}
        txnId={readDialog.txnId}
        onClose={handleCloseRead}
      />
    </div>
  );
}
