export interface BTreeNodeData {
  id: string;
  keys: number[];
  children: string[];
  isLeaf: boolean;
  level: number;
  x?: number;
  y?: number;
}

export type HighlightType = 'none' | 'searching' | 'splitting' | 'merging' | 'borrowing' | 'found' | 'inserting';

export interface BTreeState {
  nodes: Record<string, BTreeNodeData>;
  rootId: string | null;
  order: number;
  isPlus: boolean;
  highlight: Record<string, HighlightType>;
  searchPath: string[];
  bisectRange: { nodeId: string; low: number; high: number } | null;
  insertingKey: number | null;
  leafChain: { from: string; to: string }[];
  rangeQuery: { start: number; end: number } | null;
}

export interface BTreeAnimationFrame {
  state: BTreeState;
}

export class BTreeNode {
  id: string;
  keys: number[];
  children: BTreeNode[];
  isLeaf: boolean;

  constructor(isLeaf = true) {
    this.id = Math.random().toString(36).slice(2, 10);
    this.keys = [];
    this.children = [];
    this.isLeaf = isLeaf;
  }
}
