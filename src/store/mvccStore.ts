import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  Transaction,
  Version,
  TxnStatus,
  IsolationLevel,
  DataRow,
  VisibilityCheckStep,
  ReadResult,
} from '../structures/mvcc/types';
import { INITIAL_ROWS } from '../structures/mvcc/types';
import { sleep } from '../lib/utils';

interface MVCCState {
  transactions: Transaction[];
  versions: Map<number, Version[]>;
  nextTxnNum: number;
  nextTs: number;
  isolationLevel: IsolationLevel;
  animationSpeed: number;
  readResult: ReadResult | null;
  isAnimating: boolean;

  createTransaction: () => void;
  commitTransaction: (txnId: string) => Promise<void>;
  abortTransaction: (txnId: string) => Promise<void>;
  writeRow: (txnId: string, rowId: number, newName?: string, newBalance?: number) => Promise<void>;
  readRow: (txnId: string, rowId: number) => Promise<Version | null>;
  reorderTransactions: (dragIndex: number, dropIndex: number) => void;
  setIsolationLevel: (level: IsolationLevel) => void;
  setAnimationSpeed: (speed: number) => void;
  clearReadResult: () => void;
  reset: () => void;
}

function createInitialVersions(): Map<number, Version[]> {
  const map = new Map<number, Version[]>();
  INITIAL_ROWS.forEach((row, idx) => {
    const version: Version = {
      versionId: uuidv4(),
      rowId: row.id,
      name: row.name,
      balance: row.balance,
      xmin: idx + 1,
      xmax: null,
      xminStatus: 'committed',
      xmaxStatus: null,
      createdAt: idx + 1,
    };
    map.set(row.id, [version]);
  });
  return map;
}

