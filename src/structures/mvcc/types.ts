export type TxnStatus = 'active' | 'committed' | 'aborted';

export type IsolationLevel = 'read-committed' | 'repeatable-read';

export interface DataRow {
  id: number;
  name: string;
  balance: number;
}

export interface Version {
  versionId: string;
  rowId: number;
  name: string;
  balance: number;
  xmin: number;
  xmax: number | null;
  xminStatus: TxnStatus;
  xmaxStatus: TxnStatus | null;
  createdAt: number;
  isNew?: boolean;
  isRemoving?: boolean;
  isHighlighted?: boolean;
}

export interface Transaction {
  txnId: string;
  txnNum: number;
  status: TxnStatus;
  startTs: number;
  snapshotTs: number;
  displayOrder: number;
  writes: { rowId: number; versionId: string }[];
  isDragging?: boolean;
}

export interface VisibilityCheckStep {
  versionId: string;
  rowId: number;
  visible: boolean;
  reason: string;
  index: number;
  isHighlighted: boolean;
  isFinal?: boolean;
}

export interface ReadResult {
  txnId: string;
  rowId: number;
  foundVersion: Version | null;
  steps: VisibilityCheckStep[];
  timestamp: number;
}

export interface WriteDialogState {
  open: boolean;
  txnId: string | null;
}

export interface ReadDialogState {
  open: boolean;
  txnId: string | null;
}

export const INITIAL_ROWS: DataRow[] = [
  { id: 1, name: 'Alice', balance: 1000 },
  { id: 2, name: 'Bob', balance: 500 },
  { id: 3, name: 'Charlie', balance: 2000 },
  { id: 4, name: 'Diana', balance: 800 },
  { id: 5, name: 'Eve', balance: 1500 },
];

export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 110;
export const NODE_GAP = 60;
export const SVG_PADDING = 40;
