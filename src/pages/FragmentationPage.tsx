import { useState, useCallback, useRef, useEffect } from 'react';
import { FragmentationSimulator } from '@/structures/fragmentation/fragmentation';
import type {
  PhysicalPage,
  LogicalNode,
  Stats,
  AnimationPhase,
  TimelineOperation,
  StateSnapshot,
} from '@/structures/fragmentation/types';
import LogicalBTreeView from '@/components/fragmentation/LogicalBTreeView';
import PhysicalPageView from '@/components/fragmentation/PhysicalPageView';
import ControlPanel from '@/components/fragmentation/ControlPanel';
import StatsPanel from '@/components/fragmentation/StatsPanel';
import Timeline from '@/components/fragmentation/Timeline';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_MAX_SLOTS = 8;
const INSERT_COUNT = 80;
const DELETE_COUNT = 40;

function deepClonePages(pages: Record<string, PhysicalPage>): Record<string, PhysicalPage> {
  const result: Record<string, PhysicalPage> = {};
  Object.entries(pages).forEach(([id, page]) => {
    result[id] = {
      ...page,
      slots: page.slots.map((s) => ({ ...s })),
    };
  });
  return result;
}

function deepCloneNodes(nodes: Record<string, LogicalNode>): Record<string, LogicalNode> {
  const result: Record<string, LogicalNode> = {};
  Object.entries(nodes).forEach(([id, node]) => {
    result[id] = {
      ...node,
      keys: [...node.keys],
      children: [...node.children],
    };
  });
  return result;
}

