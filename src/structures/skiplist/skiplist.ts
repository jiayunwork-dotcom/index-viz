import type { AnimationFrame } from '@/store/animationStore';
import type { SkipListNodeData } from './types';
import { uid } from '@/lib/utils';

class SkipListNode {
  id: string;
  key: number;
  forward: (SkipListNode | null)[];

  constructor(key: number, level: number) {
    this.id = uid();
    this.key = key;
    this.forward = new Array(level + 1).fill(null);
  }
}

export class SkipList {
  head: SkipListNode;
  maxLevel: number;
  probability: number;
  level: number;

  constructor(maxLevel = 8, probability = 0.5) {
    this.maxLevel = maxLevel;
    this.probability = probability;
    this.level = 0;
    this.head = new SkipListNode(-Infinity, maxLevel);
  }

  private randomLevel(): number {
    let lvl = 0;
    while (Math.random() < this.probability && lvl < this.maxLevel - 1) lvl++;
    return lvl;
  }

  insert(key: number): AnimationFrame[] {
    const frames: AnimationFrame[] = [];
    const update: (SkipListNode | null)[] = new Array(this.maxLevel).fill(null);
    const path: { nodeId: string; level: number }[] = [];

    let current = this.head;
    for (let i = this.level; i >= 0; i--) {
      while (current.forward[i] && current.forward[i]!.key < key) {
        current = current.forward[i]!;
        path.push({ nodeId: current.id, level: i });
      }
      update[i] = current;
    }

    frames.push(this.makeFrame(`从高层扫描定位插入位置: ${key}`, { path: [...path], insertingKey: key, action: 'insert' }));

    const newLevel = this.randomLevel();
    frames.push(this.makeFrame(`抛硬币决定层高: L${newLevel + 1}`, { coinFlip: newLevel > 0 ? 'heads' : 'tails', newLevels: newLevel + 1, insertingKey: key, action: 'insert' }));

    if (newLevel > this.level) {
      for (let i = this.level + 1; i <= newLevel; i++) update[i] = this.head;
      this.level = newLevel;
    }

    const node = new SkipListNode(key, newLevel);
    for (let i = 0; i <= newLevel; i++) {
      node.forward[i] = update[i]!.forward[i];
      update[i]!.forward[i] = node;
    }

    frames.push(this.makeFrame(`插入 ${key} 完成, 层高 L${newLevel + 1}`, { insertingKey: key, action: 'insert' }));
    return frames;
  }

  search(key: number): AnimationFrame[] {
    const frames: AnimationFrame[] = [];
    const path: { nodeId: string; level: number }[] = [];

    let current = this.head;
    for (let i = this.level; i >= 0; i--) {
      while (current.forward[i] && current.forward[i]!.key < key) {
        current = current.forward[i]!;
        path.push({ nodeId: current.id, level: i });
      }
    }

    frames.push(this.makeFrame(`从最高层搜索 ${key}`, { path: [...path], action: 'search' }));

    current = current.forward[0]!;
    if (current && current.key === key) {
      frames.push(this.makeFrame(`找到 ${key}`, { foundNodeId: current.id, path: [...path], action: 'search' }));
    } else {
      frames.push(this.makeFrame(`未找到 ${key}`, { path: [...path], action: 'search' }));
    }
    return frames;
  }

  delete(key: number): AnimationFrame[] {
    const frames: AnimationFrame[] = [];
    const update: (SkipListNode | null)[] = new Array(this.maxLevel).fill(null);
    const path: { nodeId: string; level: number }[] = [];

    let current = this.head;
    for (let i = this.level; i >= 0; i--) {
      while (current.forward[i] && current.forward[i]!.key < key) {
        current = current.forward[i]!;
        path.push({ nodeId: current.id, level: i });
      }
      update[i] = current;
    }

    frames.push(this.makeFrame(`定位待删除节点: ${key}`, { path: [...path], action: 'delete' }));

    current = current.forward[0]!;
    if (current && current.key === key) {
      for (let i = 0; i <= this.level; i++) {
        if (update[i]!.forward[i] !== current) break;
        update[i]!.forward[i] = current.forward[i];
      }
      while (this.level > 0 && !this.head.forward[this.level]) this.level--;
      frames.push(this.makeFrame(`删除 ${key} 成功`, { action: 'delete' }));
    } else {
      frames.push(this.makeFrame(`未找到 ${key}`, { action: 'delete' }));
    }
    return frames;
  }

  get levelCounts(): number[] {
    const counts = new Array(this.maxLevel).fill(0);
    let cur = this.head.forward[0];
    while (cur) {
      for (let i = 0; i < cur.forward.length; i++) {
        if (i < this.maxLevel) counts[i]++;
      }
      cur = cur.forward[0];
    }
    return counts;
  }

  serialize(): any {
    const nodes: Record<string, SkipListNodeData> = {};
    const collect = (n: SkipListNode | null) => {
      if (!n || nodes[n.id]) return;
      nodes[n.id] = {
        id: n.id,
        key: n.key,
        level: n.forward.length - 1,
        forward: n.forward.map((f) => (f ? f.id : null)),
      };
      n.forward.forEach((f) => collect(f));
    };
    collect(this.head);
    return { nodes, headId: this.head.id, maxLevel: this.maxLevel, probability: this.probability, levelCounts: this.levelCounts };
  }

  makeFrame(description: string, extra: any = {}): AnimationFrame {
    return { id: Math.random().toString(36).slice(2), data: { ...this.serialize(), highlighting: extra }, description };
  }
}
