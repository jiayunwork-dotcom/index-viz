import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import WALLogView from '@/components/wal/WALLogView';
import DataPageView from '@/components/wal/DataPageView';
import StatsPanel from '@/components/wal/StatsPanel';
import ControlPanel from '@/components/wal/ControlPanel';
import TimeTravelTimeline from '@/components/wal/TimeTravelTimeline';
import type {
  WALLogEntry,
  DataPage,
  AnimationPhase,
  WALStats,
  OperationType,
  TimeTravelSnapshot,
} from '@/structures/wal/types';
import { sleep } from '@/lib/utils';

const WRITE_COUNT = 10;
const OPERATION_TYPES: OperationType[] = ['INSERT', 'UPDATE', 'DELETE'];
const SAMPLE_CONTENTS = [
  '用户信息更新',
  '订单状态变更',
  '商品库存扣减',
  '账户余额变动',
  '日志记录新增',
  '配置项修改',
  '权限设置更新',
  '消息队列消费',
];

export default function WALPage() {
  const [entries, setEntries] = useState<WALLogEntry[]>([]);
  const [pages, setPages] = useState<DataPage[]>([]);
  const [flushLSN, setFlushLSN] = useState(0);
  const [checkpointLSN, setCheckpointLSN] = useState(0);
  const [nextLSN, setNextLSN] = useState(1);
  const [nextPageId, setNextPageId] = useState(1);

  const [isAnimating, setIsAnimating] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('idle');
  const [currentOperation, setCurrentOperation] = useState<string | null>(null);
  const [speed, setSpeed] = useState(3);

  const [highlightedEntryId, setHighlightedEntryId] = useState<string | null>(null);
  const [highlightedPageId, setHighlightedPageId] = useState<string | null>(null);

  const [showCrashOverlay, setShowCrashOverlay] = useState(false);
  const [hasCrashed, setHasCrashed] = useState(false);

  const [isSingleStepMode, setIsSingleStepMode] = useState(false);
  const [recoveryProgress, setRecoveryProgress] = useState({ current: 0, total: 0 });
  const [recoveryState, setRecoveryState] = useState<{
    entriesToReplay: WALLogEntry[];
    uniquePageEntries: Map<number, WALLogEntry>;
    replayIndex: number;
    phase: 'scan' | 'replay' | 'flush' | 'idle';
    flushIndex: number;
    allDirtyForFlush: DataPage[];
  } | null>(null);

  const [snapshots, setSnapshots] = useState<TimeTravelSnapshot[]>([]);
  const [currentSnapshotIndex, setCurrentSnapshotIndex] = useState(-1);
  const [isTimeTraveling, setIsTimeTraveling] = useState(false);
  const [liveSnapshot, setLiveSnapshot] = useState<TimeTravelSnapshot | null>(null);

  const isRunningRef = useRef(false);
  const snapshotCounterRef = useRef(0);

  const stats: WALStats = {
    totalEntries: entries.length,
    flushedEntries: entries.filter((e) => e.isFlushed).length,
    dirtyPages: pages.filter((p) => p.isDirty && !p.isOnDisk).length,
    diskPages: pages.filter((p) => p.isOnDisk).length,
    checkpointLSN,
    currentFlushLSN: flushLSN,
  };

  const getDelayMs = () => {
    const baseDelay = 600;
    return Math.max(50, baseDelay / speed);
  };

  const getRandomOperation = (): OperationType => {
    return OPERATION_TYPES[Math.floor(Math.random() * OPERATION_TYPES.length)];
  };

  const getRandomContent = () => {
    return SAMPLE_CONTENTS[Math.floor(Math.random() * SAMPLE_CONTENTS.length)];
  };

  const createSnapshot = useCallback((type: TimeTravelSnapshot['type'], description: string) => {
    if (isTimeTraveling) return;

    const snapshot: TimeTravelSnapshot = {
      id: uuidv4(),
      type,
      timestamp: Date.now(),
      description,
      entries: JSON.parse(JSON.stringify(entries)),
      pages: JSON.parse(JSON.stringify(pages)),
      flushLSN,
      checkpointLSN,
      nextLSN,
      nextPageId,
      hasCrashed,
    };

    setSnapshots((prev) => [...prev, snapshot]);
    setCurrentSnapshotIndex((prev) => prev + 1);
    snapshotCounterRef.current += 1;
  }, [entries, pages, flushLSN, checkpointLSN, nextLSN, nextPageId, hasCrashed, isTimeTraveling]);

  const handleDragReorder = useCallback((dragIndex: number, dropIndex: number) => {
    if (isAnimating || isTimeTraveling) return;

    setEntries((prev) => {
      const sorted = [...prev].sort((a, b) => a.displayOrder - b.displayOrder);
      const [draggedItem] = sorted.splice(dragIndex, 1);
      sorted.splice(dropIndex, 0, draggedItem);

      return prev.map((entry) => {
        const newIndex = sorted.findIndex((e) => e.id === entry.id);
        return { ...entry, displayOrder: newIndex };
      });
    });
  }, [isAnimating, isTimeTraveling]);

  const handleTimeTravelChange = useCallback((index: number) => {
    if (index < 0 || index >= snapshots.length) return;

    const snapshot = snapshots[index];
    setCurrentSnapshotIndex(index);

    if (index === snapshots.length - 1 && liveSnapshot) {
      setEntries(JSON.parse(JSON.stringify(liveSnapshot.entries)));
      setPages(JSON.parse(JSON.stringify(liveSnapshot.pages)));
      setFlushLSN(liveSnapshot.flushLSN);
      setCheckpointLSN(liveSnapshot.checkpointLSN);
      setNextLSN(liveSnapshot.nextLSN);
      setNextPageId(liveSnapshot.nextPageId);
      setHasCrashed(liveSnapshot.hasCrashed);
      setIsTimeTraveling(false);
    } else {
      setEntries(JSON.parse(JSON.stringify(snapshot.entries)));
      setPages(JSON.parse(JSON.stringify(snapshot.pages)));
      setFlushLSN(snapshot.flushLSN);
      setCheckpointLSN(snapshot.checkpointLSN);
      setNextLSN(snapshot.nextLSN);
      setNextPageId(snapshot.nextPageId);
      setHasCrashed(snapshot.hasCrashed);
      setIsTimeTraveling(true);
    }
  }, [snapshots, liveSnapshot]);

  const saveLiveState = useCallback(() => {
    const snapshot: TimeTravelSnapshot = {
      id: uuidv4(),
      type: 'write',
      timestamp: Date.now(),
      description: '当前状态',
      entries: JSON.parse(JSON.stringify(entries)),
      pages: JSON.parse(JSON.stringify(pages)),
      flushLSN,
      checkpointLSN,
      nextLSN,
      nextPageId,
      hasCrashed,
    };
    setLiveSnapshot(snapshot);
  }, [entries, pages, flushLSN, checkpointLSN, nextLSN, nextPageId, hasCrashed]);

  const handleEntryClick = useCallback((entry: WALLogEntry) => {
    setHighlightedEntryId(entry.id);
    setHighlightedPageId(null);
    setPages((prev) =>
      prev.map((p) => ({
        ...p,
        isHighlighted: p.pageId === entry.pageId,
      }))
    );
    setEntries((prev) =>
      prev.map((e) => ({
        ...e,
        isHighlighted: e.id === entry.id,
      }))
    );

    setTimeout(() => {
      setHighlightedEntryId(null);
      setHighlightedPageId(null);
      setPages((prev) =>
        prev.map((p) => ({ ...p, isHighlighted: false }))
      );
      setEntries((prev) =>
        prev.map((e) => ({ ...e, isHighlighted: false }))
      );
    }, 2000);
  }, []);

  const handlePageClick = useCallback((page: DataPage) => {
    setHighlightedPageId(page.id);
    setHighlightedEntryId(null);

    const relatedEntries = entries.filter((e) => e.pageId === page.pageId);
    if (relatedEntries.length > 0) {
      const lastEntry = relatedEntries[relatedEntries.length - 1];
      setEntries((prev) =>
        prev.map((e) => ({
          ...e,
          isHighlighted: e.id === lastEntry.id,
        }))
      );
      setPages((prev) =>
        prev.map((p) => ({
          ...p,
          isHighlighted: p.id === page.id,
        }))
      );

      setTimeout(() => {
        setHighlightedEntryId(null);
        setHighlightedPageId(null);
        setPages((prev) =>
          prev.map((p) => ({ ...p, isHighlighted: false }))
        );
        setEntries((prev) =>
          prev.map((e) => ({ ...e, isHighlighted: false }))
        );
      }, 2000);
    }
  }, [entries]);

  const handleWrite = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    setIsAnimating(true);
    setAnimationPhase('writing');
    setHasCrashed(false);

    for (let i = 0; i < WRITE_COUNT; i++) {
      if (!isRunningRef.current) break;

      setCurrentOperation(`写入数据 (${i + 1}/${WRITE_COUNT})`);

      const operation = getRandomOperation();
      const content = getRandomContent();
      const lsn = nextLSN + i;
      let pageId: number;

      const existingPages = pages.filter((p) => !p.isOnDisk || p.isDirty);
      if (existingPages.length > 0 && Math.random() > 0.4) {
        const randomPage = existingPages[Math.floor(Math.random() * existingPages.length)];
        pageId = randomPage.pageId;
      } else {
        pageId = nextPageId + i;
      }

      const newEntry: WALLogEntry = {
        id: uuidv4(),
        lsn,
        operation,
        pageId,
        content,
        isFlushed: false,
        isCheckpointed: false,
        isNew: true,
        isHighlighted: false,
        isScanning: false,
        displayOrder: i,
      };

      setEntries((prev) => [
        ...prev.map((e) => ({ ...e, displayOrder: e.displayOrder + 1 })),
        newEntry,
      ]);

      await sleep(getDelayMs() * 0.4);

      setPages((prev) => {
        const existingPage = prev.find((p) => p.pageId === pageId && !p.isOnDisk);
        if (existingPage) {
          return prev.map((p) =>
            p.id === existingPage.id
              ? { ...p, content, isNew: true, isDirty: true }
              : p
          );
        }
        const newPage: DataPage = {
          id: uuidv4(),
          pageId,
          content,
          isDirty: true,
          isOnDisk: false,
          isFlushing: false,
          isNew: true,
          isHighlighted: false,
          isRecovering: false,
        };
        return [...prev, newPage];
      });

      await sleep(getDelayMs() * 0.3);

      setEntries((prev) =>
        prev.map((e) => (e.id === newEntry.id ? { ...e, isNew: false } : e))
      );
      setPages((prev) =>
        prev.map((p) => (p.pageId === pageId && !p.isOnDisk ? { ...p, isNew: false } : p))
      );

      setFlushLSN(lsn);
      setEntries((prev) =>
        prev.map((e) => (e.lsn <= lsn ? { ...e, isFlushed: true } : e))
      );

      await sleep(getDelayMs() * 0.3);
    }

    setNextLSN((prev) => prev + WRITE_COUNT);
    setNextPageId((prev) => prev + WRITE_COUNT);

    setCurrentOperation(null);
    setIsAnimating(false);
    setAnimationPhase('complete');
    isRunningRef.current = false;

    setTimeout(() => {
      setAnimationPhase('idle');
    }, 500);

    setTimeout(() => {
      saveLiveState();
      createSnapshot('write', `写入 ${WRITE_COUNT} 条数据`);
    }, 600);
  }, [nextLSN, nextPageId, pages, speed, createSnapshot, saveLiveState]);

  const handleCheckpoint = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    setIsAnimating(true);
    setAnimationPhase('checkpoint');

    setCurrentOperation('开始 Checkpoint...');
    await sleep(getDelayMs() * 0.5);

    const dirtyPages = pages.filter((p) => p.isDirty && !p.isOnDisk);
    for (let i = 0; i < dirtyPages.length; i++) {
      if (!isRunningRef.current) break;

      const page = dirtyPages[i];
      setCurrentOperation(`刷盘页面 #${page.pageId} (${i + 1}/${dirtyPages.length})`);

      setPages((prev) => {
        const pageToFlush = prev.find((p) => p.id === page.id);
        if (!pageToFlush) return prev;

        const updated = prev.filter((p) => p.id !== page.id);
        const flushedPage: DataPage = {
          ...pageToFlush,
          isDirty: false,
          isOnDisk: true,
          isFlushing: true,
        };
        return [...updated, flushedPage];
      });

      await sleep(getDelayMs() * 0.8);

      setPages((prev) =>
        prev.map((p) => (p.pageId === page.pageId && p.isOnDisk ? { ...p, isFlushing: false } : p))
      );

      const relatedEntries = entries.filter((e) => e.pageId === page.pageId && !e.isCheckpointed);
      if (relatedEntries.length > 0) {
        setEntries((prev) =>
          prev.map((e) =>
            relatedEntries.some((re) => re.id === e.id)
              ? { ...e, isCheckpointed: true }
              : e
          )
        );
      }

      await sleep(getDelayMs() * 0.3);
    }

    setCurrentOperation('更新 Checkpoint 位置...');
    const maxFlushedLSN = entries.filter((e) => e.isFlushed).length > 0
      ? Math.max(...entries.filter((e) => e.isFlushed).map((e) => e.lsn))
      : 0;
    setCheckpointLSN(maxFlushedLSN);

    await sleep(getDelayMs() * 0.5);

    setCurrentOperation(null);
    setIsAnimating(false);
    setAnimationPhase('complete');
    isRunningRef.current = false;

    setTimeout(() => {
      setAnimationPhase('idle');
    }, 500);

    setTimeout(() => {
      saveLiveState();
      createSnapshot('checkpoint', 'Checkpoint 完成');
    }, 600);
  }, [pages, entries, speed, createSnapshot, saveLiveState]);

  const handleCrash = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    setIsAnimating(true);
    setAnimationPhase('crash');

    setShowCrashOverlay(true);
    setCurrentOperation('系统崩溃中...');

    await sleep(getDelayMs() * 1.5);

    setPages((prev) => prev.filter((p) => p.isOnDisk));

    await sleep(getDelayMs() * 0.5);

    setShowCrashOverlay(false);
    setHasCrashed(true);
    setCurrentOperation('崩溃完成 - 内存数据已丢失');

    await sleep(getDelayMs() * 0.8);

    setCurrentOperation(null);
    setIsAnimating(false);
    setAnimationPhase('complete');
    isRunningRef.current = false;

    setTimeout(() => {
      setAnimationPhase('idle');
    }, 500);

    setTimeout(() => {
      saveLiveState();
      createSnapshot('crash', '系统崩溃');
    }, 600);
  }, [speed, createSnapshot, saveLiveState]);

  const executeSingleRecoveryStep = useCallback(async (state: NonNullable<typeof recoveryState>) => {
    const { entriesToReplay, uniquePageEntries, replayIndex, phase, flushIndex, allDirtyForFlush } = state;

    if (phase === 'scan') {
      if (replayIndex >= entriesToReplay.length) {
        setEntries((prev) =>
          prev.map((e) => ({ ...e, isScanning: false }))
        );

        const dirtyPages = pages.filter((p) => p.isDirty && !p.isOnDisk);
        const recoveredDirtyPages: DataPage[] = [];
        for (const entry of entriesToReplay) {
          const latestEntry = uniquePageEntries.get(entry.pageId);
          if (latestEntry && latestEntry.id === entry.id) {
            const existingDiskPage = pages.find(
              (p) => p.pageId === entry.pageId && p.isOnDisk
            );
            if (!existingDiskPage) {
              recoveredDirtyPages.push({
                id: uuidv4(),
                pageId: entry.pageId,
                content: entry.content,
                isDirty: true,
                isOnDisk: false,
                isFlushing: false,
                isNew: false,
                isHighlighted: false,
                isRecovering: false,
              });
            }
          }
        }

        const newAllDirtyForFlush = [...dirtyPages, ...recoveredDirtyPages].filter(
          (p, i, arr) => arr.findIndex((x) => x.pageId === p.pageId) === i
        );

        setCurrentOperation('恢复完成，自动刷盘...');
        await sleep(getDelayMs() * 0.5);

        if (newAllDirtyForFlush.length === 0) {
          return { ...state, phase: 'idle' as const };
        }

        return {
          ...state,
          phase: 'flush' as const,
          flushIndex: 0,
          allDirtyForFlush: newAllDirtyForFlush,
        };
      }

      const entry = entriesToReplay[replayIndex];
      setCurrentOperation(`重放日志 LSN ${entry.lsn} (${replayIndex + 1}/${entriesToReplay.length})`);
      setRecoveryProgress({ current: replayIndex + 1, total: entriesToReplay.length });

      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, isScanning: true } : e))
      );

      await sleep(getDelayMs() * 0.4);

      const latestEntry = uniquePageEntries.get(entry.pageId);
      if (latestEntry && latestEntry.id === entry.id) {
        setPages((prev) => {
          const existingDiskPage = prev.find(
            (p) => p.pageId === entry.pageId && p.isOnDisk
          );

          const recoveredPage: DataPage = {
            id: uuidv4(),
            pageId: entry.pageId,
            content: entry.content,
            isDirty: true,
            isOnDisk: false,
            isFlushing: false,
            isNew: true,
            isHighlighted: false,
            isRecovering: true,
          };

          return [...prev, recoveredPage];
        });

        await sleep(getDelayMs() * 0.4);

        setPages((prev) =>
          prev.map((p) =>
            p.pageId === entry.pageId && p.isDirty && !p.isOnDisk
              ? { ...p, isNew: false, isRecovering: false }
              : p
          )
        );
      }

      await sleep(getDelayMs() * 0.2);

      return {
        ...state,
        replayIndex: replayIndex + 1,
      };
    }

    if (phase === 'flush') {
      if (flushIndex >= allDirtyForFlush.length) {
        return { ...state, phase: 'idle' as const };
      }

      const page = allDirtyForFlush[flushIndex];
      setCurrentOperation(`恢复刷盘: 页面 #${page.pageId} (${flushIndex + 1}/${allDirtyForFlush.length})`);

      setPages((prev) => {
        const pageToFlush = prev.find((p) => p.pageId === page.pageId && !p.isOnDisk);
        const existingDiskPage = prev.find((p) => p.pageId === page.pageId && p.isOnDisk);

        if (!pageToFlush) return prev;

        let updated = prev.filter((p) => !(p.pageId === page.pageId && !p.isOnDisk));

        if (existingDiskPage) {
          updated = updated.filter((p) => p.id !== existingDiskPage.id);
        }

        const flushedPage: DataPage = {
          id: uuidv4(),
          pageId: page.pageId,
          content: pageToFlush.content,
          isDirty: false,
          isOnDisk: true,
          isFlushing: true,
          isNew: false,
          isHighlighted: false,
          isRecovering: false,
        };
        return [...updated, flushedPage];
      });

      await sleep(getDelayMs() * 0.6);

      setPages((prev) =>
        prev.map((p) =>
          p.pageId === page.pageId && p.isOnDisk ? { ...p, isFlushing: false } : p
        )
      );

      await sleep(getDelayMs() * 0.2);

      return {
        ...state,
        flushIndex: flushIndex + 1,
      };
    }

    return state;
  }, [pages, getDelayMs]);

  const handleRecovery = useCallback(async () => {
    if (isRunningRef.current) return;

    if (isSingleStepMode && recoveryState && recoveryState.phase !== 'idle') {
      isRunningRef.current = true;
      setIsAnimating(true);
      setAnimationPhase('recovery');

      const newState = await executeSingleRecoveryStep(recoveryState);
      setRecoveryState(newState);

      if (newState.phase === 'idle') {
        setHasCrashed(false);
        setCurrentOperation('恢复完成！');
        await sleep(getDelayMs() * 0.5);

        setCurrentOperation(null);
        setIsAnimating(false);
        setAnimationPhase('complete');
        setRecoveryState(null);
        setRecoveryProgress({ current: 0, total: 0 });
        isRunningRef.current = false;

        setTimeout(() => {
          setAnimationPhase('idle');
        }, 1000);

        setTimeout(() => {
          saveLiveState();
          createSnapshot('recovery', '恢复完成');
        }, 1100);
      } else {
        setIsAnimating(false);
        isRunningRef.current = false;
      }
      return;
    }

    isRunningRef.current = true;
    setIsAnimating(true);
    setAnimationPhase('recovery');

    setCurrentOperation('从 Checkpoint 位置开始恢复...');
    await sleep(getDelayMs() * 0.5);

    const entriesToReplay = entries.filter((e) => e.lsn > checkpointLSN);
    const uniquePageEntries = new Map<number, WALLogEntry>();
    entriesToReplay.forEach((e) => {
      uniquePageEntries.set(e.pageId, e);
    });

    const initialState: NonNullable<typeof recoveryState> = {
      entriesToReplay,
      uniquePageEntries,
      replayIndex: 0,
      phase: 'scan',
      flushIndex: 0,
      allDirtyForFlush: [],
    };

    if (isSingleStepMode) {
      setRecoveryState(initialState);
      setRecoveryProgress({ current: 0, total: entriesToReplay.length });
      const newState = await executeSingleRecoveryStep(initialState);
      setRecoveryState(newState);
      setIsAnimating(false);
      isRunningRef.current = false;
      return;
    }

    let currentState = initialState;
    while (currentState.phase !== 'idle' && isRunningRef.current) {
      currentState = await executeSingleRecoveryStep(currentState);

      if (!isSingleStepMode) {
        continue;
      }

      if (currentState.phase === 'idle') {
        break;
      }

      setRecoveryState(currentState);
      setIsAnimating(false);
      isRunningRef.current = false;
      return;
    }

    setHasCrashed(false);
    setCurrentOperation('恢复完成！');
    await sleep(getDelayMs() * 0.5);

    setCurrentOperation(null);
    setIsAnimating(false);
    setAnimationPhase('complete');
    setRecoveryState(null);
    setRecoveryProgress({ current: 0, total: 0 });
    isRunningRef.current = false;

    setTimeout(() => {
      setAnimationPhase('idle');
    }, 1000);

    setTimeout(() => {
      saveLiveState();
      createSnapshot('recovery', '恢复完成');
    }, 1100);
  }, [entries, checkpointLSN, pages, speed, isSingleStepMode, recoveryState, executeSingleRecoveryStep, createSnapshot, saveLiveState, getDelayMs]);

  const handleSingleStepModeChange = useCallback((enabled: boolean) => {
    setIsSingleStepMode(enabled);

    if (!enabled && recoveryState && recoveryState.phase !== 'idle') {
      (async () => {
        isRunningRef.current = true;
        setIsAnimating(true);
        setAnimationPhase('recovery');

        let currentState = recoveryState;
        while (currentState.phase !== 'idle' && isRunningRef.current) {
          currentState = await executeSingleRecoveryStep(currentState);
        }

        setHasCrashed(false);
        setCurrentOperation('恢复完成！');
        await sleep(getDelayMs() * 0.5);

        setCurrentOperation(null);
        setIsAnimating(false);
        setAnimationPhase('complete');
        setRecoveryState(null);
        setRecoveryProgress({ current: 0, total: 0 });
        isRunningRef.current = false;

        setTimeout(() => {
          setAnimationPhase('idle');
        }, 1000);

        setTimeout(() => {
          saveLiveState();
          createSnapshot('recovery', '恢复完成');
        }, 1100);
      })();
    }
  }, [recoveryState, executeSingleRecoveryStep, getDelayMs, createSnapshot, saveLiveState]);

  const handleReset = useCallback(() => {
    if (isRunningRef.current) {
      isRunningRef.current = false;
    }
    setEntries([]);
    setPages([]);
    setFlushLSN(0);
    setCheckpointLSN(0);
    setNextLSN(1);
    setNextPageId(1);
    setIsAnimating(false);
    setAnimationPhase('idle');
    setCurrentOperation(null);
    setHighlightedEntryId(null);
    setHighlightedPageId(null);
    setShowCrashOverlay(false);
    setHasCrashed(false);
    setIsSingleStepMode(false);
    setRecoveryProgress({ current: 0, total: 0 });
    setRecoveryState(null);
    setSnapshots([]);
    setCurrentSnapshotIndex(-1);
    setIsTimeTraveling(false);
    setLiveSnapshot(null);
    snapshotCounterRef.current = 0;
  }, []);

  const canCrash =
    pages.filter((p) => p.isDirty && !p.isOnDisk).length > 0 && !hasCrashed;

  const canRecovery = hasCrashed && entries.filter((e) => e.lsn > checkpointLSN).length > 0;

  useEffect(() => {
    const initialSnapshot: TimeTravelSnapshot = {
      id: uuidv4(),
      type: 'write',
      timestamp: Date.now(),
      description: '初始状态',
      entries: [],
      pages: [],
      flushLSN: 0,
      checkpointLSN: 0,
      nextLSN: 1,
      nextPageId: 1,
      hasCrashed: false,
    };
    setSnapshots([initialSnapshot]);
    setCurrentSnapshotIndex(0);
    setLiveSnapshot(initialSnapshot);

    return () => {
      isRunningRef.current = false;
    };
  }, []);

  return (
    <div className="h-full flex flex-col p-4 gap-3 relative">
      <AnimatePresence>
        {showCrashOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-50 bg-red-500/30 pointer-events-none"
            style={{
              animation: 'crashFlash 0.3s ease-in-out infinite alternate',
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-4xl font-bold text-red-600 bg-white/90 px-8 py-4 rounded-xl shadow-2xl"
              >
                💥 SYSTEM CRASH 💥
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes crashFlash {
          0% { background-color: rgba(239, 68, 68, 0.2); }
          100% { background-color: rgba(239, 68, 68, 0.5); }
        }
      `}</style>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            📝 WAL 预写日志与崩溃恢复
          </h2>
          <p className="text-sm text-slate-500">
            展示 Write-Ahead Log 的工作原理：日志追加、Checkpoint、崩溃与恢复
          </p>
        </div>
        {hasCrashed && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium">
            <span className="animate-pulse">⚠️</span>
            系统已崩溃 - 等待恢复
          </div>
        )}
      </div>

      <div className="flex-1 flex gap-3 min-h-0">
        <div className="w-80 flex-shrink-0 card p-3 flex flex-col min-h-0">
          <WALLogView
            entries={entries}
            flushLSN={flushLSN}
            checkpointLSN={checkpointLSN}
            onEntryClick={handleEntryClick}
            onDragReorder={handleDragReorder}
            isAnimating={isAnimating || isTimeTraveling}
          />
        </div>

        <div className="flex-1 card p-3 flex flex-col min-h-0">
          <DataPageView
            pages={pages}
            entries={entries}
            onPageClick={handlePageClick}
          />
        </div>
      </div>

      <div className="space-y-2">
        <StatsPanel stats={stats} />
        {snapshots.length > 0 && (
          <TimeTravelTimeline
            snapshots={snapshots}
            currentIndex={currentSnapshotIndex}
            onTimeChange={handleTimeTravelChange}
            isTimeTraveling={isTimeTraveling}
          />
        )}
        <ControlPanel
          onWrite={handleWrite}
          onCheckpoint={handleCheckpoint}
          onCrash={handleCrash}
          onRecovery={handleRecovery}
          onReset={handleReset}
          isAnimating={isAnimating}
          animationPhase={animationPhase}
          speed={speed}
          onSpeedChange={setSpeed}
          currentOperation={currentOperation}
          canCrash={canCrash}
          canRecovery={canRecovery}
          isSingleStepMode={isSingleStepMode}
          onSingleStepModeChange={handleSingleStepModeChange}
          recoveryProgress={recoveryProgress}
          isTimeTraveling={isTimeTraveling}
        />
      </div>
    </div>
  );
}
