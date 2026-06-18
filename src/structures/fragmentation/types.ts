export type SlotStatus = 'free' | 'used' | 'deleted';

export interface Slot {
  key: number | null;
  status: SlotStatus;
}

export interface PhysicalPage {
  id: string;
  slots: Slot[];
  pageIndex: number;
  x: number;
  y: number;
  maxSlots: number;
  isNew?: boolean;
  isFading?: boolean;
  isSplitting?: boolean;
  isHighlighted?: boolean;
}

export interface LogicalNode {
  id: string;
  keys: number[];
  children: string[];
  isLeaf: boolean;
  level: number;
  pageId: string;
}

export interface PointerLink {
  from: string;
  to: string;
  type: 'leaf' | 'internal';
}

export interface Stats {
  totalPages: number;
  usedPages: number;
  emptyPages: number;
  avgFillRate: number;
  fragmentationIndex: number;
  maxPointerJump: number;
}

export type AnimationPhase =
  | 'idle'
  | 'inserting'
  | 'splitting'
  | 'deleting'
  | 'reindex_scan'
  | 'reindex_compact'
  | 'reindex_relink'
  | 'complete';

export interface FragmentationState {
  pages: Record<string, PhysicalPage>;
  logicalNodes: Record<string, LogicalNode>;
  logicalRootId: string | null;
  leafChain: string[];
  pageOrder: string[];
  maxSlots: number;
  stats: Stats;
  animationPhase: AnimationPhase;
  currentOperation: string | null;
  scanPosition: number;
  newPages: string[];
}

export interface InsertFrame {
  type: 'insert';
  pageId: string;
  slotIndex: number;
  key: number;
}

export interface SplitFrame {
  type: 'split';
  sourcePageId: string;
  newPageId: string;
  splitIndex: number;
  newPageX: number;
  newPageY: number;
}

export interface DeleteFrame {
  type: 'delete';
  pageId: string;
  slotIndex: number;
}

export interface ReindexFrame {
  type: 'reindex';
  phase: 'scan' | 'compact' | 'relink' | 'complete';
  scanIndex?: number;
  newPageIndex?: number;
  key?: number;
}

export type AnimationFrameData = InsertFrame | SplitFrame | DeleteFrame | ReindexFrame;
