export type HashMethod = 'modulo' | 'multiplication';
export type CollisionStrategy = 'chaining' | 'linear' | 'quadratic' | 'double';

export interface HashBucketEntry {
  id: string;
  key: number;
  isTombstone?: boolean;
}

export interface HashBucket {
  index: number;
  entries: HashBucketEntry[];
}

export interface HashState {
  buckets: HashBucket[];
  size: number;
  method: HashMethod;
  strategy: CollisionStrategy;
  loadFactor: number;
  collisionCount: number;
  maxChainLength: number;
  highlighting: {
    bucketIndex?: number;
    chainIndex?: number;
    probePath?: number[];
    action?: 'insert' | 'search' | 'delete' | 'rehash';
    insertingKey?: number;
    oldBuckets?: HashBucket[];
    rehashing?: boolean;
  };
}