export default function FragmentationPage() {
  const [maxSlots, setMaxSlots] = useState(DEFAULT_MAX_SLOTS);
  const [speed, setSpeed] = useState(3);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('idle');
  const [currentOperation, setCurrentOperation] = useState<string | null>(null);
  const [highlightedPageId, setHighlightedPageId] = useState<string | null>(null);
  const [scanningPageIds, setScanningPageIds] = useState<string[]>([]);
  const [scanKey, setScanKey] = useState<number | null>(null);

  const [pages, setPages] = useState<Record<string, PhysicalPage>>({});
  const [logicalNodes, setLogicalNodes] = useState<Record<string, LogicalNode>>({});
  const [logicalRootId, setLogicalRootId] = useState<string | null>(null);
  const [leafChain, setLeafChain] = useState<string[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalPages: 0,
    usedPages: 0,
    emptyPages: 0,
    avgFillRate: 0,
    fragmentationIndex: 0,
    maxPointerJump: 0,
  });

  const [timelineOperations, setTimelineOperations] = useState<TimelineOperation[]>([]);
  const [snapshots, setSnapshots] = useState<StateSnapshot[]>([]);
  const [currentTimelineIndex, setCurrentTimelineIndex] = useState(0);
  const [isTimelinePlaying, setIsTimelinePlaying] = useState(false);
  const [isTimelineMode, setIsTimelineMode] = useState(false);

  const simulatorRef = useRef<FragmentationSimulator>(
    new FragmentationSimulator(DEFAULT_MAX_SLOTS)
  );
  const animationTimeoutRef = useRef<number | null>(null);
  const isRunningRef = useRef(false);
  const playIntervalRef = useRef<number | null>(null);
  const snapshotOpIndexRef = useRef(0);

  const syncFromSimulator = useCallback(() => {
    const sim = simulatorRef.current;
    setPages({ ...sim.pages });
    setLogicalNodes({ ...sim.logicalNodes });
    setLogicalRootId(sim.logicalRootId);
    setLeafChain([...sim.leafChain]);
    setStats(sim.getStats());
  }, []);

  const createSnapshot = useCallback(
    (operation: TimelineOperation | null): StateSnapshot => {
      const sim = simulatorRef.current;
      return {
        pages: deepClonePages(sim.pages),
        logicalNodes: deepCloneNodes(sim.logicalNodes),
        logicalRootId: sim.logicalRootId,
        leafChain: [...sim.leafChain],
        pageOrder: [...sim.pageOrder],
        stats: { ...sim.getStats() },
        scanKey,
        highlightedPageId,
        scanningPageIds: [...scanningPageIds],
        operation,
      };
    },
    [scanKey, highlightedPageId, scanningPageIds]
  );

  const addTimelineOperation = useCallback(
    (type: TimelineOperation['type'], description: string) => {
      const opIndex = snapshotOpIndexRef.current;
      const op: TimelineOperation = {
        id: uuidv4(),
        type,
        description,
        index: opIndex,
      };
      snapshotOpIndexRef.current++;

      setTimelineOperations((prev) => [...prev, op]);
      setSnapshots((prev) => [...prev, createSnapshot(op)]);
      setCurrentTimelineIndex(opIndex);
    },
    [createSnapshot]
  );

  const applySnapshot = useCallback((snapshot: StateSnapshot) => {
    setPages({ ...snapshot.pages });
    setLogicalNodes({ ...snapshot.logicalNodes });
    setLogicalRootId(snapshot.logicalRootId);
    setLeafChain([...snapshot.leafChain]);
    setStats({ ...snapshot.stats });
    setScanKey(snapshot.scanKey);
    setHighlightedPageId(snapshot.highlightedPageId);
    setScanningPageIds([...snapshot.scanningPageIds]);
    if (snapshot.operation) {
      setCurrentOperation(snapshot.operation.description);
    }
  }, []);

  const handleTimelineIndexChange = useCallback(
    (index: number) => {
      if (index < 0 || index >= snapshots.length) return;
      setCurrentTimelineIndex(index);
      if (snapshots[index]) {
        applySnapshot(snapshots[index]);
      }
    },
    [snapshots, applySnapshot]
  );

  const handleStepBack = useCallback(() => {
    if (currentTimelineIndex > 0) {
      handleTimelineIndexChange(currentTimelineIndex - 1);
    }
  }, [currentTimelineIndex, handleTimelineIndexChange]);

  const handleStepForward = useCallback(() => {
    if (currentTimelineIndex < snapshots.length - 1) {
      handleTimelineIndexChange(currentTimelineIndex + 1);
    }
  }, [currentTimelineIndex, snapshots.length, handleTimelineIndexChange]);

  const handlePlayPause = useCallback(() => {
    if (isTimelinePlaying) {
      setIsTimelinePlaying(false);
    } else {
      if (currentTimelineIndex >= snapshots.length - 1) {
        setCurrentTimelineIndex(0);
        if (snapshots[0]) {
          applySnapshot(snapshots[0]);
        }
      }
      setIsTimelinePlaying(true);
    }
  }, [isTimelinePlaying, currentTimelineIndex, snapshots.length, applySnapshot]);

  useEffect(() => {
    if (!isTimelinePlaying) {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
      return;
    }

    const baseDelay = 500;
    const delayMs = Math.max(100, baseDelay / speed);

    playIntervalRef.current = window.setInterval(() => {
      setCurrentTimelineIndex((prev) => {
        const next = prev + 1;
        if (next >= snapshots.length) {
          setIsTimelinePlaying(false);
          return prev;
        }
        if (snapshots[next]) {
          applySnapshot(snapshots[next]);
        }
        return next;
      });
    }, delayMs);

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    };
  }, [isTimelinePlaying, speed, snapshots, applySnapshot]);

  const handleMaxSlotsChange = useCallback((value: number) => {
    setMaxSlots(value);
    simulatorRef.current = new FragmentationSimulator(value);
    syncFromSimulator();
    setAnimationPhase('idle');
    setCurrentOperation(null);
    setHighlightedPageId(null);
    setScanningPageIds([]);
    setScanKey(null);
    setTimelineOperations([]);
    setSnapshots([]);
    setCurrentTimelineIndex(0);
    setIsTimelinePlaying(false);
    setIsTimelineMode(false);
    snapshotOpIndexRef.current = 0;
  }, [syncFromSimulator]);

  const handleReset = useCallback(() => {
    isRunningRef.current = false;
    setIsTimelinePlaying(false);
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
    simulatorRef.current = new FragmentationSimulator(maxSlots);
    syncFromSimulator();
    setIsAnimating(false);
    setAnimationPhase('idle');
    setCurrentOperation(null);
    setHighlightedPageId(null);
    setScanningPageIds([]);
    setScanKey(null);
    setTimelineOperations([]);
    setSnapshots([]);
    setCurrentTimelineIndex(0);
    setIsTimelineMode(false);
    snapshotOpIndexRef.current = 0;
  }, [maxSlots, syncFromSimulator]);

  const handlePageDragEnd = useCallback((pageId: string, x: number, y: number) => {
    simulatorRef.current.updatePagePosition(pageId, x, y);
    setPages({ ...simulatorRef.current.pages });
    setStats(simulatorRef.current.getStats());
  }, []);

  const delay = (ms: number) =>
    new Promise((resolve) => {
      animationTimeoutRef.current = window.setTimeout(resolve, ms);
    });

  const getDelayMs = () => {
    const baseDelay = 500;
    return Math.max(30, baseDelay / speed);
  };

  const findSlotForKey = (pageId: string, key: number): number => {
    const sim = simulatorRef.current;
    const page = sim.pages[pageId];
    if (!page) return -1;
    return page.slots.findIndex((s) => s.key === key && (s.status === 'used' || s.status === 'scanning'));
  };

  const handleSimulateFragmentation = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    setIsAnimating(true);
    setIsTimelineMode(false);
    setTimelineOperations([]);
    setSnapshots([]);
    setCurrentTimelineIndex(0);
    snapshotOpIndexRef.current = 0;

    const sim = simulatorRef.current;

    const insertKeys: number[] = [];
    while (insertKeys.length < INSERT_COUNT) {
      const k = Math.floor(Math.random() * 200) + 1;
      if (!insertKeys.includes(k)) {
        insertKeys.push(k);
      }
    }

    let insertIdx = 0;
    for (const key of insertKeys) {
      if (!isRunningRef.current) break;

      setAnimationPhase('inserting');
      setCurrentOperation(`插入 ${key} (${insertIdx + 1}/${INSERT_COUNT})`);

      const frames = sim.insert(key);

      let splitFrame: { sourcePageId: string; newPageId: string } | null = null;
      for (const frame of frames) {
        if (!isRunningRef.current) break;

        if (frame.type === 'insert') {
          setHighlightedPageId(frame.pageId);
          syncFromSimulator();
          await delay(getDelayMs());
        } else if (frame.type === 'split') {
          splitFrame = { sourcePageId: frame.sourcePageId, newPageId: frame.newPageId };
          setAnimationPhase('splitting');

          const sourcePage = sim.pages[frame.sourcePageId];
          const newPage = sim.pages[frame.newPageId];

          if (sourcePage && newPage) {
            const sourceX = sourcePage.x;
            const sourceY = sourcePage.y;
            const targetX = newPage.x;

            sourcePage.isTearing = true;
            sourcePage.splitHalf = 'left';
            sourcePage.splitOffset = 0;
            sourcePage.splitOriginX = sourceX;
            sourcePage.splitOriginY = sourceY;

            newPage.splitFromX = sourceX;
            newPage.splitFromY = sourceY;
            newPage.splitHalf = 'right';
            newPage.splitOffset = 0;
            newPage.splitOriginX = sourceX;
            newPage.splitOriginY = sourceY;
            newPage.isNew = true;

            setPages({ ...sim.pages });
            setHighlightedPageId(frame.sourcePageId);
            await delay(getDelayMs() * 0.5);

            sourcePage.isTearing = false;
            setPages({ ...sim.pages });

            const slideSteps = 10;
            const totalDistance = targetX - sourceX + 90;
            const stepDistance = totalDistance / slideSteps;

            for (let i = 1; i <= slideSteps; i++) {
              if (!isRunningRef.current) break;
              newPage.splitOffset = stepDistance * i;
              setPages({ ...sim.pages });
              await delay(getDelayMs() * 0.08);
            }

            newPage.splitOffset = totalDistance;
            setPages({ ...sim.pages });
            await delay(getDelayMs() * 0.3);

            sourcePage.isExpanding = true;
            sourcePage.expandProgress = 0;
            newPage.isExpanding = true;
            newPage.expandProgress = 0;
            setPages({ ...sim.pages });

            const expandSteps = 8;
            for (let i = 1; i <= expandSteps; i++) {
              if (!isRunningRef.current) break;
              const progress = i / expandSteps;
              sourcePage.expandProgress = progress;
              newPage.expandProgress = progress;
              setPages({ ...sim.pages });
              await delay(getDelayMs() * 0.06);
            }

            sourcePage.splitHalf = 'full';
            sourcePage.splitOffset = undefined;
            sourcePage.splitOriginX = undefined;
            sourcePage.splitOriginY = undefined;
            sourcePage.isExpanding = undefined;
            sourcePage.expandProgress = undefined;

            newPage.splitHalf = 'full';
            newPage.splitOffset = undefined;
            newPage.splitOriginX = undefined;
            newPage.splitOriginY = undefined;
            newPage.isExpanding = undefined;
            newPage.expandProgress = undefined;
            newPage.splitFromX = undefined;
            newPage.splitFromY = undefined;
            newPage.splitDirection = undefined;

            setPages({ ...sim.pages });
            await delay(getDelayMs() * 0.3);
          }

          syncFromSimulator();
          await delay(getDelayMs() * 0.3);
        }
      }

      const pageId = findLeafPageForKey(sim, key);
      const pageIdx = pageId ? sim.pages[pageId]?.pageIndex : -1;
      addTimelineOperation('insert', `插入 key=${key} 到页面#${pageIdx}`);

      if (splitFrame) {
        const sourceIdx = sim.pages[splitFrame.sourcePageId]?.pageIndex;
        const newIdx = sim.pages[splitFrame.newPageId]?.pageIndex;
        addTimelineOperation(
          'split',
          `页面#${sourceIdx}分裂为#${sourceIdx}和#${newIdx}`
        );
      }

      setHighlightedPageId(null);
      insertIdx++;
    }

    const usedKeys = sim.getAllLeafKeys();
    const deleteKeys: number[] = [];
    const shuffled = [...usedKeys].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(DELETE_COUNT, shuffled.length); i++) {
      deleteKeys.push(shuffled[i]);
    }

    let deleteIdx = 0;
    for (const key of deleteKeys) {
      if (!isRunningRef.current) break;
      setAnimationPhase('deleting');
      setCurrentOperation(`删除 ${key} (${deleteIdx + 1}/${deleteKeys.length})`);

      const pageId = findLeafPageForKey(sim, key);
      if (pageId) {
        const slotIdx = findSlotForKey(pageId, key);
        if (slotIdx >= 0) {
          const page = sim.pages[pageId];
          setHighlightedPageId(pageId);

          page.slots[slotIdx].status = 'deleting';
          setPages({ ...sim.pages });
          await delay(getDelayMs() * 0.5);

          page.slots[slotIdx].status = 'deleted';
          setPages({ ...sim.pages });
          await delay(getDelayMs() * 0.3);

          const logicalNode = Object.values(sim.logicalNodes).find(
            (n) => n.pageId === pageId
          );
          if (logicalNode) {
            const keyIdx = logicalNode.keys.indexOf(key);
            if (keyIdx >= 0) {
              logicalNode.keys.splice(keyIdx, 1);
            }
          }
        }
      }

      const pageIdx = pageId ? sim.pages[pageId]?.pageIndex : -1;
      addTimelineOperation('delete', `删除 key=${key} 从页面#${pageIdx}`);

      setHighlightedPageId(null);
      deleteIdx++;
    }

    const deletedSlots: { pageId: string; slotIdx: number }[] = [];
    Object.entries(sim.pages).forEach(([pageId, page]) => {
      page.slots.forEach((slot, slotIdx) => {
        if (slot.status === 'deleted') {
          deletedSlots.push({ pageId, slotIdx });
        }
      });
    });

    setAnimationPhase('deleting');
    setCurrentOperation(`整理已删除空间: 共 ${deletedSlots.length} 个`);

    for (let i = 0; i < deletedSlots.length; i++) {
      if (!isRunningRef.current) break;
      const { pageId, slotIdx } = deletedSlots[i];
      const page = sim.pages[pageId];
      if (page && page.slots[slotIdx]) {
        page.slots[slotIdx].isCollapsed = true;
        setPages({ ...sim.pages });
        await delay(Math.max(20, getDelayMs() * 0.15));
      }
    }

    isRunningRef.current = false;
    setAnimationPhase('complete');
    setCurrentOperation(null);
    setIsAnimating(false);
    setIsTimelineMode(true);
    syncFromSimulator();
  }, [syncFromSimulator, speed, addTimelineOperation]);

  const handleReindex = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    setIsAnimating(true);
    setIsTimelineMode(false);

    const sim = simulatorRef.current;
    const allKeys = sim.getAllLeafKeys();

    setAnimationPhase('reindex_scan');
    setCurrentOperation(`扫描阶段: 共 ${allKeys.length} 个 key`);

    let lastScanPageId: string | null = null;
    let lastScanSlotIdx: number = -1;

    for (let i = 0; i < allKeys.length; i++) {
      if (!isRunningRef.current) break;

      const key = allKeys[i];
      setScanKey(key);

      const pageId = findLeafPageForKey(sim, key);
      if (pageId) {
        const slotIdx = findSlotForKey(pageId, key);
        if (slotIdx >= 0) {
          const page = sim.pages[pageId];

          if (lastScanPageId && lastScanPageId !== pageId && lastScanSlotIdx >= 0) {
            const lastPage = sim.pages[lastScanPageId];
            if (lastPage && lastPage.slots[lastScanSlotIdx]) {
              lastPage.slots[lastScanSlotIdx].status = 'used';
            }
          }

          if (page.slots[slotIdx]) {
            page.slots[slotIdx].status = 'scanning';
          }

          setScanningPageIds((prev) =>
            prev.includes(pageId) ? prev : [...prev, pageId]
          );
          setPages({ ...sim.pages });

          lastScanPageId = pageId;
          lastScanSlotIdx = slotIdx;
        }
      }

      setCurrentOperation(`扫描阶段: ${i + 1}/${allKeys.length} - key ${key}`);
      await delay(Math.max(20, getDelayMs() * 0.5));
    }

    if (lastScanPageId && lastScanSlotIdx >= 0) {
      const lastPage = sim.pages[lastScanPageId];
      if (lastPage && lastPage.slots[lastScanSlotIdx]) {
        lastPage.slots[lastScanSlotIdx].status = 'used';
      }
      setPages({ ...sim.pages });
    }

    if (!isRunningRef.current) {
      setIsAnimating(false);
      return;
    }

    setAnimationPhase('reindex_compact');
    setCurrentOperation('紧凑阶段: 创建新页面');

    const oldPageIds = [...sim.pageOrder];
    const oldLeafChain = [...sim.leafChain];

    const newLeafChain: string[] = [];
    const PAGE_WIDTH = 180;
    const PAGE_HEIGHT = 140;
    const PAGE_GAP_X = 40;
    const PAGE_GAP_Y = 30;
    const PAGES_PER_ROW = 5;

    const startRow = Math.ceil(sim.pageOrder.length / PAGES_PER_ROW) + 2;
    let currentKeyIdx = 0;
    let newPageIdx = 0;
    let oldPageFadeIdx = 0;

    const fadingPages: Record<string, boolean> = {};

    while (currentKeyIdx < allKeys.length && isRunningRef.current) {
      const col = newPageIdx % PAGES_PER_ROW;
      const row = startRow + Math.floor(newPageIdx / PAGES_PER_ROW);
      const x = 20 + col * (PAGE_WIDTH + PAGE_GAP_X);
      const y = 20 + row * (PAGE_HEIGHT + PAGE_GAP_Y);

      const newPage = sim.createEmptyPage(x, y);
      newPage.isNew = true;
      newLeafChain.push(newPage.id);

      const pagesToShow = { ...sim.pages };
      Object.keys(fadingPages).forEach((id) => {
        if (pagesToShow[id]) {
          pagesToShow[id] = { ...pagesToShow[id], isFading: true };
        }
      });
      setPages(pagesToShow);
      setCurrentOperation(`紧凑阶段: 第 ${newPageIdx + 1} 页`);
      await delay(getDelayMs() * 0.7);

      for (
        let i = 0;
        i < maxSlots && currentKeyIdx < allKeys.length && isRunningRef.current;
        i++
      ) {
        newPage.slots[i] = { key: allKeys[currentKeyIdx], status: 'used' };
        const pagesWithKeys = { ...sim.pages };
        Object.keys(fadingPages).forEach((id) => {
          if (pagesWithKeys[id]) {
            pagesWithKeys[id] = { ...pagesWithKeys[id], isFading: true };
          }
        });
        setPages(pagesWithKeys);
        setCurrentOperation(
          `紧凑阶段: 第 ${newPageIdx + 1} 页 - key ${allKeys[currentKeyIdx]}`
        );
        await delay(Math.max(15, getDelayMs() * 0.3));
        currentKeyIdx++;
      }

      if (oldPageFadeIdx < oldPageIds.length && isRunningRef.current) {
        const pageToFade = oldPageIds[oldPageFadeIdx];
        fadingPages[pageToFade] = true;
        oldPageFadeIdx++;

        const pagesWithFade = { ...sim.pages };
        Object.keys(fadingPages).forEach((id) => {
          if (pagesWithFade[id]) {
            pagesWithFade[id] = { ...pagesWithFade[id], isFading: true };
          }
        });
        setPages(pagesWithFade);
        await delay(getDelayMs() * 0.3);
      }

      newPageIdx++;
    }

    while (oldPageFadeIdx < oldPageIds.length && isRunningRef.current) {
      const pageToFade = oldPageIds[oldPageFadeIdx];
      fadingPages[pageToFade] = true;
      oldPageFadeIdx++;

      const pagesWithFade = { ...sim.pages };
      Object.keys(fadingPages).forEach((id) => {
        if (pagesWithFade[id]) {
          pagesWithFade[id] = { ...pagesWithFade[id], isFading: true };
        }
      });
      setPages(pagesWithFade);
      await delay(getDelayMs() * 0.4);
    }

    if (!isRunningRef.current) {
      setIsAnimating(false);
      return;
    }

    sim.leafChain = newLeafChain;

    const pagesToDelete = Object.keys(fadingPages);
    for (let i = 0; i < pagesToDelete.length && isRunningRef.current; i++) {
      const id = pagesToDelete[i];
      if (sim.pages[id]) {
        sim.pages[id].isFading = true;
        const pagesWithDelete = { ...sim.pages };
        for (let j = i; j < pagesToDelete.length; j++) {
          if (pagesWithDelete[pagesToDelete[j]]) {
            pagesWithDelete[pagesToDelete[j]] = {
              ...pagesWithDelete[pagesToDelete[j]],
              isFading: true,
            };
          }
        }
        setPages(pagesWithDelete);
        await delay(getDelayMs() * 0.2);
        delete sim.pages[id];
        const idx = sim.pageOrder.indexOf(id);
        if (idx >= 0) sim.pageOrder.splice(idx, 1);
        setPages({ ...sim.pages });
      }
    }

    sim.pageOrder.forEach((id, idx) => {
      sim.pages[id].pageIndex = idx;
      sim.pages[id].isNew = false;
      sim.pages[id].isFading = false;
    });
    sim.nextPageIndex = sim.pageOrder.length;

    const leafLogicalNodes: LogicalNode[] = [];
    newLeafChain.forEach((pageId) => {
      const page = sim.pages[pageId];
      const keys = page.slots
        .filter((s) => s.status === 'used')
        .map((s) => s.key!);
      const node: LogicalNode = {
        id: Math.random().toString(36).slice(2, 10),
        keys,
        children: [],
        isLeaf: true,
        level: 0,
        pageId,
      };
      leafLogicalNodes.push(node);
      sim.logicalNodes[node.id] = node;
    });

    if (leafLogicalNodes.length > 0) {
      sim.logicalRootId = leafLogicalNodes[0].id;
    }

    setAnimationPhase('reindex_relink');
    setCurrentOperation('重链阶段: 连接新页面');
    setScanningPageIds([]);
    setScanKey(null);
    syncFromSimulator();
    await delay(getDelayMs() * 2);

    addTimelineOperation('reindex', `REINDEX 重建完成 (${allKeys.length}个key)`);

    isRunningRef.current = false;
    setAnimationPhase('complete');
    setCurrentOperation('重建完成！');
    setIsAnimating(false);
    setIsTimelineMode(true);
    syncFromSimulator();

    setTimeout(() => {
      setAnimationPhase('idle');
      setCurrentOperation(null);
    }, 2000);
  }, [maxSlots, syncFromSimulator, speed, addTimelineOperation]);

  useEffect(() => {
    syncFromSimulator();
    return () => {
      isRunningRef.current = false;
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [syncFromSimulator]);

  return (
    <div className="h-full flex flex-col p-4 gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            📊 索引页面分裂与碎片化可视化
          </h2>
          <p className="text-sm text-slate-500">
            展示B+树索引在频繁插入删除后的物理存储碎片化过程以及REINDEX重建效果
          </p>
        </div>
        {scanKey !== null && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-100 text-sky-700 rounded-lg text-sm font-medium">
            <span className="animate-pulse">🔍</span>
            正在扫描: {scanKey}
          </div>
        )}
      </div>

      <div className="flex-1 flex gap-3 min-h-0">
        <div className="w-64 flex-shrink-0 card p-3 flex flex-col min-h-0">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">
            🌳 逻辑B+树视图
          </h3>
          <div className="flex-1 min-h-0 overflow-auto border border-slate-100 rounded-lg bg-slate-50">
            <LogicalBTreeView
              nodes={logicalNodes}
              rootId={logicalRootId}
              highlightNodeId={null}
              scanKey={scanKey}
            />
          </div>
        </div>

        <div className="flex-1 card p-3 flex flex-col min-h-0">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">
            📦 物理页面视图
          </h3>
          <div className="flex-1 min-h-0 overflow-hidden">
            <PhysicalPageView
              pages={pages}
              leafChain={leafChain}
              highlightedPageId={highlightedPageId}
              scanningPageIds={scanningPageIds}
              onPageDragEnd={handlePageDragEnd}
              isAnimated={isTimelineMode}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <StatsPanel stats={stats} maxSlots={maxSlots} />
        <ControlPanel
          maxSlots={maxSlots}
          onMaxSlotsChange={handleMaxSlotsChange}
          onSimulateFragmentation={handleSimulateFragmentation}
          onReindex={handleReindex}
          onReset={handleReset}
          isAnimating={isAnimating}
          animationPhase={animationPhase}
          speed={speed}
          onSpeedChange={setSpeed}
          currentOperation={currentOperation}
        />
        {timelineOperations.length > 0 && (
          <div className="card p-3">
            <Timeline
              operations={timelineOperations}
              currentIndex={currentTimelineIndex}
              onIndexChange={handleTimelineIndexChange}
              isPlaying={isTimelinePlaying}
              onPlayPause={handlePlayPause}
              onStepBack={handleStepBack}
              onStepForward={handleStepForward}
              speed={speed}
              disabled={!isTimelineMode}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function findLeafPageForKey(sim: FragmentationSimulator, key: number): string | null {
  if (!sim.logicalRootId) return null;
  let nodeId = sim.logicalRootId;
  while (true) {
    const node = sim.logicalNodes[nodeId];
    if (!node) return null;
    if (node.isLeaf) return node.pageId;
    let childIdx = node.keys.length;
    for (let i = 0; i < node.keys.length; i++) {
      if (key < node.keys[i]) {
        childIdx = i;
        break;
      }
    }
    nodeId = node.children[childIdx];
  }
}
