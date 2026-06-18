export interface SkipListNodeData {
  id: string;
  key: number;
  level: number;
  forward: (string | null)[];
  x?: number;
  y?: number;
}

export interface SkipListState {
  nodes: Record<string, SkipListNodeData>;
  headId: string;
  maxLevel: number;
  probability: number;
  levelCounts: number[];
  highlighting: {
    path?: { nodeId: string; level: number }[];
    insertingKey?: number;
    foundNodeId?: string;
    coinFlip?: 'heads' | 'tails' | null;
    coinResults?: ('heads' | 'tails')[];
    currentLevel?: number;
    newLevels?: number;
    action?: 'insert' | 'search' | 'delete';
  };
}
