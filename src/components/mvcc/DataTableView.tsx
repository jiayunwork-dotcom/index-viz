import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMVCCStore, getCurrentVisibleRows } from '@/store/mvccStore';
import { INITIAL_ROWS } from '@/structures/mvcc/types';
import type { DataRow } from '@/structures/mvcc/types';
import { cn } from '@/lib/utils';

export default function DataTableView() {
  const { versions, transactions, isolationLevel, nextTs, readResult } = useMVCCStore();
  const [selectedTxnId, setSelectedTxnId] = useState<string | 'global'>('global');

  useEffect(() => {
    if (selectedTxnId === 'global') return;
    const txn = transactions.find((t) => t.txnId === selectedTxnId);
    if (!txn || txn.status !== 'active') {
      setSelectedTxnId('global');
    }
  }, [transactions, selectedTxnId]);

  const displayRows: DataRow[] = useMemo(() => {
    if (selectedTxnId === 'global') {
      const globalRows: DataRow[] = [];
      for (const rowDef of INITIAL_ROWS) {
        const versionList = versions.get(rowDef.id) || [];
        let found: DataRow | null = null;
        for (const v of versionList) {
          if (v.xminStatus === 'committed') {
            const xmaxOk =
              v.xmax === null ||
              v.xmaxStatus === 'aborted' ||
              (v.xmaxStatus === 'active');
            if (xmaxOk) {
              found = { id: rowDef.id, name: v.name, balance: v.balance };
              break;
            }
          }
        }
        if (found) {
          globalRows.push(found);
        } else if (versionList.length > 0) {
          const lv = versionList[versionList.length - 1];
          globalRows.push({ id: rowDef.id, name: lv.name, balance: lv.balance });
        } else {
          globalRows.push(rowDef);
        }
      }
      return globalRows;
    } else {
      const txn = transactions.find((t) => t.txnId === selectedTxnId);
      if (txn) {
        const rows = getCurrentVisibleRows(
          versions,
          txn.txnNum,
          txn.snapshotTs,
          transactions,
          isolationLevel,
          nextTs
        );
        if (rows.length > 0) return rows;
      }
      return INITIAL_ROWS.map((r) => ({ ...r }));
    }
  }, [selectedTxnId, versions, transactions, isolationLevel, nextTs]);

  const rowMap = new Map(displayRows.map((r) => [r.id, r]));
  const orderedRows = INITIAL_ROWS.map((r) => rowMap.get(r.id)).filter((r): r is DataRow => !!r);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">当前数据表</h3>
        <select
          value={selectedTxnId}
          onChange={(e) => setSelectedTxnId(e.target.value)}
          className="text-xs border border-slate-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="global">全局（已提交视图）</option>
          {transactions.filter((t) => t.status === 'active').map((t) => (
            <option key={t.txnId} value={t.txnId}>T{t.txnNum} 的快照视图</option>
          ))}
        </select>
      </div>

      <div className="overflow-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-600 w-20">ID</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Name</th>
              <th className="px-4 py-2.5 text-right font-semibold text-slate-600 w-28">Balance</th>
            </tr>
          </thead>
          <tbody>
            {orderedRows.map((row) => {
              const isReadTarget = readResult && readResult.rowId === row.id;
              return (
                <motion.tr
                  key={row.id}
                  layout
                  className={cn(
                    'border-b border-slate-100 last:border-0 transition-colors',
                    isReadTarget ? 'bg-amber-50' : 'hover:bg-slate-50/50'
                  )}
                  animate={isReadTarget ? { backgroundColor: ['#fef3c7', '#fef3c7', '#fffbeb'] } : {}}
                  transition={{ duration: 0.8, repeat: isReadTarget ? 2 : 0 }}
                >
                  <td className="px-4 py-2.5 font-mono text-slate-500">#{row.id}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{row.name}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-700">
                    ¥{row.balance.toLocaleString()}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {readResult && readResult.foundVersion && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center gap-2"
        >
          <span>✓</span>
          <span>
            T{transactions.find((t) => t.txnId === readResult.txnId)?.txnNum} 读取 #{readResult.rowId}:
            <span className="font-semibold mx-1">{readResult.foundVersion.name}</span>
            <span className="font-mono">¥{readResult.foundVersion.balance.toLocaleString()}</span>
          </span>
        </motion.div>
      )}
    </div>
  );
}