export const useMVCCStore = create<MVCCState>((set, get) => ({
  transactions: [],
  versions: createInitialVersions(),
  nextTxnNum: INITIAL_ROWS.length + 1,
  nextTs: INITIAL_ROWS.length + 1,
  isolationLevel: 'repeatable-read',
  animationSpeed: 1,
  readResult: null,
  isAnimating: false,

  createTransaction: () => {
    const { nextTxnNum, nextTs, transactions } = get();
    const newTxn: Transaction = {
      txnId: uuidv4(),
      txnNum: nextTxnNum,
      status: 'active',
      startTs: nextTs,
      snapshotTs: nextTs,
      displayOrder: transactions.length,
      writes: [],
    };
    set({
      transactions: [...transactions, newTxn],
      nextTxnNum: nextTxnNum + 1,
      nextTs: nextTs + 1,
    });
  },

  commitTransaction: async (txnId: string) => {
    const { transactions, versions, nextTs } = get();
    const txn = transactions.find((t) => t.txnId === txnId);
    if (!txn || txn.status !== 'active') return;

    set({ isAnimating: true });
    const commitTs = nextTs;

    const newVersions = new Map(versions);
    for (const [rowId, versionList] of newVersions) {
      const updated = versionList.map((v) => {
        if (v.xmin === txn.txnNum) {
          return { ...v, xminStatus: 'committed' as TxnStatus };
        }
        if (v.xmax === txn.txnNum) {
          return { ...v, xmaxStatus: 'committed' as TxnStatus, xmax: commitTs };
        }
        return v;
      });
      newVersions.set(rowId, updated);
    }

    set({
      transactions: transactions.map((t) =>
        t.txnId === txnId ? { ...t, status: 'committed' as TxnStatus, snapshotTs: commitTs } : t
      ),
      versions: newVersions,
      nextTs: commitTs + 1,
    });

    await sleep(300 / get().animationSpeed);
    set({ isAnimating: false });
  },

  abortTransaction: async (txnId: string) => {
    const { transactions, versions } = get();
    const txn = transactions.find((t) => t.txnId === txnId);
    if (!txn || txn.status !== 'active') return;

    set({ isAnimating: true });

    const newVersions = new Map<number, Version[]>();
    for (const [rowId, versionList] of versions) {
      const filtered = versionList
        .map((v) => {
          if (v.xmin === txn.txnNum) {
            return { ...v, isRemoving: true };
          }
          if (v.xmax === txn.txnNum) {
            return { ...v, xmax: null, xmaxStatus: null };
          }
          return v;
        })
        .filter((v) => !(v.xmin === txn.txnNum && v.isRemoving) || true);

      const pendingRemove = filtered.filter((v) => v.xmin === txn.txnNum && v.isRemoving);
      const kept = filtered.filter((v) => !(v.xmin === txn.txnNum && v.isRemoving));
      newVersions.set(rowId, [...kept, ...pendingRemove]);
    }

    set({
      transactions: transactions.map((t) =>
        t.txnId === txnId ? { ...t, status: 'aborted' as TxnStatus } : t
      ),
      versions: newVersions,
    });

    await sleep(600 / get().animationSpeed);

    const finalVersions = new Map<number, Version[]>();
    for (const [rowId, versionList] of get().versions) {
      const cleaned = versionList.filter((v) => !(v.xmin === txn.txnNum));
      finalVersions.set(rowId, cleaned);
    }
    set({ versions: finalVersions });

    set({ isAnimating: false });
  },

  writeRow: async (txnId: string, rowId: number, newName?: string, newBalance?: number) => {
    const { transactions, versions, nextTxnNum, nextTs } = get();
    const txn = transactions.find((t) => t.txnId === txnId);
    if (!txn || txn.status !== 'active') return;
    if (!versions.has(rowId)) return;

    set({ isAnimating: true });

    const rowVersions = versions.get(rowId)!;
    const currentLatest = rowVersions[0];
    const newNameVal = newName ?? currentLatest.name;
    const newBalanceVal = newBalance ?? currentLatest.balance;

    const newVersion: Version = {
      versionId: uuidv4(),
      rowId,
      name: newNameVal,
      balance: newBalanceVal,
      xmin: txn.txnNum,
      xmax: null,
      xminStatus: 'active',
      xmaxStatus: null,
      createdAt: nextTs,
      isNew: true,
    };

    const newVersions = new Map(versions);
    const updatedList = [
      newVersion,
      ...rowVersions.map((v, i) =>
        i === 0 ? { ...v, xmax: txn.txnNum, xmaxStatus: 'active' as TxnStatus } : v
      ),
    ];
    newVersions.set(rowId, updatedList);

    set({
      versions: newVersions,
      nextTs: nextTs + 1,
      nextTxnNum: txn.txnNum === nextTxnNum ? nextTxnNum : nextTxnNum,
      transactions: transactions.map((t) =>
        t.txnId === txnId
          ? { ...t, writes: [...t.writes, { rowId, versionId: newVersion.versionId }] }
          : t
      ),
    });

    await sleep(500 / get().animationSpeed);

    const clearedVersions = new Map(get().versions);
    const clearedList = clearedVersions.get(rowId)!.map((v) =>
      v.versionId === newVersion.versionId ? { ...v, isNew: false } : v
    );
    clearedVersions.set(rowId, clearedList);
    set({ versions: clearedVersions, isAnimating: false });
  },

  readRow: async (txnId: string, rowId: number): Promise<Version | null> => {
    const { transactions, versions, isolationLevel } = get();
    const txn = transactions.find((t) => t.txnId === txnId);
    if (!txn) return null;
    if (!versions.has(rowId)) return null;

    set({ isAnimating: true });

    let effectiveSnapshotTs = txn.snapshotTs;
    if (isolationLevel === 'read-committed') {
      effectiveSnapshotTs = get().nextTs - 1;
    }

    const rowVersions = versions.get(rowId)!;
    const steps: VisibilityCheckStep[] = [];
    let foundVersion: Version | null = null;

    const activeTxns = new Set(
      transactions.filter((t) => t.status === 'active' && t.txnId !== txnId).map((t) => t.txnNum)
    );

    for (let i = 0; i < rowVersions.length; i++) {
      const v = rowVersions[i];
      let visible = true;
      let reason = '';

      if (v.xminStatus === 'aborted') {
        visible = false;
        reason = `xmin(T${v.xmin})已回滚→不可见`;
      } else if (v.xminStatus === 'active' && v.xmin !== txn.txnNum) {
        visible = false;
        reason = `xmin(T${v.xmin})未提交且非本事务→不可见`;
      } else if (v.xmin > effectiveSnapshotTs && v.xmin !== txn.txnNum) {
        visible = false;
        reason = `xmin(T${v.xmin}) > 快照时间戳(${effectiveSnapshotTs})→不可见`;
      } else if (v.xmax !== null) {
        if (v.xmaxStatus === 'aborted') {
          reason = `xmax(T${v.xmax})已回滚，版本有效→检查通过`;
        } else if (v.xmaxStatus === 'active') {
          if (v.xmax === txn.txnNum) {
            visible = false;
            reason = `本事务已删除该版本→不可见`;
          } else if (activeTxns.has(v.xmax)) {
            reason = `xmax(T${v.xmax})未提交→版本仍有效→可见`;
          } else {
            visible = false;
            reason = `xmax(T${v.xmax})已提交→版本被删除→不可见`;
          }
        } else {
          if (v.xmax <= effectiveSnapshotTs) {
            visible = false;
            reason = `xmax(T${v.xmax}) ≤ 快照时间戳(${effectiveSnapshotTs})→版本已删除→不可见`;
          } else {
            reason = `xmax(T${v.xmax}) > 快照时间戳(${effectiveSnapshotTs})→版本有效→可见`;
          }
        }
      } else {
        if (v.xmin === txn.txnNum) {
          reason = `本事务创建的版本，xmax为空→可见`;
        } else {
          reason = `xmin已提交且≤快照时间戳，xmax为空→可见`;
        }
      }

      const step: VisibilityCheckStep = {
        versionId: v.versionId,
        rowId,
        visible,
        reason,
        index: i,
        isHighlighted: false,
        isFinal: false,
      };
      steps.push(step);

      if (visible) {
        foundVersion = v;
        break;
      }
    }

    set({
      readResult: {
        txnId,
        rowId,
        foundVersion,
        steps,
        timestamp: Date.now(),
      },
    });

    for (let i = 0; i < steps.length; i++) {
      const isLast = i === steps.length - 1;
      const currentSteps = steps.map((s, idx) => ({
        ...s,
        isHighlighted: idx === i,
        isFinal: isLast && foundVersion ? s.versionId === foundVersion.versionId : isLast,
      }));

      const highlightedVersions = new Map(get().versions);
      const hList = highlightedVersions.get(rowId)!.map((v) => ({
        ...v,
        isHighlighted: currentSteps[i]?.versionId === v.versionId,
      }));
      highlightedVersions.set(rowId, hList);

      set({
        readResult: {
          txnId,
          rowId,
          foundVersion,
          steps: currentSteps,
          timestamp: Date.now(),
        },
        versions: highlightedVersions,
      });

      await sleep(600 / get().animationSpeed);
    }

    const clearHighlighted = new Map(get().versions);
    const cList = clearHighlighted.get(rowId)!.map((v) => ({ ...v, isHighlighted: false }));
    clearHighlighted.set(rowId, cList);
    set({ versions: clearHighlighted, isAnimating: false });

    return foundVersion;
  },

  reorderTransactions: (dragIndex: number, dropIndex: number) => {
    const { transactions } = get();
    const sorted = [...transactions].sort((a, b) => a.displayOrder - b.displayOrder);
    const [draggedItem] = sorted.splice(dragIndex, 1);
    sorted.splice(dropIndex, 0, draggedItem);

    set({
      transactions: transactions.map((t) => {
        const newIndex = sorted.findIndex((s) => s.txnId === t.txnId);
        return { ...t, displayOrder: newIndex };
      }),
    });
  },

  setIsolationLevel: (level: IsolationLevel) => set({ isolationLevel: level }),
  setAnimationSpeed: (speed: number) => set({ animationSpeed: speed }),

  clearReadResult: () => set({ readResult: null }),

  reset: () => {
    set({
      transactions: [],
      versions: createInitialVersions(),
      nextTxnNum: INITIAL_ROWS.length + 1,
      nextTs: INITIAL_ROWS.length + 1,
      readResult: null,
      isAnimating: false,
    });
  },
}));

