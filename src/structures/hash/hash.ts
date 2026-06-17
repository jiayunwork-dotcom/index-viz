import type { AnimationFrame } from '@/store/animationStore';
import type { HashBucket, HashBucketEntry, HashMethod, CollisionStrategy } from './types';
import { uid } from '@/lib/utils';

export class HashTable {
  buckets: HashBucket[] = [];
  method: HashMethod;
  strategy: CollisionStrategy;
  collisionCount = 0;

  constructor(size: number, method: HashMethod = 'modulo', strategy: CollisionStrategy = 'chaining') {
    this.method = method;
    this.strategy = strategy;
    this.resize(size);
  }

  resize(size: number) {
    this.buckets = Array.from({ length: size }, (_, i) => ({ index: i, entries: [] }));
    this.collisionCount = 0;
  }

  hash(key: number, attempt = 0, size = this.buckets.length): number {
    const h = this.method === 'modulo' ? key % size : Math.floor(((key * 0.6180339887) % 1) * size);
    const base = ((h % size) + size) % size;

    if (this.strategy === 'chaining' || attempt === 0) return base;

    if (this.strategy === 'linear') return (base + attempt) % size;
    if (this.strategy === 'quadratic') return (base + attempt * attempt) % size;
    if (this.strategy === 'double') {
      const h2 = 1 + (key % (size - 1));
      return (base + attempt * h2) % size;
    }
    return base;
  }

  insert(key: number): AnimationFrame[] {
    const frames: AnimationFrame[] = [];
    const loadFactor = this.countFilled() / this.buckets.length;

    if (this.strategy !== 'chaining' && loadFactor > 0.7) {
      frames.push(...this.rehash(this.buckets.length * 2));
    } else if (this.strategy === 'chaining' && loadFactor > 1) {
      frames.push(...this.rehash(this.buckets.length * 2));
    }

    const probePath: number[] = [];

    if (this.strategy === 'chaining') {
      const idx = this.hash(key);
      probePath.push(idx);
      frames.push(this.makeFrame(`计算 hash(${key}) = ${idx}`, { bucketIndex: idx, insertingKey: key, probePath, action: 'insert' }));

      if (this.buckets[idx].entries.length > 0) this.collisionCount++;
      this.buckets[idx].entries.push({ id: uid(), key });
      frames.push(this.makeFrame(`将 ${key} 放入桶 ${idx}`, { bucketIndex: idx, chainIndex: this.buckets[idx].entries.length - 1, insertingKey: key, probePath, action: 'insert' }));
    } else {
      let placed = false;
      for (let i = 0; i < this.buckets.length && !placed; i++) {
        const idx = this.hash(key, i);
        probePath.push(idx);
        frames.push(this.makeFrame(`探测位置 ${idx}`, { bucketIndex: idx, insertingKey: key, probePath, action: 'insert' }));

        if (this.buckets[idx].entries.length === 0 || this.buckets[idx].entries[0].isTombstone) {
          this.buckets[idx].entries = [{ id: uid(), key }];
          placed = true;
          frames.push(this.makeFrame(`将 ${key} 放入位置 ${idx}`, { bucketIndex: idx, insertingKey: key, probePath, action: 'insert' }));
        } else if (i > 0) {
          this.collisionCount++;
        }
      }
      if (!placed) frames.push(this.makeFrame(`表已满，无法插入 ${key}`, { insertingKey: key, action: 'insert' }));
    }

    return frames;
  }

  search(key: number): AnimationFrame[] {
    const frames: AnimationFrame[] = [];
    const probePath: number[] = [];

    if (this.strategy === 'chaining') {
      const idx = this.hash(key);
      probePath.push(idx);
      frames.push(this.makeFrame(`计算 hash(${key}) = ${idx}`, { bucketIndex: idx, probePath, action: 'search' }));
      const chainIdx = this.buckets[idx].entries.findIndex((e) => e.key === key && !e.isTombstone);
      if (chainIdx >= 0) {
        frames.push(this.makeFrame(`在桶 ${idx} 的链表位置 ${chainIdx} 找到 ${key}`, { bucketIndex: idx, chainIndex: chainIdx, probePath, action: 'search' }));
      } else {
        frames.push(this.makeFrame(`未找到 ${key}`, { bucketIndex: idx, probePath, action: 'search' }));
      }
    } else {
      let found = false;
      for (let i = 0; i < this.buckets.length && !found; i++) {
        const idx = this.hash(key, i);
        probePath.push(idx);
        frames.push(this.makeFrame(`探测位置 ${idx}`, { bucketIndex: idx, probePath, action: 'search' }));
        if (this.buckets[idx].entries.length === 0) break;
        if (this.buckets[idx].entries[0].key === key && !this.buckets[idx].entries[0].isTombstone) {
          frames.push(this.makeFrame(`在位置 ${idx} 找到 ${key}`, { bucketIndex: idx, probePath, action: 'search' }));
          found = true;
        }
      }
      if (!found) frames.push(this.makeFrame(`未找到 ${key}`, { probePath, action: 'search' }));
    }

    return frames;
  }

