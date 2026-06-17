import type { AnimationFrame } from '@/store/animationStore';
import type { KVPair, SSTableData, Strategy } from './types';
import { uid } from '@/lib/utils';

function buildBloom(entries: KVPair[], size = 32): boolean[] {
  const bits = new Array(size).fill(false);
  entries.forEach((e) => {
    for (let i = 0; i < 3; i++) {
      const h = ((e.key * (i + 7)) % size + size) % size;
      bits[h] = true;
    }
  });
  return bits;
}

function makeSSTable(level: number, entries: KVPair[]): SSTableData {
  const sorted = [...entries].sort((a, b) => a.key - b.key);
  return {
    id: uid(),
    level,
    entries: sorted,
    minKey: sorted[0]?.key ?? 0,
    maxKey: sorted[sorted.length - 1]?.key ?? 0,
    size: sorted.length,
    bloom: buildBloom(sorted),
  };
}

export class LSMTree {
  memtable: KVPair[] = [];
  levels: SSTableData[][] = [];
  maxLevels: number;
  strategy: Strategy;
  memCapacity: number;

  constructor(memCapacity = 5, maxLevels = 4, strategy: Strategy = 'size-tiered') {
    this.memCapacity = memCapacity;
    this.maxLevels = maxLevels;
    this.strategy = strategy;
    this.levels = Array.from({ length: maxLevels }, () => []);
  }

  write(key: number, value: string = `v${key}`): AnimationFrame[] {
    const frames: AnimationFrame[] = [];
    const entry: KVPair = { key, value };

    frames.push(this.makeFrame(`写入 key=${key} 到 MemTable`, { writingEntry: entry, action: 'write' }));
    this.memtable.push(entry);
    this.memtable.sort((a, b) => a.key - b.key);
    frames.push(this.makeFrame(`MemTable 已更新 (${this.memtable.length}/${this.memCapacity})`, { action: 'write' }));

    if (this.memtable.length >= this.memCapacity) {
      frames.push(...this.flush());
    }
    return frames;
  }

  private flush(): AnimationFrame[] {
    const frames: AnimationFrame[] = [];
    const frozen = [...this.memtable];
    frames.push(this.makeFrame(`MemTable 满, 冻结为 Immutable`, { action: 'flush' }));

    const sst = makeSSTable(0, frozen);
    this.levels[0].push(sst);
    this.memtable = [];
    frames.push(this.makeFrame(`刷盘到 L0: SSTable ${sst.id.slice(0, 5)}`, { action: 'flush' }));

    frames.push(...this.maybeCompact(0));
    return frames;
  }

  private maybeCompact(level: number): AnimationFrame[] {
    const frames: AnimationFrame[] = [];
    if (level >= this.maxLevels - 1) return frames;

    const threshold = this.strategy === 'leveled' ? (level + 2) : 4;

    if (this.levels[level].length >= threshold) {
      frames.push(...this.compact(level));
    }
    return frames;
  }

  private compact(level: number): AnimationFrame[] {
    const frames: AnimationFrame[] = [];
    const tables = this.levels[level].slice(0, Math.min(3, this.levels[level].length));

    frames.push(this.makeFrame(`触发 Compaction: L${level} ${tables.length} 个文件合并`, {
      compaction: { fromLevel: level, tables: tables.map((t) => t.id) },
      action: 'compact',
    }));

    const merged: Record<number, KVPair> = {};
    tables.forEach((t) => t.entries.forEach((e) => (merged[e.key] = e)));
    const finalEntries = Object.values(merged).filter((e) => !e.tombstone).sort((a, b) => a.key - b.key);

    const newSST = makeSSTable(level + 1, finalEntries);
    frames.push(this.makeFrame(`归并排序完成, 生成 L${level + 1} SSTable`, {
      compaction: { fromLevel: level, tables: tables.map((t) => t.id), newTableId: newSST.id },
      action: 'compact',
    }));

    this.levels[level] = this.levels[level].filter((t) => !tables.find((x) => x.id === t.id));
    this.levels[level + 1].push(newSST);

    frames.push(this.makeFrame(`Compaction 完成`, { action: 'compact' }));
    frames.push(...this.maybeCompact(level + 1));
    return frames;
  }

  delete(key: number): AnimationFrame[] {
    const frames: AnimationFrame[] = [];
    const tomb: KVPair = { key, value: '', tombstone: true };
    frames.push(this.makeFrame(`写入墓碑标记: key=${key}`, { writingEntry: tomb, action: 'write' }));
    this.memtable.push(tomb);
    this.memtable.sort((a, b) => a.key - b.key);
    if (this.memtable.length >= this.memCapacity) frames.push(...this.flush());
    return frames;
  }

  read(key: number): AnimationFrame[] {
    const frames: AnimationFrame[] = [];
    const checkedLevels: { level: number; tableId: string; bloom: boolean; result?: 'found' | 'miss' | 'tombstone' }[] = [];

    frames.push(this.makeFrame(`查询 key=${key}: 先查 MemTable`, {
      readPath: { key, checkedMemtable: false, checkedLevels },
      action: 'read',
    }));

    const inMem = this.memtable.find((e) => e.key === key);
    if (inMem) {
      frames.push(this.makeFrame(inMem.tombstone ? `MemTable 中找到墓碑标记` : `MemTable 中找到: ${inMem.value}`, {
        readPath: { key, checkedMemtable: true, checkedLevels, result: inMem.tombstone ? 'tombstone' : 'found' },
        action: 'read',
      }));
      return frames;
    }
    frames.push(this.makeFrame(`MemTable 未命中, 逐层查询 SSTable`, {
      readPath: { key, checkedMemtable: true, checkedLevels },
      action: 'read',
    }));

    for (let lvl = 0; lvl < this.levels.length; lvl++) {
      for (const sst of this.levels[lvl]) {
        const bloomPass = [0, 1, 2].every((i) => sst.bloom[(((key * (i + 7)) % sst.bloom.length) + sst.bloom.length) % sst.bloom.length]);
        checkedLevels.push({ level: lvl, tableId: sst.id, bloom: bloomPass });
        if (!bloomPass) {
          checkedLevels[checkedLevels.length - 1].result = 'miss';
          continue;
        }
        const entry = sst.entries.find((e) => e.key === key);
        if (entry) {
          checkedLevels[checkedLevels.length - 1].result = entry.tombstone ? 'tombstone' : 'found';
          frames.push(this.makeFrame(
            entry.tombstone
              ? `L${lvl} SSTable 中找到墓碑标记`
              : `L${lvl} SSTable 中找到: ${entry.value}`,
            { readPath: { key, checkedMemtable: true, checkedLevels }, action: 'read' }
          ));
          return frames;
        }
        checkedLevels[checkedLevels.length - 1].result = 'miss';
      }
    }

    frames.push(this.makeFrame(`所有层均未找到 key=${key}`, {
      readPath: { key, checkedMemtable: true, checkedLevels, result: 'miss' },
      action: 'read',
    }));
    return frames;
  }

  makeFrame(description: string, extra: any = {}): AnimationFrame {
    return {
      id: Math.random().toString(36).slice(2),
      data: {
        memtable: {
          entries: [...this.memtable],
          capacity: this.memCapacity,
        },
        levels: this.levels.map((lv) => lv.map((t) => ({ ...t, bloom: [...t.bloom], entries: [...t.entries] }))),
        maxLevels: this.maxLevels,
        strategy: this.strategy,
        memCapacity: this.memCapacity,
        highlighting: extra,
      },
      description,
    };
  }
}
