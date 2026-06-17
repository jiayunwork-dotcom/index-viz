import type { AnimationFrame } from '@/store/animationStore';

export const HASH_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

function hashFn(str: string, seed: number): number {
  let h = seed;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

export class BloomFilter {
  bits: boolean[];
  m: number;
  k: number;
  elements: string[] = [];

  constructor(m: number, k: number) {
    this.m = m;
    this.k = k;
    this.bits = new Array(m).fill(false);
  }

  positions(elem: string): number[] {
    const result: number[] = [];
    for (let i = 0; i < this.k; i++) {
      const h = hashFn(elem, i + 1);
      result.push(((h % this.m) + this.m) % this.m);
    }
    return result;
  }

  insert(elem: string): AnimationFrame[] {
    const frames: AnimationFrame[] = [];
    const pos = this.positions(elem);
    const colors = pos.map((_, i) => HASH_COLORS[i % HASH_COLORS.length]);

    frames.push(this.makeFrame(`计算 ${this.k} 个哈希位置: [${pos.join(', ')}]`, {
      element: elem,
      positions: pos,
      colors,
      action: 'insert',
    }));

    pos.forEach((p, i) => {
      const prev = this.bits[p];
      this.bits[p] = true;
      frames.push(this.makeFrame(prev ? `位置 ${p} 已置 1` : `将位置 ${p} 置 1`, {
        element: elem,
        positions: [p],
        colors: [colors[i]],
        action: 'insert',
      }));
    });

    if (!this.elements.includes(elem)) this.elements.push(elem);
    frames.push(this.makeFrame(`插入 "${elem}" 完成`, { element: elem, action: 'insert' }));
    return frames;
  }

  query(elem: string): AnimationFrame[] {
    const frames: AnimationFrame[] = [];
    const pos = this.positions(elem);
    const colors = pos.map((_, i) => HASH_COLORS[i % HASH_COLORS.length]);

    frames.push(this.makeFrame(`查询 "${elem}": 计算 ${this.k} 个哈希位置`, {
      element: elem,
      positions: pos,
      colors,
      action: 'query',
    }));

    let hasZero = false;
    pos.forEach((p, i) => {
      frames.push(this.makeFrame(`检查位置 ${p}: ${this.bits[p] ? '1' : '0'}`, {
        element: elem,
        positions: [p],
        colors: [colors[i]],
        action: 'query',
      }));
      if (!this.bits[p]) hasZero = true;
    });

    frames.push(this.makeFrame(hasZero ? `结果: 一定不存在` : `结果: 可能存在 (FPR=${this.fpr.toFixed(4)})`, {
      element: elem,
      positions: pos,
      colors,
      result: hasZero ? 'none' : 'maybe',
      action: 'query',
    }));
    return frames;
  }

  get n(): number {
    return this.elements.length;
  }

  get fpr(): number {
    return Math.pow(1 - Math.pow(1 - 1 / this.m, this.k * this.n), this.k);
  }

  makeFrame(description: string, extra: any = {}): AnimationFrame {
    return {
      id: Math.random().toString(36).slice(2),
      data: {
        bits: [...this.bits],
        m: this.m,
        k: this.k,
        n: this.n,
        fpr: this.fpr,
        insertedElements: [...this.elements],
        highlighting: extra,
      },
      description,
    };
  }
}
