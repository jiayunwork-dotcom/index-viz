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
  TimelineEvent,
  DeadlockInfo,
  GCState,
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
  timelineEvents: TimelineEvent[];
  timelineOpen: boolean;
  isReplaying: boolean;
  replayIndex: number;
  replaySpeed: number;
  deadlocks: DeadlockInfo[];
  deadlockWarning: DeadlockInfo | null;
  gcState: GCState;
  pendingWrites: Map<string, number>;

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
  toggleTimeline: () => void;
  startReplay: () => Promise<void>;
  stopReplay: () => void;
  setReplaySpeed: (speed: number) => void;
  detectDeadlocks: () => void;
  dismissDeadlockWarning: () => void;
  resolveDeadlock: (txnNum: number) => Promise<void>;
  runGC: () => Promise<void>;
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

function addTimelineEvent(
  events: TimelineEvent[],
  type: TimelineEvent['type'],
  txnNum: number,
  detail: string,
  timestamp: number,
  rowId?: number
): TimelineEvent[] {
  return [
    ...events,
    { id: uuidv4(), type, txnNum, timestamp, detail, rowId },
  ];
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
  timelineEvents: [],
  timelineOpen: false,
  isReplaying: false,
  replayIndex: -1,
  replaySpeed: 1,
  deadlocks: [],
  deadlockWarning: null,
  gcState: { phase: 'idle', markedVersionIds: [], sweepingVersionId: null, sweepIndex: 0 },
  pendingWrites: new Map(),

  createTransaction: () => {
    const { nextTxnNum, nextTs, transactions, timelineEvents } = get();
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
      timelineEvents: addTimelineEvent(
        timelineEvents,
        'create',
        nextTxnNum,
        `创建事务 T${nextTxnNum}，快照时间戳=${nextTs}`,
        nextTs
      ),
    });
  },

  commitTransaction: async (txnId: string) => {
    const { transactions, versions, nextTs, timelineEvents } = get();
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

    const newPendingWrites = new Map(get().pendingWrites);
    newPendingWrites.delete(txnId);

    set({
      transactions: transactions.map((t) =>
        t.txnId === txnId ? { ...t, status: 'committed' as TxnStatus, snapshotTs: commitTs } : t
      ),
      versions: newVersions,
      nextTs: commitTs + 1,
      timelineEvents: addTimelineEvent(
        timelineEvents,
        'commit',
        txn.txnNum,
        `提交事务 T${txn.txnNum}，提交时间戳=${commitTs}`,
        commitTs
      ),
      pendingWrites: newPendingWrites,
    });

    await sleep(300 / get().animationSpeed);
    set({ isAnimating: false });

    get().detectDeadlocks();
  },

  abortTransaction: async (txnId: string) => {
    const { transactions, versions, timelineEvents } = get();
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

    const newPendingWrites = new Map(get().pendingWrites);
    newPendingWrites.delete(txnId);

    const abortTs = get().nextTs;

    set({
      transactions: transactions.map((t) =>
        t.txnId === txnId ? { ...t, status: 'aborted' as TxnStatus } : t
      ),
      versions: newVersions,
      timelineEvents: addTimelineEvent(
        timelineEvents,
        'abort',
        txn.txnNum,
        `回滚事务 T${txn.txnNum}`,
        abortTs
      ),
      pendingWrites: newPendingWrites,
    });

    await sleep(600 / get().animationSpeed);

    const finalVersions = new Map<number, Version[]>();
    for (const [rowId, versionList] of get().versions) {
      const cleaned = versionList.filter((v) => !(v.xmin === txn.txnNum));
      finalVersions.set(rowId, cleaned);
    }
    set({ versions: finalVersions });

    set({ isAnimating: false });

    get().detectDeadlocks();
  },

  writeRow: async (txnId: string, rowId: number, newName?: string, newBalance?: number) => {
    const { transactions, versions, nextTxnNum, nextTs, timelineEvents } = get();
    const txn = transactions.find((t) => t.txnId === txnId);
    if (!txn || txn.status !== 'active') return;
    if (!versions.has(rowId)) return;

    set({ isAnimating: true });

    const rowVersions = versions.get(rowId)!;
    const currentLatest = rowVersions[0];
    const newNameVal = newName ?? currentLatest.name;
    const newBalanceVal = newBalance ?? currentLatest.balance;

    const writeTs = nextTs;

    const newVersion: Version = {
      versionId: uuidv4(),
      rowId,
      name: newNameVal,
      balance: newBalanceVal,
      xmin: txn.txnNum,
      xmax: null,
      xminStatus: 'active',
      xmaxStatus: null,
      createdAt: writeTs,
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

    const newPendingWrites = new Map(get().pendingWrites);
    newPendingWrites.set(txnId, rowId);

    set({
      versions: newVersions,
      nextTs: nextTs + 1,
      nextTxnNum: txn.txnNum === nextTxnNum ? nextTxnNum : nextTxnNum,
      transactions: transactions.map((t) =>
        t.txnId === txnId
          ? { ...t, writes: [...t.writes, { rowId, versionId: newVersion.versionId }] }
          : t
      ),
      timelineEvents: addTimelineEvent(
        timelineEvents,
        'write',
        txn.txnNum,
        `T${txn.txnNum} 写入行#${rowId}（${newNameVal}, ¥${newBalanceVal}）`,
        writeTs,
        rowId
      ),
      pendingWrites: newPendingWrites,
    });

    await sleep(500 / get().animationSpeed);

    const clearedVersions = new Map(get().versions);
    const clearedList = clearedVersions.get(rowId)!.map((v) =>
      v.versionId === newVersion.versionId ? { ...v, isNew: false } : v
    );
    clearedVersions.set(rowId, clearedList);
    set({ versions: clearedVersions, isAnimating: false });

    get().detectDeadlocks();
  },

  readRow: async (txnId: string, rowId: number): Promise<Version | null> => {
    const { transactions, versions, isolationLevel, timelineEvents } = get();
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

    const readTs = get().nextTs;

    set({
      readResult: {
        txnId,
        rowId,
        foundVersion,
        steps,
        timestamp: Date.now(),
      },
      timelineEvents: addTimelineEvent(
        timelineEvents,
        'read',
        txn.txnNum,
        `T${txn.txnNum} 读取行#${rowId}` + (foundVersion ? `→找到版本(${foundVersion.name})` : '→无可见版本'),
        readTs,
        rowId
      ),
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

  toggleTimeline: () => set((s) => ({ timelineOpen: !s.timelineOpen })),

  startReplay: async () => {
    const { timelineEvents, replaySpeed } = get();
    if (timelineEvents.length === 0) return;

    set({ isReplaying: true, replayIndex: 0 });

    const savedState = {
      transactions: get().transactions,
      versions: get().versions,
      nextTxnNum: get().nextTxnNum,
      nextTs: get().nextTs,
    };

    set({
      transactions: [],
      versions: createInitialVersions(),
      nextTxnNum: INITIAL_ROWS.length + 1,
      nextTs: INITIAL_ROWS.length + 1,
      readResult: null,
    });

    await sleep(500 / replaySpeed);

    for (let i = 0; i < timelineEvents.length; i++) {
      if (!get().isReplaying) break;

      set({ replayIndex: i });

      const event = timelineEvents[i];
      switch (event.type) {
        case 'create':
          get().createTransaction();
          break;
        case 'write': {
          const txn = get().transactions.find((t) => t.txnNum === event.txnNum && t.status === 'active');
          if (txn && event.rowId) {
            await get().writeRow(txn.txnId, event.rowId);
          }
          break;
        }
        case 'read': {
          const txn = get().transactions.find((t) => t.txnNum === event.txnNum);
          if (txn && event.rowId) {
            await get().readRow(txn.txnId, event.rowId);
          }
          break;
        }
        case 'commit': {
          const txn = get().transactions.find((t) => t.txnNum === event.txnNum && t.status === 'active');
          if (txn) {
            await get().commitTransaction(txn.txnId);
          }
          break;
        }
        case 'abort': {
          const txn = get().transactions.find((t) => t.txnNum === event.txnNum && t.status === 'active');
          if (txn) {
            await get().abortTransaction(txn.txnId);
          }
          break;
        }
        case 'gc':
          break;
      }

      await sleep(800 / replaySpeed);
    }

    if (get().isReplaying) {
      set({
        ...savedState,
        timelineEvents: get().timelineEvents,
        isReplaying: false,
        replayIndex: -1,
      });
    }
  },

  stopReplay: () => {
    set({ isReplaying: false, replayIndex: -1 });
  },

  setReplaySpeed: (speed: number) => set({ replaySpeed: speed }),

  detectDeadlocks: () => {
    const { transactions, pendingWrites } = get();
    const activeTxns = transactions.filter((t) => t.status === 'active');
    const txnHoldMap = new Map<number, number[]>();
    const txnWaitMap = new Map<number, number>();

    for (const txn of activeTxns) {
      const heldRows: number[] = [];
      for (const w of txn.writes) {
        heldRows.push(w.rowId);
      }
      txnHoldMap.set(txn.txnNum, heldRows);

      const pendingRow = pendingWrites.get(txn.txnId);
      if (pendingRow !== undefined) {
        txnWaitMap.set(txn.txnNum, pendingRow);
      }
    }

    const newDeadlocks: DeadlockInfo[] = [];

    for (const txnA of activeTxns) {
      for (const txnB of activeTxns) {
        if (txnA.txnNum >= txnB.txnNum) continue;

        const aWants = txnWaitMap.get(txnA.txnNum);
        const bWants = txnWaitMap.get(txnB.txnNum);
        if (aWants === undefined || bWants === undefined) continue;

        const aHolds = txnHoldMap.get(txnA.txnNum) || [];
        const bHolds = txnHoldMap.get(txnB.txnNum) || [];

        const bHoldsRowA = bHolds.includes(aWants);
        const aHoldsRowB = aHolds.includes(bWants);

        if (bHoldsRowA && aHoldsRowB) {
          const deadlock: DeadlockInfo = {
            txnNums: [txnA.txnNum, txnB.txnNum],
            rowIds: [aWants, bWants],
            description: `T${txnA.txnNum}(持有行#${aHolds.find(r => r === bWants)}, 等待行#${aWants}) ↔ T${txnB.txnNum}(持有行#${bHolds.find(r => r === aWants)}, 等待行#${bWants})`,
          };
          const alreadyExists = newDeadlocks.some(
            (d) =>
              (d.txnNums[0] === deadlock.txnNums[0] && d.txnNums[1] === deadlock.txnNums[1]) ||
              (d.txnNums[0] === deadlock.txnNums[1] && d.txnNums[1] === deadlock.txnNums[0])
          );
          if (!alreadyExists) {
            newDeadlocks.push(deadlock);
          }
        }
      }
    }

    const currentDeadlocks = get().deadlocks;
    const hasNewDeadlock = newDeadlocks.length > 0 && !currentDeadlocks.some(
      (cd) =>
        newDeadlocks.some(
          (nd) =>
            (cd.txnNums[0] === nd.txnNums[0] && cd.txnNums[1] === nd.txnNums[1]) ||
            (cd.txnNums[0] === nd.txnNums[1] && cd.txnNums[1] === nd.txnNums[0])
        )
    );

    set({
      deadlocks: newDeadlocks,
      deadlockWarning: hasNewDeadlock ? newDeadlocks[0] : newDeadlocks.length > 0 ? get().deadlockWarning : null,
    });
  },

  dismissDeadlockWarning: () => set({ deadlockWarning: null }),

  resolveDeadlock: async (txnNum: number) => {
    const { transactions } = get();
    const txn = transactions.find((t) => t.txnNum === txnNum && t.status === 'active');
    if (txn) {
      set({ deadlockWarning: null });
      await get().abortTransaction(txn.txnId);
    }
  },

  runGC: async () => {
    const { transactions, versions, nextTs, timelineEvents, isAnimating } = get();
    if (isAnimating) return;

    const activeTxns = transactions.filter((t) => t.status === 'active');
    let minSnapshotTs = nextTs;
    for (const txn of activeTxns) {
      if (txn.snapshotTs < minSnapshotTs) {
        minSnapshotTs = txn.snapshotTs;
      }
    }

    const collectibleIds: string[] = [];
    for (const [, versionList] of versions) {
      for (const v of versionList) {
        if (
          v.xmax !== null &&
          v.xmaxStatus === 'committed' &&
          v.xmax < minSnapshotTs
        ) {
          collectibleIds.push(v.versionId);
        }
      }
    }

    if (collectibleIds.length === 0) return;

    set({
      isAnimating: true,
      gcState: { phase: 'marking', markedVersionIds: collectibleIds, sweepingVersionId: null, sweepIndex: 0 },
    });

    const markedVersions = new Map(versions);
    for (const [rowId, versionList] of markedVersions) {
      markedVersions.set(
        rowId,
        versionList.map((v) =>
          collectibleIds.includes(v.versionId) ? { ...v, isHighlighted: true } : v
        )
      );
    }
    set({ versions: markedVersions });

    await sleep(2000 / get().animationSpeed);

    set({
      gcState: { phase: 'sweeping', markedVersionIds: collectibleIds, sweepingVersionId: collectibleIds[0], sweepIndex: 0 },
    });

    for (let i = 0; i < collectibleIds.length; i++) {
      const vid = collectibleIds[i];
      set({
        gcState: { phase: 'sweeping', markedVersionIds: collectibleIds, sweepingVersionId: vid, sweepIndex: i },
      });

      const sweepVersions = new Map(get().versions);
      for (const [rowId, versionList] of sweepVersions) {
        sweepVersions.set(
          rowId,
          versionList.map((v) =>
            v.versionId === vid ? { ...v, isRemoving: true } : v
          )
        );
      }
      set({ versions: sweepVersions });

      await sleep(500 / get().animationSpeed);
    }

    const finalVersions = new Map<number, Version[]>();
    for (const [rowId, versionList] of get().versions) {
      finalVersions.set(rowId, versionList.filter((v) => !collectibleIds.includes(v.versionId)));
    }

    const gcTs = get().nextTs;
    set({
      versions: finalVersions,
      nextTs: gcTs + 1,
      gcState: { phase: 'done', markedVersionIds: [], sweepingVersionId: null, sweepIndex: 0 },
      timelineEvents: addTimelineEvent(
        get().timelineEvents,
        'gc',
        0,
        `GC清理: 回收${collectibleIds.length}个死版本`,
        gcTs
      ),
    });

    await sleep(300 / get().animationSpeed);
    set({
      isAnimating: false,
      gcState: { phase: 'idle', markedVersionIds: [], sweepingVersionId: null, sweepIndex: 0 },
    });
  },

  reset: () => {
    set({
      transactions: [],
      versions: createInitialVersions(),
      nextTxnNum: INITIAL_ROWS.length + 1,
      nextTs: INITIAL_ROWS.length + 1,
      readResult: null,
      isAnimating: false,
      timelineEvents: [],
      timelineOpen: false,
      isReplaying: false,
      replayIndex: -1,
      deadlocks: [],
      deadlockWarning: null,
      gcState: { phase: 'idle', markedVersionIds: [], sweepingVersionId: null, sweepIndex: 0 },
      pendingWrites: new Map(),
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
