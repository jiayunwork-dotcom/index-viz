import { useState, useCallback, useRef, useEffect } from 'react';
import { FragmentationSimulator } from '@/structures/fragmentation/fragmentation';
import type { PhysicalPage, LogicalNode, Stats, AnimationPhase } from '@/structures/fragmentation/types';
import LogicalBTreeView from '@/components/fragmentation/LogicalBTreeView';
import PhysicalPageView from '@/components/fragmentation/PhysicalPageView';
import ControlPanel from '@/components/fragmentation/ControlPanel';
import StatsPanel from '@/components/fragmentation/StatsPanel';

const DEFAULT_MAX_SLOTS = 8;
const INSERT_COUNT = 80;
const DELETE_COUNT = 40;

export default function FragmentationPage() {
  const [maxSlots, setMaxSlots] = useState(DEFAULT_MAX_SLOTS);
  const [speed, setSpeed] = useState(3);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('idle');
  const [currentOperation, setCurrentOperation] = useState<string | null>(null);
  const [highlightedPageId, setHighlightedPageId] = useState<string | null>(null);
  const [scanningPageIds, setScanningPageIds] = useState<string[]>([]);

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

  const simulatorRef = useRef<FragmentationSimulator>(
    new FragmentationSimulator(DEFAULT_MAX_SLOTS)
  );
  const animationTimeoutRef = useRef<number | null>(null);
  const isRunningRef = useRef(false);

  const syncFromSimulator = useCallback(() => {
    const sim = simulatorRef.current;
    setPages({ ...sim.pages });
    setLogicalNodes({ ...sim.logicalNodes });
    setLogicalRootId(sim.logicalRootId);
    setLeafChain([...sim.leafChain]);
    setStats(sim.getStats());
  }, []);

  const handleMaxSlotsChange = useCallback((value: number) => {
    setMaxSlots(value);
    simulatorRef.current = new FragmentationSimulator(value);
    syncFromSimulator();
    setAnimationPhase('idle');
    setCurrentOperation(null);
    setHighlightedPageId(null);
    setScanningPageIds([]);
  }, [syncFromSimulator]);

  const handleReset = useCallback(() => {
    isRunningRef.current = false;
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
    simulatorRef.current = new FragmentationSimulator(maxSlots);
    syncFromSimulator();
    setIsAnimating(false);
    setAnimationPhase('idle');
    setCurrentOperation(null);
    setHighlightedPageId(null);
    setScanningPageIds([]);
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
    return Math.max(50, baseDelay / speed);
  };

  const handleSimulateFragmentation = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    setIsAnimating(true);

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

      for (const frame of frames) {
        if (frame.type === 'insert') {
          setHighlightedPageId(frame.pageId);
          syncFromSimulator();
          await delay(getDelayMs());
        } else if (frame.type === 'split') {
          setAnimationPhase('splitting');
          setHighlightedPageId(frame.newPageId);

          const sourcePage = sim.pages[frame.sourcePageId];
          if (sourcePage) {
            sourcePage.isSplitting = true;
            setPages({ ...sim.pages });
          }
          await delay(getDelayMs() * 1.5);

          if (sourcePage) {
            sourcePage.isSplitting = false;
          }
          syncFromSimulator();
          await delay(getDelayMs());
        }
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

      const frames = sim.delete(key);
      for (const frame of frames) {
        if (!isRunningRef.current) break;
        if (frame.type === 'delete') {
          setHighlightedPageId(frame.pageId);
          syncFromSimulator();
          await delay(getDelayMs() * 0.7);
        }
      }

      setHighlightedPageId(null);
      deleteIdx++;
    }

    isRunningRef.current = false;
    setAnimationPhase('complete');
    setCurrentOperation(null);
    setIsAnimating(false);
    syncFromSimulator();
  }, [syncFromSimulator, speed]);

  const handleReindex = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    setIsAnimating(true);

    const sim = simulatorRef.current;
    const allKeys = sim.getAllLeafKeys();

    setAnimationPhase('reindex_scan');
    setCurrentOperation(`扫描阶段: 共 ${allKeys.length} 个 key`);

    for (let i = 0; i < allKeys.length; i++) {
      if (!isRunningRef.current) break;
      setScanningPageIds((prev) => {
        const key = allKeys[i];
        for (const pageId of sim.leafChain) {
          const page = sim.pages[pageId];
          if (page && page.slots.some((s) => s.key === key && s.status === 'used')) {
            if (!prev.includes(pageId)) {
              return [...prev, pageId];
            }
            break;
          }
        }
        return prev;
      });
      setCurrentOperation(`扫描阶段: ${i + 1}/${allKeys.length}`);
      await delay(Math.max(20, getDelayMs() * 0.3));
    }

    if (!isRunningRef.current) {
      setIsAnimating(false);
      return;
    }

    setAnimationPhase('reindex_compact');
    setCurrentOperation('紧凑阶段: 创建新页面');

    const oldPages = { ...sim.pages };
    const oldLeafChain = [...sim.leafChain];

    Object.keys(oldPages).forEach((id) => {
      oldPages[id].isFading = true;
    });
    setPages({ ...sim.pages, ...oldPages });
    await delay(getDelayMs());

    const newLeafChain: string[] = [];
    const PAGE_WIDTH = 180;
    const PAGE_HEIGHT = 140;
    const PAGE_GAP_X = 40;
    const PAGE_GAP_Y = 30;
    const PAGES_PER_ROW = 5;

    const startRow = Math.ceil(sim.pageOrder.length / PAGES_PER_ROW) + 2;
    let currentKeyIdx = 0;
    let newPageIdx = 0;

    while (currentKeyIdx < allKeys.length && isRunningRef.current) {
      const col = newPageIdx % PAGES_PER_ROW;
      const row = startRow + Math.floor(newPageIdx / PAGES_PER_ROW);
      const x = 20 + col * (PAGE_WIDTH + PAGE_GAP_X);
      const y = 20 + row * (PAGE_HEIGHT + PAGE_GAP_Y);

      const newPage = sim.createEmptyPage(x, y);
      newPage.isNew = true;
      newLeafChain.push(newPage.id);

      setPages({ ...sim.pages, ...oldPages });
      setCurrentOperation(`紧凑阶段: 第 ${newPageIdx + 1} 页`);
      await delay(getDelayMs());

      for (
        let i = 0;
        i < maxSlots && currentKeyIdx < allKeys.length && isRunningRef.current;
        i++
      ) {
        newPage.slots[i] = { key: allKeys[currentKeyIdx], status: 'used' };
        setPages({ ...sim.pages, ...oldPages });
        setCurrentOperation(
          `紧凑阶段: 第 ${newPageIdx + 1} 页 - key ${allKeys[currentKeyIdx]}`
        );
        await delay(Math.max(20, getDelayMs() * 0.4));
        currentKeyIdx++;
      }
      newPageIdx++;
    }

    if (!isRunningRef.current) {
      setIsAnimating(false);
      return;
    }

    sim.leafChain = newLeafChain;

    Object.keys(oldPages).forEach((id) => {
      delete sim.pages[id];
      const idx = sim.pageOrder.indexOf(id);
      if (idx >= 0) sim.pageOrder.splice(idx, 1);
    });

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
    syncFromSimulator();
    setScanningPageIds([]);
    await delay(getDelayMs() * 2);

    isRunningRef.current = false;
    setAnimationPhase('complete');
    setCurrentOperation('重建完成！');
    setIsAnimating(false);
    syncFromSimulator();

    setTimeout(() => {
      setAnimationPhase('idle');
      setCurrentOperation(null);
    }, 2000);
  }, [maxSlots, syncFromSimulator, speed]);

  useEffect(() => {
    syncFromSimulator();
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
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
      </div>
    </div>
  );
}
