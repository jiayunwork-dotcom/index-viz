export type Strategy = 'size-tiered' | 'leveled';

export interface KVPair {
  key: number;
  value: string;
  tombstone?: boolean;
}

export interface MemTableState {
  entries: KVPair[];
  capacity: number;
  frozenEntries?: KVPair[];
}

export interface SSTableData {
  id: string;
  level: number;
  entries: KVPair[];
  minKey: number;
  maxKey: number;
  size: number;
  bloom: boolean[];
}

export interface LSMState {
  memtable: MemTableState;
  levels: SSTableData[][];
  maxLevels: number;
  strategy: Strategy;
  memCapacity: number;
  highlighting: {
    action?: 'write' | 'flush' | 'compact' | 'read';
    writingEntry?: KVPair;
    compaction?: {
      fromLevel: number;
      tables: string[];
      newTableId?: string;
      progress?: number;
    };
    readPath?: {
      key: number;
      checkedMemtable?: boolean;
      checkedLevels?: { level: number; tableId: string; bloom: boolean; result?: 'found' | 'miss' | 'tombstone' }[];
    };
  };
}