  delete(key: number): AnimationFrame[] {
    const frames: AnimationFrame[] = [];
    const probePath: number[] = [];

    if (this.strategy === 'chaining') {
      const idx = this.hash(key);
      probePath.push(idx);
      frames.push(this.makeFrame(`计算 hash(${key}) = ${idx}`, { bucketIndex: idx, probePath, action: 'delete' }));
      const chainIdx = this.buckets[idx].entries.findIndex((e) => e.key === key);
      if (chainIdx >= 0) {
        this.buckets[idx].entries.splice(chainIdx, 1);
        frames.push(this.makeFrame(`从桶 ${idx} 删除 ${key}`, { bucketIndex: idx, probePath, action: 'delete' }));
      } else {
        frames.push(this.makeFrame(`未找到 ${key}`, { probePath, action: 'delete' }));
      }
    } else {
      let found = false;
      for (let i = 0; i < this.buckets.length && !found; i++) {
        const idx = this.hash(key, i);
        probePath.push(idx);
        frames.push(this.makeFrame(`探测位置 ${idx}`, { bucketIndex: idx, probePath, action: 'delete' }));
        if (this.buckets[idx].entries.length === 0) break;
        if (this.buckets[idx].entries[0].key === key && !this.buckets[idx].entries[0].isTombstone) {
          this.buckets[idx].entries[0].isTombstone = true;
          found = true;
          frames.push(this.makeFrame(`在位置 ${idx} 标记墓碑`, { bucketIndex: idx, probePath, action: 'delete' }));
        }
      }
      if (!found) frames.push(this.makeFrame(`未找到 ${key}`, { probePath, action: 'delete' }));
    }

    return frames;
  }

  rehash(newSize: number): AnimationFrame[] {
    const frames: AnimationFrame[] = [];
    const oldBuckets = this.buckets.map((b) => ({
      index: b.index,
      entries: b.entries.map((e) => ({ ...e })),
    }));

    frames.push(this.makeFrame('触发 rehash, 桶数翻倍', { oldBuckets, rehashing: true, action: 'rehash' }));

    const entries: HashBucketEntry[] = [];
    this.buckets.forEach((b) => b.entries.forEach((e) => { if (!e.isTombstone) entries.push(e); }));

    this.resize(newSize);
    frames.push(this.makeFrame(`新表大小: ${newSize}`, { oldBuckets, rehashing: true, action: 'rehash' }));

    entries.forEach((e, i) => {
      const idx = this.hash(e.key, 0, newSize);
      if (this.strategy === 'chaining') {
        this.buckets[idx].entries.push(e);
      } else {
        let placed = false;
        for (let a = 0; a < newSize && !placed; a++) {
          const p = this.hash(e.key, a, newSize);
          if (this.buckets[p].entries.length === 0) {
            this.buckets[p].entries = [e];
            placed = true;
          }
        }
      }
      frames.push(this.makeFrame(`重新映射 ${e.key} → 桶 ${idx} (${i + 1}/${entries.length})`, { bucketIndex: idx, rehashing: true, oldBuckets, action: 'rehash' }));
    });

    frames.push(this.makeFrame('rehash 完成', { rehashing: false, action: 'rehash' }));
    return frames;
  }

  countFilled(): number {
    return this.buckets.filter((b) => b.entries.length > 0 && !b.entries[0].isTombstone).length;
  }

  get maxChainLength(): number {
    return Math.max(0, ...this.buckets.map((b) => b.entries.length));
  }

  get loadFactor(): number {
    return this.countFilled() / this.buckets.length;
  }

  makeFrame(description: string, extra: any = {}): AnimationFrame {
    return {
      id: Math.random().toString(36).slice(2),
      data: {
        buckets: this.buckets.map((b) => ({
          index: b.index,
          entries: b.entries.map((e) => ({ ...e })),
        })),
        size: this.buckets.length,
        method: this.method,
        strategy: this.strategy,
        loadFactor: this.loadFactor,
        collisionCount: this.collisionCount,
        maxChainLength: this.maxChainLength,
        highlighting: extra,
      },
      description,
    };
  }
}
