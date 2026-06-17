export interface BloomState {
  bits: boolean[];
  m: number;
  k: number;
  n: number;
  fpr: number;
  insertedElements: string[];
  highlighting: {
    action?: 'insert' | 'query';
    element?: string;
    positions?: number[];
    colors?: string[];
    result?: 'maybe' | 'none' | null;
  };
}
