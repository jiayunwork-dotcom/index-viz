export type OperationType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface WALLogEntry {
  id: string;
  lsn: number;
  operation: OperationType;
  pageId: number;
  content: string;
  isFlushed: boolean;
  isCheckpointed: boolean;
  isNew: boolean;
  isHighlighted: boolean;
  isScanning: boolean;
  displayOrder: number;
}

export type TimeTravelEventType = 'write' | 'checkpoint' | 'crash' | 'recovery';

export interface TimeTravelSnapshot {
  id: string;
  type: TimeTravelEventType;
  timestamp: number;
  description: string;
  entries: WALLogEntry[];
  pages: DataPage[];
  flushLSN: number;
  checkpointLSN: number;
  nextLSN: number;
  nextPageId: number;
  hasCrashed: boolean;
}

export interface TimeTravelMarker {
  id: string;
  type: TimeTravelEventType;
  index: number;
  description: string;
}

export interface DataPage {
  id: string;
  pageId: number;
  content: string;
  isDirty: boolean;
  isOnDisk: boolean;
  isFlushing: boolean;
  isNew: boolean;
  isHighlighted: boolean;
  isRecovering: boolean;
}

export type AnimationPhase =
  | 'idle'
  | 'writing'
  | 'checkpoint'
  | 'crash'
  | 'recovery'
  | 'complete';

export interface WALStats {
  totalEntries: number;
  flushedEntries: number;
  dirtyPages: number;
  diskPages: number;
  checkpointLSN: number;
  currentFlushLSN: number;
}