export function getCurrentVisibleRows(
  versions: Map<number, Version[]>,
  txnNum: number,
  snapshotTs: number,
  transactions: Transaction[],
  isolationLevel: IsolationLevel,
  currentNextTs: number
): DataRow[] {
  const result: DataRow[] = [];
  const activeTxns = new Set(
    transactions.filter((t) => t.status === 'active' && t.txnNum !== txnNum).map((t) => t.txnNum)
  );
  const effectiveSnapshot = isolationLevel === 'read-committed' ? currentNextTs - 1 : snapshotTs;

  for (const [rowId, versionList] of versions) {
    for (const v of versionList) {
      let visible = true;

      if (v.xminStatus === 'aborted') visible = false;
      else if (v.xminStatus === 'active' && v.xmin !== txnNum) visible = false;
      else if (v.xmin > effectiveSnapshot && v.xmin !== txnNum) visible = false;
      else if (v.xmax !== null) {
        if (v.xmaxStatus === 'aborted') {
          // ok
        } else if (v.xmaxStatus === 'active') {
          if (v.xmax === txnNum) visible = false;
          else if (!activeTxns.has(v.xmax)) visible = false;
        } else {
          if (v.xmax <= effectiveSnapshot) visible = false;
        }
      }

      if (visible) {
        result.push({ id: rowId, name: v.name, balance: v.balance });
        break;
      }
    }
  }

  return result.sort((a, b) => a.id - b.id);
}
